// -----------------------------------------------------------------------------
// @file: app/api/billing/change-plan/route.ts
// @purpose: Self-serve mid-cycle plan upgrade / downgrade. Updates the
//           Stripe subscription with proration; the existing subscription
//           webhook then syncs company.planId. Top-up packs are rejected
//           here — this route is for recurring plans only.
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { canManagePlan } from "@/lib/permissions/companyRoles";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

type Body = {
  planId?: string;
  /** Stripe proration behavior. Default "create_prorations" (credits/charges
   *  the difference immediately). Pass "none" to schedule the change without
   *  a proration invoice — common for downgrades. */
  prorationBehavior?: "create_prorations" | "none" | "always_invoice";
};

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    if (user.role !== "CUSTOMER") {
      return NextResponse.json(
        { error: "Only company members can change the plan." },
        { status: 403 },
      );
    }
    if (!user.activeCompanyId) {
      return NextResponse.json({ error: "No active company selected." }, { status: 400 });
    }
    if (!canManagePlan(user.companyRole)) {
      return NextResponse.json(
        { error: "Only OWNER or BILLING members can change the plan." },
        { status: 403 },
      );
    }

    const body = (await req.json()) as Body;
    const planId = body.planId;
    const prorationBehavior = body.prorationBehavior ?? "create_prorations";
    if (!planId) {
      return NextResponse.json({ error: "planId is required." }, { status: 400 });
    }

    const [company, plan] = await Promise.all([
      prisma.company.findUniqueOrThrow({
        where: { id: user.activeCompanyId },
        select: {
          id: true,
          stripeSubscriptionId: true,
          planId: true,
        },
      }),
      prisma.plan.findUnique({ where: { id: planId } }),
    ]);

    if (!plan || !plan.isActive) {
      return NextResponse.json({ error: "Plan not found or inactive." }, { status: 404 });
    }
    if (!plan.isRecurring) {
      return NextResponse.json(
        { error: "This is a one-time top-up pack — use the Buy button instead." },
        { status: 400 },
      );
    }
    if (!plan.stripePriceId) {
      return NextResponse.json(
        { error: "This plan isn't linked to a Stripe price yet. Please contact support." },
        { status: 400 },
      );
    }
    if (plan.id === company.planId) {
      return NextResponse.json({ error: "Your company is already on this plan." }, { status: 400 });
    }
    if (!company.stripeSubscriptionId) {
      return NextResponse.json(
        {
          error:
            "Your company does not have an active Stripe subscription. Start one via Manage billing.",
        },
        { status: 400 },
      );
    }

    // Find the current subscription item (one-price-per-subscription in our
    // setup) so we can patch its price in-place.
    const subscription = await stripe.subscriptions.retrieve(company.stripeSubscriptionId);
    const currentItem = subscription.items.data[0];
    if (!currentItem) {
      return NextResponse.json(
        { error: "The Stripe subscription has no items — cannot change plan." },
        { status: 500 },
      );
    }

    const updated = await stripe.subscriptions.update(company.stripeSubscriptionId, {
      items: [{ id: currentItem.id, price: plan.stripePriceId }],
      proration_behavior: prorationBehavior,
    });

    // The customer.subscription.updated webhook will sync planId. We also
    // set it eagerly so the UI reflects the change immediately on the next
    // page load without waiting for the webhook round-trip.
    await prisma.company.update({
      where: { id: company.id },
      data: { planId: plan.id },
    });

    return NextResponse.json({
      ok: true,
      subscriptionId: updated.id,
      planId: plan.id,
      prorationBehavior,
    });
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    // Stripe errors carry .message that's safe to surface to the client.
    const err = error as Stripe.errors.StripeError | Error;
    const message = err instanceof Error ? err.message : "Failed to change plan.";
    console.error("[billing.change-plan] POST error", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
