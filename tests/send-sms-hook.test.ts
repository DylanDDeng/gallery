import assert from "node:assert/strict";
import test from "node:test";
import { Webhook } from "standardwebhooks";
import {
  MAX_SEND_SMS_HOOK_BYTES,
  parseWebhookSecrets,
  parseSendSmsPayload,
  processSendSmsWebhook,
  type SmsDeliveryRepository,
} from "../src/lib/send-sms-hook.ts";

const rawSecret = Buffer.from("a-secret-long-enough-for-standard-webhooks").toString("base64");
const secret = `whsec_${rawSecret}`;
const auditHmacKey = "audit-key-with-at-least-thirty-two-characters";

function signedRequest(payload: unknown, webhookId = "msg_test") {
  const rawBody = JSON.stringify(payload);
  const now = new Date();
  return {
    rawBody,
    headers: {
      "webhook-id": webhookId,
      "webhook-timestamp": String(Math.floor(now.getTime() / 1000)),
      "webhook-signature": new Webhook(secret).sign(webhookId, now, rawBody),
    },
  };
}

function createRepository(
  reservation:
    | { outcome: "reserved" }
    | { outcome: "duplicate"; status: "pre_send" | "provider_attempted" | "completed" | "failed" }
    | { outcome: "rate_limited" } = { outcome: "reserved" },
) {
  const calls: string[] = [];
  const repository: SmsDeliveryRepository = {
    async reserve() {
      calls.push("reserve");
      return reservation;
    },
    async complete() {
      calls.push("completed");
    },
    async fail() {
      calls.push("failed");
    },
  };
  return { calls, repository };
}

const validPayload = {
  user: { phone: "+8613800138000" },
  sms: { otp: "123456" },
};

test("rejects missing or invalid Standard Webhooks signatures", async () => {
  const { repository } = createRepository();
  const result = await processSendSmsWebhook({
    rawBody: JSON.stringify(validPayload),
    headers: {
      "webhook-id": "msg_test",
      "webhook-timestamp": String(Math.floor(Date.now() / 1000)),
      "webhook-signature": "v1,invalid",
    },
    secrets: [secret],
    auditHmacKey,
    repository,
    sendSms: async () => ({ ok: true, code: "OK" }),
  });
  assert.deepEqual(result, { status: 401, body: { error: "invalid_signature" } });
});

test("accepts rotated Supabase hook secret formatting", () => {
  assert.deepEqual(parseWebhookSecrets(`v1,${secret}|${secret};\n${secret}`), [
    secret,
    secret,
    secret,
  ]);
});

test("returns a payload error for signed malformed JSON", async () => {
  const { repository } = createRepository();
  const rawBody = "{";
  const now = new Date();
  const headers = {
    "webhook-id": "msg_malformed",
    "webhook-timestamp": String(Math.floor(now.getTime() / 1000)),
    "webhook-signature": new Webhook(secret).sign("msg_malformed", now, rawBody),
  };
  const result = await processSendSmsWebhook({
    rawBody,
    headers,
    secrets: [secret],
    auditHmacKey,
    repository,
    sendSms: async () => ({ ok: true, code: "OK" }),
  });
  assert.equal(result.status, 400);
});

test("rejects malformed, oversized, and non-mainland payloads", async () => {
  const { repository } = createRepository();
  const invalid = signedRequest({ user: { phone: "+14155552671" }, sms: { otp: "123456" } });
  const invalidResult = await processSendSmsWebhook({
    ...invalid,
    secrets: [secret],
    auditHmacKey,
    repository,
    sendSms: async () => ({ ok: true, code: "OK" }),
  });
  assert.equal(invalidResult.status, 400);
  assert.equal(parseSendSmsPayload({ user: {}, sms: {} }), null);
  assert.equal(
    parseSendSmsPayload({ user: { phone: "+8613800138000" }, sms: { otp: "1234" } }),
    null,
  );

  const oversized = await processSendSmsWebhook({
    rawBody: "x".repeat(MAX_SEND_SMS_HOOK_BYTES + 1),
    headers: invalid.headers,
    secrets: [secret],
    auditHmacKey,
    repository,
    sendSms: async () => ({ ok: true, code: "OK" }),
  });
  assert.equal(oversized.status, 413);
});

