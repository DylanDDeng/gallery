import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { isBillingEnabled } from "@/lib/billing-feature";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  type PaddleTransactionData,
  type PaddleWebhookEvent,
  verifyPaddleWebhookSignature,
} from "@/lib/paddle";

export const runtime = "nodejs";

interface PaddleOrderMetadata {
  order_id?: string;
  user_id?: string;
  credits?: number | string;
}

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

async function handleCompletedTransaction(
  event: PaddleWebhookEvent<PaddleTransactionData>
) {
  const transaction = event.data;
  const metadata = (transaction.custom_data ?? {}) as PaddleOrderMetadata;
  const orderId = getStringValue(metadata.order_id);
  const metadataUserId = getStringValue(metadata.user_id);
  const metadataCredits = getNumberValue(metadata.credits);

  let orderQuery = supabaseAdmin
    .from("orders")
    .select("id, user_id, amount, status, paddle_transaction_id")
    .eq("payment_provider", "paddle");

  if (orderId) {
    orderQuery = orderQuery.eq("id", orderId);
  } else {
    orderQuery = orderQuery.eq("paddle_transaction_id", transaction.id);
  }

  const { data: order, error: orderError } = await orderQuery.single();

  if (orderError || !order) {
    console.error("Paddle order not found for transaction:", transaction.id);
    return;
  }

  if (metadataUserId && metadataUserId !== order.user_id) {
    console.error("Paddle metadata user mismatch for transaction:", transaction.id);
    return;
  }

  const credits = metadataCredits ?? order.amount;
  const userId = metadataUserId ?? order.user_id;

  const { data: fulfillmentResult, error: fulfillmentError } =
    await supabaseAdmin.rpc("complete_credit_order_v2", {
      p_order_id: order.id,
      p_user_id: userId,
      p_credits: credits,
      p_provider: "paddle",
      p_provider_checkout_id: transaction.id,
      p_provider_payment_intent_id: null,
    });

  if (fulfillmentError) {
    console.error("Error fulfilling Paddle order:", fulfillmentError);
    return;
  }

  const result = Array.isArray(fulfillmentResult)
    ? fulfillmentResult[0]
    : fulfillmentResult;

  if (result?.completed) {
    console.log(
      `Successfully credited ${credits} to user ${userId} for Paddle transaction ${transaction.id}`
    );
    return;
  }

  console.log(`Paddle order ${order.id} already fulfilled, skipping duplicate event`);
}

export async function POST(request: Request) {
  if (!isBillingEnabled()) {
    return NextResponse.json({ received: true, ignored: true });
  }

  const rawBody = await request.text();
  const headersList = await headers();
  const signature = headersList.get("paddle-signature");
  const webhookSecret = process.env.PADDLE_WEBHOOK_SECRET;

  if (!signature) {
    return NextResponse.json(
      { error: "Missing paddle-signature header" },
      { status: 400 }
    );
  }

  if (!webhookSecret) {
    console.error("Missing PADDLE_WEBHOOK_SECRET");
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  if (!verifyPaddleWebhookSignature(rawBody, signature, webhookSecret)) {
    return NextResponse.json(
      { error: "Invalid Paddle signature" },
      { status: 400 }
    );
  }

  let event: PaddleWebhookEvent<PaddleTransactionData>;

  try {
    event = JSON.parse(rawBody) as PaddleWebhookEvent<PaddleTransactionData>;
  } catch (error) {
    console.error("Failed to parse Paddle webhook payload:", error);
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  try {
    switch (event.event_type) {
      case "transaction.completed":
        await handleCompletedTransaction(event);
        break;
      default:
        console.log(`Unhandled Paddle event type: ${event.event_type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Error processing Paddle webhook:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}
