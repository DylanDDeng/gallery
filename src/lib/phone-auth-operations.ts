import type { PhoneAuthFlow } from "./phone-auth-flow.ts";

export type PhoneAuthSessionErrorCode = "signed_in" | "signed_out" | "user_changed";

export class PhoneAuthSessionError extends Error {
  readonly code: PhoneAuthSessionErrorCode;

  constructor(code: PhoneAuthSessionErrorCode) {
    super(code);
    this.code = code;
    this.name = "PhoneAuthSessionError";
  }
}

type GetUserId = () => Promise<string | null>;

export async function requestPhoneOtpOperation(input: {
  flow: PhoneAuthFlow;
  expectedUserId?: string | null;
  getUserId: GetUserId;
  signInWithOtp: () => Promise<void>;
  updatePhone: () => Promise<void>;
}): Promise<string | null> {
  const actualUserId = await input.getUserId();

  if (input.flow === "login") {
    if (actualUserId) throw new PhoneAuthSessionError("signed_in");
    await input.signInWithOtp();
    return null;
  }

  if (!actualUserId) throw new PhoneAuthSessionError("signed_out");
  if (!input.expectedUserId || actualUserId !== input.expectedUserId) {
    throw new PhoneAuthSessionError("user_changed");
  }
  await input.updatePhone();
  return actualUserId;
}

export async function verifyPhoneOtpOperation<TUser extends { id: string }>(input: {
  flow: PhoneAuthFlow;
  expectedUserId?: string | null;
  getUserId: GetUserId;
  verifyOtp: () => Promise<TUser | null>;
  signOut: () => Promise<void>;
}): Promise<TUser | null> {
  const actualUserId = await input.getUserId();

  if (input.flow === "login") {
    if (actualUserId) throw new PhoneAuthSessionError("signed_in");
    return input.verifyOtp();
  }

  if (!actualUserId) throw new PhoneAuthSessionError("signed_out");
  if (!input.expectedUserId || actualUserId !== input.expectedUserId) {
    throw new PhoneAuthSessionError("user_changed");
  }

  const verifiedUser = await input.verifyOtp();
  if (!verifiedUser || verifiedUser.id !== input.expectedUserId) {
    await input.signOut();
    throw new PhoneAuthSessionError("user_changed");
  }
  return verifiedUser;
}