test("accepts the current Supabase payload with the destination in sms.phone", () => {
  assert.deepEqual(
    parseSendSmsPayload({
      user: {},
      sms: { phone: "8613800138000", otp: "123456" },
    }),
    {
      user: { phone: "+8613800138000" },
      sms: { otp: "123456" },
    },
  );
});

test("prefers sms.phone for phone changes and normalizes the destination", () => {
  assert.deepEqual(
    parseSendSmsPayload({
      user: { phone: "+8613900139000" },
      sms: { phone: "8613800138000", otp: "123456" },
    }),
    {
      user: { phone: "+8613800138000" },
      sms: { otp: "123456" },
    },
  );
});

test("reserves the webhook before one provider call and records success", async () => {
  const { calls, repository } = createRepository();
  let providerCalls = 0;
  const result = await processSendSmsWebhook({
    ...signedRequest(validPayload),
    secrets: [`v1,${secret}`],
    auditHmacKey,
    repository,
    sendSms: async () => {
      providerCalls += 1;
      return { ok: true, code: "OK", requestId: "req-1" };
    },
  });
  assert.equal(result.status, 200);
  assert.equal(providerCalls, 1);
  assert.deepEqual(calls, ["reserve", "completed"]);
});

test("does not call Alibaba Cloud for a duplicate webhook", async () => {
  const { calls, repository } = createRepository({
    outcome: "duplicate",
    status: "provider_attempted",
  });
  let providerCalls = 0;
  const result = await processSendSmsWebhook({
    ...signedRequest(validPayload),
    secrets: [secret],
    auditHmacKey,
    repository,
    sendSms: async () => {
      providerCalls += 1;
      return { ok: true, code: "OK" };
    },
  });
  assert.equal(result.status, 200);
  assert.equal(providerCalls, 0);
  assert.deepEqual(calls, ["reserve"]);
});

test("rejects a phone rate limit before calling Alibaba Cloud", async () => {
  const { calls, repository } = createRepository({ outcome: "rate_limited" });
  let providerCalls = 0;
  const result = await processSendSmsWebhook({
    ...signedRequest(validPayload),
    secrets: [secret],
    auditHmacKey,
    repository,
    sendSms: async () => {
      providerCalls += 1;
      return { ok: true, code: "OK" };
    },
  });
  assert.equal(result.status, 400);
  assert.equal(providerCalls, 0);
  assert.deepEqual(calls, ["reserve"]);
});

test("returns success when Alibaba succeeds even if audit completion fails", async () => {
  const { repository } = createRepository();
  repository.complete = async () => {
    throw new Error("audit database unavailable");
  };
  const result = await processSendSmsWebhook({
    ...signedRequest(validPayload),
    secrets: [secret],
    auditHmacKey,
    repository,
    sendSms: async () => ({ ok: true, code: "OK" }),
    auditWriteTimeoutMs: 5,
  });
  assert.equal(result.status, 200);
});

test("records provider rejection without a retryable response", async () => {
  const { calls, repository } = createRepository();
  const result = await processSendSmsWebhook({
    ...signedRequest(validPayload),
    secrets: [secret],
    auditHmacKey,
    repository,
    sendSms: async () => ({ ok: false, code: "isv.BUSINESS_LIMIT_CONTROL" }),
  });
  assert.equal(result.status, 502);
  assert.deepEqual(calls, ["reserve", "failed"]);
});

test("marks unknown provider result failed and never returns 429 or 503", async () => {
  const { calls, repository } = createRepository();
  const result = await processSendSmsWebhook({
    ...signedRequest(validPayload),
    secrets: [secret],
    auditHmacKey,
    repository,
    sendSms: async () => {
      throw new Error("timeout after provider call");
    },
  });
  assert.equal(result.status, 504);
  assert.notEqual(result.status, 429);
  assert.notEqual(result.status, 503);
  assert.deepEqual(calls, ["reserve", "failed"]);
});
