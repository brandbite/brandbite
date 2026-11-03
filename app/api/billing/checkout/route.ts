// -----------------------------------------------------------------------------
// @file: app/api/billing/checkout/route.ts
// @purpose: Create Stripe Checkout Session for plan subscriptions
// @version: v0.1.0
// @status: active
// @lastUpdate: 2025-11-17
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { canManagePlan } from "@/lib/permissions/companyRoles";
import { stripe, getAppBaseUrl } from "@/lib/stripe";
import { hasLiveSubscription } from "@/lib/billing/subscription";

type CheckoutRequestBody = {
  planId?: string;
};

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    if (user.role !== "CUSTOMER") {
      return NextResponse.json(
        { error: "Only customers can start a subscription checkout." },
        { status: 403 },
      );
    }

    if (!user.activeCompanyId) {
      return NextResponse.json(
        { error: "No active company selected for this user." },
        { status: 400 },
      );
    }

    // Starting a checkout binds the company to a subscription / charge, so it
    // is OWNER/BILLING only — the same policy change-plan, preview-plan-change
    // and top-ups already enforce. Without this a plain MEMBER could initiate
    // billing for the whole company.
    if (!canManagePlan(user.companyRole)) {
      return NextResponse.json(
        { error: "Only OWNER or BILLING members can start a checkout." },
        { status: 403 },
      );
    }

    const body = (await req.json()) as CheckoutRequestBody;
    const planId = body.planId;

    if (!planId) {
      return NextResponse.json({ error: "planId is required." }, { status: 400 });
    }

    const plan = await prisma.plan.findUnique({
      where: { id: planId },
    });

    if (!plan || !plan.isActive) {
      return NextResponse.json({ error: "Plan not found or not active." }, { status: 404 });
    }

    if (!plan.stripePriceId) {
      return NextResponse.json(
        {
          error: "This plan is not yet linked to a Stripe price. Please contact support.",
        },
        { status: 400 },
      );
    }

    const company = await prisma.company.findUnique({
      where: { id: user.activeCompanyId },
      select: { stripeCustomerId: true, stripeSubscriptionId: true, billingStatus: true },
    });

    if (!company) {
      return NextResponse.json({ error: "Active company not found." }, { status: 404 });
    }

    // A second subscription checkout would bill the company twice: the webhook
    // overwrites Company.stripeSubscriptionId with the new id and the old
    // subscription keeps charging, untracked. Plan changes go through
    // /api/billing/change-plan (prorated update of the existing subscription).
    if (plan.isRecurring && hasLiveSubscription(company)) {
      return NextResponse.json(
        {
          error:
            "Your company already has an active subscription. To change plans, use “Switch to a different plan” on the Settings page.",
          code: "SUBSCRIPTION_EXISTS",
        },
        { status: 409 },
      );
    }

    const baseUrl = getAppBaseUrl();

    // Recurring plans use Stripe subscription mode; one-time "top-up" packs
    // (plan.isRecurring === false) use payment mode — single charge, no
    // subscription record, tokens credited once on checkout.session.completed.
    const mode = plan.isRecurring ? "subscription" : "payment";

    const session = await stripe.checkout.sessions.create({
      mode,
      // Reuse the company's Stripe customer so payments, invoices and saved
      // cards stay on one record instead of a new customer per checkout.
      ...(company.stripeCustomerId ? { customer: company.stripeCustomerId } : {}),
      payment_method_types: ["card"],
      line_items: [
        {
          price: plan.stripePriceId,
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/customer/settings?billing=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/customer/settings?billing=cancelled`,
      metadata: {
        planId: plan.id,
        companyId: user.activeCompanyId,
        userId: user.id,
      },
    });

    if (!session.url) {
      return NextResponse.json(
        {
          error: "Checkout session created but no URL was returned by Stripe.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        url: session.url,
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    if ((error as any)?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    console.error("[billing.checkout] POST error", error);
    return NextResponse.json({ error: "Failed to create checkout session." }, { status: 500 });
  }
}
