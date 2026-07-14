export type PhoneAuthFlow = "login" | "phone_change";

export function getPhoneAuthFlow(userId: string | null | undefined): PhoneAuthFlow {
  return userId ? "phone_change" : "login";
}

export function getPhoneVerifyType(flow: PhoneAuthFlow): "sms" | "phone_change" {
  return flow === "login" ? "sms" : "phone_change";
}

export function canRequestLoginOtp(userId: string | null | undefined): boolean {
  return getPhoneAuthFlow(userId) === "login";
}
