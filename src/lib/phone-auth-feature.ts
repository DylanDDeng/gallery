export function isPhoneAuthEnabled(): boolean {
  return process.env.NEXT_PUBLIC_PHONE_AUTH_ENABLED === "true";
}
