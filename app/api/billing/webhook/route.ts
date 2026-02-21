// -----------------------------------------------------------------------------
// @file: app/api/billing/webhook/route.ts
// @purpose: Stripe webhook handler (subscription + token credits)
// @version: v0.2.1
// @status: active
// @lastUpdate: 2025-11-17
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import type Stripe from "stripe";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

type BillingStatus = "ACTIVE" | "PAST_DUE" | "CANCELED";

function mapStripeSubscriptionStatus(status: Stripe.Subscription.Status): BillingStatus {
  switch (status) {
    case "trialing":
    case "active":
      return "ACTIVE";
    case "past_due":
    case "unpaid":
    case "incomplete":
    case "paused":
      return "PAST_DUE";
    case "canceled":
    case "incomplete_expired":
    default:
      return "CANCELED";
  }
}

/**
 * Stripe webhook endpoint
 *
 * NOTE:
 * - Expects raw request body (req.text()) + "stripe-signature" header.
 * - Uses STRIPE_WEBHOOK_SECRET to verify the payload.
 */
export async function POST(req: NextRequest) {
  // Rate limit: 30 requests/min per IP
  const ip = getClientIp(req.headers);
  const rl = rateLimit(`webhook:${ip}`, { limit: 30, windowSeconds: 60 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  if (!webhookSecret) {
    console.error("[billing.webhook] STRIPE_WEBHOOK_SECRET is not set, ignoring webhook.");
    return NextResponse.json({ error: "Webhook not configured." }, { status: 500 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header." }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    const body = await req.text();
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: unknown) {
    console.error("[billing.webhook] Signature verification failed.", err);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  try {
    switch (event.type) {
      // -----------------------------------------------------------
      // 1) Checkout tamamlandı → company’ye plan + subscription bağla,
      //    gerekiyorsa ilk token credit yap.
      // -----------------------------------------------------------
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const metadata = session.metadata || {};

        const planId = metadata.planId;
        const companyId = metadata.companyId;
        const userId = metadata.userId;

        if (!planId || !companyId) {
          console.warn(
            "[billing.webhook] checkout.session.completed without planId/companyId in metadata.",
            { planId, companyId },
          );
          break;
        }

        const [plan, company] = await Promise.all([
          prisma.plan.findUnique({ where: { id: planId } }),
          prisma.company.findUnique({ where: { id: companyId } }),
        ]);

        if (!plan || !plan.isActive) {
          console.warn(
            "[billing.webhook] Plan not found or inactive for checkout.session.completed",
            { planId },
          );
          break;
        }

        if (!company) {
          console.warn("[billing.webhook] Company not found for checkout.session.completed", {
            companyId,
          });
          break;
        }

        // Customer & subscription id'lerini session'dan al
        let stripeCustomerId: string | null = null;
        if (typeof session.customer === "string") {
          stripeCustomerId = session.customer;
        } else if (session.customer && typeof (session.customer as any).id === "string") {
          stripeCustomerId = (session.customer as Stripe.Customer).id;
        }

        let stripeSubscriptionId: string | null = null;
        if (typeof session.subscription === "string") {
          stripeSubscriptionId = session.subscription;
        } else if (session.subscription && typeof (session.subscription as any).id === "string") {
          stripeSubscriptionId = (session.subscription as Stripe.Subscription).id;
        }

        const isFirstSubscription = !company.stripeSubscriptionId;

        await prisma.$transaction(async (tx) => {
          const beforeBalance = company.tokenBalance;
          const shouldCredit = isFirstSubscription && plan.monthlyTokens > 0;

          const afterBalance = shouldCredit ? beforeBalance + plan.monthlyTokens : beforeBalance;

          const updatedCompany = await tx.company.update({
            where: { id: company.id },
            data: {
              planId: plan.id,
              stripeCustomerId: stripeCustomerId ?? company.stripeCustomerId,
              stripeSubscriptionId: stripeSubscriptionId ?? company.stripeSubscriptionId,
              billingStatus: "ACTIVE",
              tokenBalance: afterBalance,
            },
          });

          if (shouldCredit) {
            await tx.tokenLedger.create({
              data: {
                companyId: updatedCompany.id,
                userId: userId ?? null,
                direction: "CREDIT",
                amount: plan.monthlyTokens,
                reason: "SUBSCRIPTION_INITIAL_CREDIT",
                notes: "Initial subscription credit from Stripe checkout.session.completed",
                metadata: {
                  stripeEventId: event.id,
                  stripeSessionId: session.id,
                  stripeCustomerId,
                  stripeSubscriptionId,
                },
                balanceBefore: beforeBalance,
                balanceAfter: afterBalance,
              },
            });
          }
        });

        console.log("[billing.webhook] checkout.session.completed handled", {
          planId,
          companyId,
          stripeCustomerId,
          stripeSubscriptionId,
          isFirstSubscription,
        });

        break;
      }

      // -----------------------------------------------------------
      // 2) Fatura başarıyla ödendi → her cycle’da token ekle
      // -----------------------------------------------------------
      case "invoice.payment_succeeded": {
        // Stripe'ın type tanımında subscription alanı eksik olabilir,
        // bu yüzden intersection type ile genişletiyoruz.
        const invoice = event.data.object as Stripe.Invoice & {
          subscription?: string | Stripe.Subscription | null;
        };

        let subscriptionId: string | null = null;
        if (typeof invoice.subscription === "string") {
          subscriptionId = invoice.subscription;
        }

        if (!subscriptionId) {
          console.warn("[billing.webhook] invoice.payment_succeeded without subscription id.");
          break;
        }

        // İlk fatura genelde subscription_create; biz ilk credit'i
        // checkout.session.completed'da yaptığımız için burada atlayabiliriz.
        if (invoice.billing_reason === "subscription_create") {
          console.log(
            "[billing.webhook] invoice.payment_succeeded (subscription_create) -> skipping extra credit to avoid double.",
          );
          break;
        }

        const company = await prisma.company.findFirst({
          where: { stripeSubscriptionId: subscriptionId },
          include: { plan: true },
        });

        if (!company || !company.plan) {
          console.warn(
            "[billing.webhook] Company or plan not found for invoice.payment_succeeded",
            { subscriptionId },
          );
          break;
        }

        const plan = company.plan;

        if (plan.monthlyTokens <= 0) {
          console.log("[billing.webhook] Plan has no monthlyTokens, skipping credit.", {
            planId: plan.id,
          });
          break;
        }

        await prisma.$transaction(async (tx) => {
          const current = await tx.company.findUnique({
            where: { id: company.id },
          });

          if (!current) return;

          const beforeBalance = current.tokenBalance;
          const afterBalance = beforeBalance + plan.monthlyTokens;

          const updatedCompany = await tx.company.update({
            where: { id: company.id },
            data: {
              tokenBalance: afterBalance,
              billingStatus: "ACTIVE",
            },
          });

          await tx.tokenLedger.create({
            data: {
              companyId: updatedCompany.id,
              direction: "CREDIT",
              amount: plan.monthlyTokens,
              reason: "SUBSCRIPTION_RENEWAL",
              notes: "Monthly subscription renewal credit from Stripe invoice.payment_succeeded",
              metadata: {
                stripeEventId: event.id,
                stripeInvoiceId: invoice.id,
                stripeSubscriptionId: subscriptionId,
              },
              balanceBefore: beforeBalance,
              balanceAfter: afterBalance,
            },
          });
        });

        console.log("[billing.webhook] invoice.payment_succeeded handled", {
          subscriptionId,
          invoiceId: invoice.id,
        });

        break;
      }

      // -----------------------------------------------------------
      // 3) Subscription status değişti / silindi → billingStatus güncelle
      // -----------------------------------------------------------
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const subscriptionId = subscription.id;

        const company = await prisma.company.findFirst({
          where: { stripeSubscriptionId: subscriptionId },
        });

        if (!company) {
          console.warn("[billing.webhook] No company found for subscription event", {
            subscriptionId,
            type: event.type,
          });
          break;
        }

        const billingStatus = mapStripeSubscriptionStatus(subscription.status);

        await prisma.company.update({
          where: { id: company.id },
          data: {
            billingStatus,
          },
        });

        console.log("[billing.webhook] subscription event handled", {
          companyId: company.id,
          subscriptionId,
          billingStatus,
          type: event.type,
        });

        break;
      }

      default: {
        console.log("[billing.webhook] Unhandled event type", event.type);
      }
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err: unknown) {
    console.error("[billing.webhook] Handler error", err);
    return NextResponse.json({ error: "Webhook handler failure." }, { status: 500 });
  }
}
