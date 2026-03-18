import Stripe from "stripe";
import { getFirstAppSecret } from "@/lib/app-secrets";

let stripeClient: Stripe | null = null;

export async function getStripe() {
  if (!stripeClient) {
    const secretKey = await getFirstAppSecret([
      "BILLING_STRIPE_SECRET_KEY",
      "STRIPE_SECRET_KEY",
    ]);

    if (!secretKey) {
      throw new Error(
        "Missing BILLING_STRIPE_SECRET_KEY or STRIPE_SECRET_KEY environment variable"
      );
    }

    stripeClient = new Stripe(secretKey);
  }

  return stripeClient;
}

interface CreateStripeCheckoutSessionInput {
  orderId: string;
  userId: string;
  userEmail?: string | null;
  packageId: string;
  credits: number;
  priceCents: number;
  currency: string;
  baseUrl: string;
}

export async function createStripeCheckoutSession(
  input: CreateStripeCheckoutSessionInput
) {
  const stripe = await getStripe();

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: input.currency,
          unit_amount: input.priceCents,
          product_data: {
            name: `Aestara Credits - ${input.packageId}`,
            description: `${input.credits} credits`,
          },
        },
        quantity: 1,
      },
    ],
    client_reference_id: input.orderId,
    customer_email: input.userEmail || undefined,
    metadata: {
      order_id: input.orderId,
      user_id: input.userId,
      package_id: input.packageId,
      credits: String(input.credits),
    },
    success_url: `${input.baseUrl}/credits?success=true&order_id=${encodeURIComponent(input.orderId)}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${input.baseUrl}/credits?canceled=true&order_id=${encodeURIComponent(input.orderId)}`,
  });

  if (!session.url) {
    throw new Error("Stripe Checkout session did not return a URL");
  }

  return {
    sessionId: session.id,
    checkoutUrl: session.url,
  };
}
