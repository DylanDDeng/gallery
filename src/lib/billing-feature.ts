export function isBillingEnabled() {
  return process.env.NEXT_PUBLIC_BILLING_ENABLED !== "false";
}

export function isSelfServiceApiKeysEnabled() {
  return process.env.NEXT_PUBLIC_SELF_SERVICE_API_KEYS_ENABLED === "true";
}
