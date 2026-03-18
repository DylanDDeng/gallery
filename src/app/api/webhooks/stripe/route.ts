import { NextResponse } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";
import { isBillingEnabled } from "@/lib/billing-feature";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

function getStringValue(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function getNumberValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.length > 0) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

async function fulfillStripeCheckout(session: Stripe.Checkout.Session) {
  if (session.payment_status !== "paid") {
    console.log(
      `Stripe session ${session.id} is not paid yet, skipping fulfillment`
    );
    return;
  }

  const orderId =
    getStringValue(session.client_reference_id) ||
    getStringValue(session.metadata?.order_id);
  const metadataUserId = getStringValue(session.metadata?.user_id);
  const metadataCredits = getNumberValue(session.metadata?.credits);

  let orderQuery = supabaseAdmin
    .from("orders")
    .select("id, user_id, amount, status, stripe_session_id")
    .eq("payment_provider", "stripe");

  if (orderId) {
    orderQuery = orderQuery.eq("id", orderId);
  } else {
    orderQuery = orderQuery.eq("stripe_session_id", session.id);
  }

  const { data: order, error: orderError } = await orderQuery.single();

  if (orderError || !order) {
    console.error("Stripe order not found for session:", session.id);
    return;
  }

  if (metadataUserId && metadataUserId !== order.user_id) {
    console.error("Stripe metadata user mismatch for session:", session.id);
    return;
  }

  const credits = metadataCredits ?? order.amount;
  const userId = metadataUserId ?? order.user_id;

  const { data: fulfillmentResult, error: fulfillmentError } =
    await supabaseAdmin.rpc("complete_credit_order_v2", {
      p_order_id: order.id,
      p_user_id: userId,
      p_credits: credits,
      p_provider: "stripe",
      p_provider_checkout_id: session.id,
      p_provider_payment_intent_id:
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : null,
    });

  if (fulfillmentError) {
    console.error("Error fulfilling Stripe order:", fulfillmentError);
    return;
  }

  const result = Array.isArray(fulfillmentResult)
    ? fulfillmentResult[0]
    : fulfillmentResult;

  if (result?.completed) {
    console.log(
      `Successfully credited ${credits} to user ${userId} for Stripe session ${session.id}`
    );
    return;
  }

  console.log(`Stripe order ${order.id} already fulfilled, skipping duplicate event`);
}

export async function POST(request: Request) {
  if (!isBillingEnabled()) {
    return NextResponse.json({ received: true, ignored: true });
  }

  const rawBody = await request.text();
  const headersList = await headers();
  const signature = headersList.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  if (!webhookSecret) {
    console.error("Missing STRIPE_WEBHOOK_SECRET");
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(
      rawBody,
      signature,
      webhookSecret
    );
  } catch (error) {
    const err = error as Error;
    console.error("Stripe webhook signature verification failed:", err.message);
    return NextResponse.json(
      { error: `Webhook Error: ${err.message}` },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        await fulfillStripeCheckout(event.data.object as Stripe.Checkout.Session);
        break;
      case "checkout.session.async_payment_failed":
      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;

        await supabaseAdmin
          .from("orders")
          .update({ status: "failed" })
          .eq("stripe_session_id", session.id)
          .eq("payment_provider", "stripe")
          .eq("status", "pending");
        break;
      }
      default:
        console.log(`Unhandled Stripe event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Error processing Stripe webhook:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}
