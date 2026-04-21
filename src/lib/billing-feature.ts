export function isBillingEnabled() {
  return process.env.NEXT_PUBLIC_BILLING_ENABLED !== "false";
}

export function isSelfServiceApiKeysEnabled() {
  return false;
}
