import { NextResponse } from "next/server";
import { getFirstServerEnv, getServerEnv } from "@/lib/server-env";

export async function GET() {
  const billingStripeSecret = getFirstServerEnv([
    "BILLING_STRIPE_SECRET_KEY",
    "STRIPE_SECRET_KEY",
  ]);
  const billingStripeWebhookSecret = getFirstServerEnv([
    "BILLING_STRIPE_WEBHOOK_SECRET",
    "STRIPE_WEBHOOK_SECRET",
  ]);
  const runtimeEnvKeys = Object.keys(process.env)
    .filter((key) => /(STRIPE|BILLING|DOUBAO|SUPABASE)/.test(key))
    .sort();

  return NextResponse.json({
    hasBillingStripeSecret: Boolean(billingStripeSecret),
    hasBillingStripeWebhookSecret: Boolean(billingStripeWebhookSecret),
    hasSupabaseUrl: Boolean(getServerEnv("NEXT_PUBLIC_SUPABASE_URL")),
    hasSupabaseAnonKey: Boolean(getServerEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")),
    hasSupabaseServiceRoleKey: Boolean(
      getServerEnv("SUPABASE_SERVICE_ROLE_KEY")
    ),
    paymentProvider: getServerEnv("PAYMENT_PROVIDER") || null,
    billingEnabled: getServerEnv("NEXT_PUBLIC_BILLING_ENABLED") || null,
    selfServiceApiKeysEnabled:
      getServerEnv("NEXT_PUBLIC_SELF_SERVICE_API_KEYS_ENABLED") || null,
    vercelEnv: getServerEnv("VERCEL_ENV") || null,
    vercelUrl: getServerEnv("VERCEL_URL") || null,
    vercelProjectProductionUrl:
      getServerEnv("VERCEL_PROJECT_PRODUCTION_URL") || null,
    runtimeEnvKeys,
  });
}
