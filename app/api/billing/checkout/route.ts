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
import { stripe, getAppBaseUrl } from "@/lib/stripe";

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

    const body = (await req.json()) as CheckoutRequestBody;
    const planId = body.planId;

    if (!planId) {
      return NextResponse.json(
        { error: "planId is required." },
        { status: 400 },
      );
    }

    const plan = await prisma.plan.findUnique({
      where: { id: planId },
    });

    if (!plan || !plan.isActive) {
      return NextResponse.json(
        { error: "Plan not found or not active." },
        { status: 404 },
      );
    }

    if (!plan.stripePriceId) {
      return NextResponse.json(
        {
          error:
            "This plan is not yet linked to a Stripe price. Please contact support.",
        },
        { status: 400 },
      );
    }

    const baseUrl = getAppBaseUrl();

    // Stripe Checkout Session oluşturma
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: plan.stripePriceId,
          quantity: 1,
        },
      ],
      // Checkout sonrası geri dönüş adresleri
      success_url: `${baseUrl}/customer/settings?billing=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/customer/settings?billing=cancelled`,
      metadata: {
        planId: plan.id,
        companyId: user.activeCompanyId,
        userId: user.id,
      },
      // Eğer customer sistemin Stripe tarafında yoksa, Stripe kendi customer kaydını yaratır.
      // İleride user.companyId ile eşleştirmek için webhook'ta metadata kullanacağız.
    });

    if (!session.url) {
      return NextResponse.json(
        {
          error:
            "Checkout session created but no URL was returned by Stripe.",
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
      return NextResponse.json(
        { error: "Unauthenticated" },
        { status: 401 },
      );
    }

    console.error("[billing.checkout] POST error", error);
    return NextResponse.json(
      { error: "Failed to create checkout session." },
      { status: 500 },
    );
  }
}
