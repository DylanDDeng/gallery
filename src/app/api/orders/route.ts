import { NextResponse } from "next/server";
import { ensureAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getCreditPackages, getPackageById } from "@/lib/billing";
import { isBillingEnabled } from "@/lib/billing-feature";
import { getPaymentProvider, isPaddleProvider } from "@/lib/payment-provider";
import { createPaddleTransaction } from "@/lib/paddle";
import { createStripeCheckoutSession } from "@/lib/stripe";

function getPackagePriceDiagnostics(paymentProvider: string) {
  return Object.fromEntries(
    getCreditPackages(paymentProvider === "paddle" ? "paddle" : "stripe").map(
      (pkg) => [pkg.id, Boolean(pkg.priceId)]
    )
  );
}

export async function GET() {
  if (!isBillingEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const user = await ensureAuth();
  if (user instanceof NextResponse) {
    return user;
  }

  try {
    const { data: orders, error } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ orders: orders ?? [] });
  } catch (error) {
    console.error("Error fetching orders:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  if (!isBillingEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const user = await ensureAuth();
  if (user instanceof NextResponse) {
    return user;
  }

  try {
    const body = await request.json();
    const { packageId } = body;
    const paymentProvider = getPaymentProvider();

    const pkg = getPackageById(packageId, paymentProvider);
    if (!pkg) {
      return NextResponse.json(
        { error: "Invalid package ID" },
        { status: 400 }
      );
    }

    if (isPaddleProvider(paymentProvider) && !pkg.priceId) {
      const diagnostics = {
        paymentProvider,
        packageId,
        selectedPackage: pkg.id,
        priceConfigured: Boolean(pkg.priceId),
        packagePriceDiagnostics: getPackagePriceDiagnostics(paymentProvider),
        billingEnabled: isBillingEnabled(),
        baseUrlConfigured: Boolean(process.env.NEXT_PUBLIC_BASE_URL),
      };

      console.error("Billing package price missing", {
        ...diagnostics,
      });

      return NextResponse.json(
        { error: "Package price not configured", diagnostics },
        { status: 500 }
      );
    }

    // Create pending order
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .insert({
        user_id: user.id,
        amount: pkg.credits,
        price_cents: pkg.priceCents,
        currency: "usd",
        payment_provider: paymentProvider,
        status: "pending",
      })
      .select()
      .single();

    if (orderError) {
      console.error("Error creating order:", orderError);
      return NextResponse.json(
        { error: "Failed to create order" },
        { status: 500 }
      );
    }

    const baseUrl = new URL(request.url).origin;

    try {
      let checkoutUrl: string;
      let updateFields: Record<string, string>;

      if (isPaddleProvider(paymentProvider)) {
        const checkoutPageUrl = `${baseUrl}/checkout/${order.id}`;
        const { transactionId, checkoutUrl: paddleCheckoutUrl } =
          await createPaddleTransaction({
            priceId: pkg.priceId,
            orderId: order.id,
            userId: user.id,
            packageId: pkg.id,
            credits: pkg.credits,
            checkoutPageUrl,
          });

        checkoutUrl = paddleCheckoutUrl;
        updateFields = { paddle_transaction_id: transactionId };
      } else {
        const { sessionId, checkoutUrl: stripeCheckoutUrl } =
          await createStripeCheckoutSession({
            orderId: order.id,
            userId: user.id,
            userEmail: user.email,
            packageId: pkg.id,
            credits: pkg.credits,
            priceCents: pkg.priceCents,
            currency: order.currency,
            baseUrl,
          });

        checkoutUrl = stripeCheckoutUrl;
        updateFields = { stripe_session_id: sessionId };
      }

      const { error: updateOrderError } = await supabaseAdmin
        .from("orders")
        .update(updateFields)
        .eq("id", order.id)
        .eq("user_id", user.id);

      if (updateOrderError) {
        console.error("Error saving checkout provider ID on order:", updateOrderError);
      }

      return NextResponse.json({
        order: {
          ...order,
          ...updateFields,
        },
        checkoutUrl,
      });
    } catch (error) {
      console.error("Error creating checkout session:", error);

      await supabaseAdmin
        .from("orders")
        .update({ status: "failed" })
        .eq("id", order.id)
        .eq("status", "pending");

      return NextResponse.json(
        { error: "Failed to create checkout" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error creating order:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
