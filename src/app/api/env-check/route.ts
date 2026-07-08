import { NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/admin";
import { getFirstAppSecret, listAppSecretKeys } from "@/lib/app-secrets";
import { getServerEnv } from "@/lib/server-env";
import { createClient } from "@/lib/supabase-server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const billingStripeSecret = await getFirstAppSecret([
    "BILLING_STRIPE_SECRET_KEY",
    "STRIPE_SECRET_KEY",
  ]);
  const billingStripeWebhookSecret = await getFirstAppSecret([
    "BILLING_STRIPE_WEBHOOK_SECRET",
    "STRIPE_WEBHOOK_SECRET",
  ]);
  const runtimeEnvKeys = Object.keys(process.env)
    .filter((key) => /(STRIPE|BILLING|DOUBAO|ZENMUX|SUPABASE)/.test(key))
    .sort();
  const appSecretKeys = await listAppSecretKeys();

  return NextResponse.json({
    hasBillingStripeSecret: Boolean(billingStripeSecret),
    hasBillingStripeWebhookSecret: Boolean(billingStripeWebhookSecret),
    hasSupabaseUrl: Boolean(getServerEnv("NEXT_PUBLIC_SUPABASE_URL")),
    hasSupabaseAnonKey: Boolean(getServerEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")),
    hasSupabaseServiceRoleKey: Boolean(
      getServerEnv("SUPABASE_SERVICE_ROLE_KEY")
    ),
    hasZenMuxApiKey: Boolean(await getFirstAppSecret(["ZENMUX_API_KEY"])),
    paymentProvider: getServerEnv("PAYMENT_PROVIDER") || null,
    billingEnabled: getServerEnv("NEXT_PUBLIC_BILLING_ENABLED") || null,
    vercelEnv: getServerEnv("VERCEL_ENV") || null,
    vercelUrl: getServerEnv("VERCEL_URL") || null,
    vercelProjectProductionUrl:
      getServerEnv("VERCEL_PROJECT_PRODUCTION_URL") || null,
    runtimeEnvKeys,
    appSecretKeys,
  });
}
