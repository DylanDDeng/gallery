import assert from "node:assert/strict";
import test from "node:test";
import {
  isMainlandPhone,
  maskPhone,
  normalizeMainlandPhone,
  toMainlandNationalPhone,
} from "../src/lib/phone.ts";
import {
  canRequestLoginOtp,
  getPhoneAuthFlow,
  getPhoneVerifyType,
} from "../src/lib/phone-auth-flow.ts";
import {
  PhoneAuthSessionError,
  requestPhoneOtpOperation,
  verifyPhoneOtpOperation,
} from "../src/lib/phone-auth-operations.ts";

test("normalizes supported mainland mobile formats to E.164", () => {
  assert.equal(normalizeMainlandPhone("138 0013 8000"), "+8613800138000");
  assert.equal(normalizeMainlandPhone("+86 138-0013-8000"), "+8613800138000");
  assert.equal(normalizeMainlandPhone("008613800138000"), "+8613800138000");
  assert.equal(normalizeMainlandPhone("8613800138000"), "+8613800138000");
});

test("rejects non-mainland and malformed phone numbers", () => {
  assert.equal(normalizeMainlandPhone("+14155552671"), null);
  assert.equal(normalizeMainlandPhone("12800138000"), null);
  assert.equal(normalizeMainlandPhone("1380013800"), null);
  assert.equal(isMainlandPhone("13800138000"), false);
});

test("masks phone display and converts to Alibaba national format", () => {
  assert.equal(maskPhone("+8613800138000"), "+86 138****8000");
  assert.equal(toMainlandNationalPhone("+8613800138000"), "13800138000");
});

test("keeps signed-out login and signed-in binding flows separate", () => {
  assert.equal(getPhoneAuthFlow(null), "login");
  assert.equal(getPhoneVerifyType("login"), "sms");
  assert.equal(canRequestLoginOtp(null), true);

  assert.equal(getPhoneAuthFlow("existing-user-id"), "phone_change");
  assert.equal(getPhoneVerifyType("phone_change"), "phone_change");
  assert.equal(canRequestLoginOtp("existing-user-id"), false);
});

test("blocks login when the real Supabase session is signed in even if UI state is stale", async () => {
  let signInCalls = 0;
  await assert.rejects(
    requestPhoneOtpOperation({
      flow: "login",
      getUserId: async () => "google-user-id",
      signInWithOtp: async () => {
        signInCalls += 1;
      },
      updatePhone: async () => undefined,
    }),
    (error: unknown) =>
      error instanceof PhoneAuthSessionError && error.code === "signed_in",
  );
  assert.equal(signInCalls, 0);
});

test("binding uses updateUser only when the real Supabase UID is unchanged", async () => {
  let loginCalls = 0;
  let updateCalls = 0;
  const userId = await requestPhoneOtpOperation({
    flow: "phone_change",
    expectedUserId: "google-user-id",
    getUserId: async () => "google-user-id",
    signInWithOtp: async () => {
      loginCalls += 1;
    },
    updatePhone: async () => {
      updateCalls += 1;
    },
  });
  assert.equal(userId, "google-user-id");
  assert.equal(loginCalls, 0);
  assert.equal(updateCalls, 1);
});

test("binding resend rejects when the Supabase session changes users", async () => {
  let activeUserId = "google-user-a";
  let updateCalls = 0;
  const requestOtp = () =>
    requestPhoneOtpOperation({
      flow: "phone_change",
      expectedUserId: "google-user-a",
      getUserId: async () => activeUserId,
      signInWithOtp: async () => undefined,
      updatePhone: async () => {
        updateCalls += 1;
      },
    });

  await requestOtp();
  activeUserId = "google-user-b";

  await assert.rejects(
    requestOtp(),
    (error: unknown) =>
      error instanceof PhoneAuthSessionError && error.code === "user_changed",
  );
  assert.equal(updateCalls, 1);
});

test("binding rejects requests without the user ID fixed at form creation", async () => {
  let updateCalls = 0;
  await assert.rejects(
    requestPhoneOtpOperation({
      flow: "phone_change",
      getUserId: async () => "google-user-id",
      signInWithOtp: async () => undefined,
      updatePhone: async () => {
        updateCalls += 1;
      },
    }),
    (error: unknown) =>
      error instanceof PhoneAuthSessionError && error.code === "user_changed",
  );
  assert.equal(updateCalls, 0);
});

test("binding verification signs out if Supabase returns a different UID", async () => {
  let signOutCalls = 0;
  await assert.rejects(
    verifyPhoneOtpOperation({
      flow: "phone_change",
      expectedUserId: "google-user-id",
      getUserId: async () => "google-user-id",
      verifyOtp: async () => ({ id: "unexpected-user-id" }),
      signOut: async () => {
        signOutCalls += 1;
      },
    }),
    (error: unknown) =>
      error instanceof PhoneAuthSessionError && error.code === "user_changed",
  );
  assert.equal(signOutCalls, 1);
});
