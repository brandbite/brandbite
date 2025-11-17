// -----------------------------------------------------------------------------
// @file: app/api/billing/webhook/route.ts
// @purpose: Stripe webhook handler (test mode skeleton)
// @version: v0.1.0
// @status: active
// @lastUpdate: 2025-11-17
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import type Stripe from "stripe";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

/**
 * Stripe webhook endpoint
 *
 * NOTE:
 * - This route expects the raw request body (string), not JSON.
 * - In Next.js App Router, we can use req.text() to get the raw body.
 */
export async function POST(req: NextRequest) {
  if (!webhookSecret) {
    console.error(
      "[billing.webhook] STRIPE_WEBHOOK_SECRET is not set, ignoring webhook.",
    );
    return NextResponse.json(
      { error: "Webhook not configured." },
      { status: 500 },
    );
  }

  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header." },
      { status: 400 },
    );
  }

  let event: Stripe.Event;

  try {
    const body = await req.text();
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      webhookSecret,
    );
  } catch (err: unknown) {
    console.error("[billing.webhook] Signature verification failed.", err);
    return NextResponse.json(
      { error: "Invalid signature." },
      { status: 400 },
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log("[billing.webhook] checkout.session.completed", {
          id: session.id,
          status: session.status,
          metadata: session.metadata,
        });

        // TODO:
        // - session.metadata içinden planId, companyId, userId al
        // - company'ye plan ata / subscription kaydet
        // - ilk token top-up işlemini burada tetikle
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        console.log("[billing.webhook] invoice.payment_succeeded", {
          id: invoice.id,
          customer: invoice.customer,
        });

        // TODO:
        // - Bu noktada subscription yenilendi
        // - company'ye plan.monthlyTokens kadar CREDIT token ekle
        break;
      }

      case "customer.subscription.deleted":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        console.log("[billing.webhook] subscription event", {
          id: subscription.id,
          status: subscription.status,
        });

        // TODO:
        // - subscription status'e göre company plan durumu güncelle
        break;
      }

      default: {
        console.log("[billing.webhook] Unhandled event type", event.type);
      }
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err: unknown) {
    console.error("[billing.webhook] Handler error", err);
    return NextResponse.json(
      { error: "Webhook handler failure." },
      { status: 500 },
    );
  }
}
