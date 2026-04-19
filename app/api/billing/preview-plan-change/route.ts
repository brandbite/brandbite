// -----------------------------------------------------------------------------
// @file: app/api/billing/preview-plan-change/route.ts
// @purpose: Return the upcoming-invoice preview for a proposed plan change
//           so the customer can see "you'll be charged $X now, then $Y on
//           the next renewal" before committing. Read-only; doesn't touch
//           the subscription.
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { canManagePlan } from "@/lib/permissions/companyRoles";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

type Body = { planId?: string };

type PreviewLineItem = {
  description: string | null;
  amountCents: number;
  proration: boolean;
  period: { start: number; end: number } | null;
};

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();
    if (user.role !== "CUSTOMER" || !user.activeCompanyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    if (!canManagePlan(user.companyRole)) {
      return NextResponse.json(
        { error: "Only OWNER or BILLING members can preview a plan change." },
        { status: 403 },
      );
    }

    const body = (await req.json()) as Body;
    if (!body.planId) {
      return NextResponse.json({ error: "planId is required." }, { status: 400 });
    }

    const [company, plan] = await Promise.all([
      prisma.company.findUniqueOrThrow({
        where: { id: user.activeCompanyId },
        select: { stripeCustomerId: true, stripeSubscriptionId: true },
      }),
      prisma.plan.findUnique({ where: { id: body.planId } }),
    ]);

    if (
      !plan ||
      !plan.isActive ||
      !plan.isRecurring ||
      !plan.stripePriceId ||
      !company.stripeSubscriptionId ||
      !company.stripeCustomerId
    ) {
      return NextResponse.json(
        { error: "Plan or subscription isn't in a state we can preview." },
        { status: 400 },
      );
    }

    const subscription = await stripe.subscriptions.retrieve(company.stripeSubscriptionId);
    const currentItem = subscription.items.data[0];
    if (!currentItem) {
      return NextResponse.json({ error: "Stripe subscription has no items." }, { status: 500 });
    }

    // Stripe SDK surface for "what would the next invoice look like if I
    // patched this subscription?" has shifted across API versions. We access
    // whichever method the current SDK exposes via a single untyped handle
    // and let the parameters pass through — the shape is stable at the wire
    // level even when the TS types lag.
    type PreviewFn = (args: Record<string, unknown>) => Promise<Record<string, unknown>>;
    const invoicesApi = stripe.invoices as unknown as {
      createPreview?: PreviewFn;
      retrieveUpcoming?: PreviewFn;
    };

    const previewArgs: Record<string, unknown> = {
      customer: company.stripeCustomerId,
      subscription: company.stripeSubscriptionId,
      subscription_details: {
        items: [{ id: currentItem.id, price: plan.stripePriceId }],
        proration_behavior: "create_prorations",
      },
    };

    const callable = invoicesApi.createPreview ?? invoicesApi.retrieveUpcoming;
    if (!callable) {
      return NextResponse.json(
        { error: "Stripe SDK does not expose an invoice-preview method." },
        { status: 500 },
      );
    }
    const upcoming = (await callable(previewArgs)) as {
      amount_due?: number;
      subtotal?: number;
      total?: number;
      currency?: string;
      lines?: {
        data?: {
          description?: string | null;
          amount?: number;
          proration?: boolean;
          period?: { start?: number; end?: number } | null;
        }[];
      };
    };

    const lineItems: PreviewLineItem[] = (upcoming.lines?.data ?? []).map((l) => ({
      description: l.description ?? null,
      amountCents: l.amount ?? 0,
      proration: Boolean(l.proration),
      period:
        l.period && typeof l.period.start === "number" && typeof l.period.end === "number"
          ? { start: l.period.start, end: l.period.end }
          : null,
    }));

    return NextResponse.json({
      amountDueCents: upcoming.amount_due ?? 0,
      subtotalCents: upcoming.subtotal ?? 0,
      totalCents: upcoming.total ?? 0,
      currency: upcoming.currency ?? "usd",
      lineItems,
    });
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    const err = error as Stripe.errors.StripeError | Error;
    const message = err instanceof Error ? err.message : "Failed to preview plan change.";
    console.error("[billing.preview-plan-change] POST error", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
