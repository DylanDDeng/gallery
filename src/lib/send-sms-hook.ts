import { createHmac } from "node:crypto";
import { Webhook } from "standardwebhooks";
import type { AliyunSmsResult } from "./aliyun-sms.ts";
import { normalizeMainlandPhone } from "./phone.ts";

export const MAX_SEND_SMS_HOOK_BYTES = 20 * 1024;

export type SendSmsPayload = {
  user: { phone: string };
  sms: { otp: string };
};

export type DeliveryStatus = "pre_send" | "provider_attempted" | "completed" | "failed";

export type SmsDeliveryReservation =
  | { outcome: "reserved" }
  | { outcome: "duplicate"; status: DeliveryStatus }
  | { outcome: "rate_limited" };

export type SmsDeliveryRepository = {
  reserve(input: { webhookId: string; phoneHash: string }): Promise<SmsDeliveryReservation>;
  complete(webhookId: string, result: AliyunSmsResult): Promise<void>;
  fail(webhookId: string, result?: Partial<AliyunSmsResult>): Promise<void>;
};

export type HookResponse = {
  status: number;
  body: Record<string, string>;
};

class MalformedWebhookPayloadError extends Error {}

function normalizeWebhookSecret(secret: string): string {
  const trimmed = secret.trim();
  return trimmed.startsWith("v1,") ? trimmed.slice(3) : trimmed;
}

export function parseWebhookSecrets(value: string): string[] {
  return value
    .split(/[;|\n]/)
    .map(normalizeWebhookSecret)
    .filter(Boolean);
}

export function verifySendSmsWebhook(
  rawBody: string,
  headers: Record<string, string>,
  secrets: string[],
): unknown {
  if (secrets.length === 0) throw new Error("No webhook secrets configured");

  let lastError: unknown;
  for (const secret of secrets) {
    try {
      return new Webhook(normalizeWebhookSecret(secret)).verify(rawBody, headers);
    } catch (error) {
      if (error instanceof SyntaxError) throw new MalformedWebhookPayloadError();
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Webhook signature rejected");
}

export function parseSendSmsPayload(value: unknown): SendSmsPayload | null {
  if (!value || typeof value !== "object") return null;
  const body = value as { user?: unknown; sms?: unknown };
  if (!body.user || typeof body.user !== "object") return null;
  if (!body.sms || typeof body.sms !== "object") return null;

  const userPhone = (body.user as { phone?: unknown }).phone;
  const sms = body.sms as { otp?: unknown; phone?: unknown };
  const destinationPhone = typeof sms.phone === "string" ? sms.phone : userPhone;
  const phone = typeof destinationPhone === "string"
    ? normalizeMainlandPhone(destinationPhone)
    : null;
  const otp = sms.otp;
  if (!phone) return null;
  if (typeof otp !== "string" || !/^\d{6}$/.test(otp)) return null;
  return { user: { phone }, sms: { otp } };
}

export function hashPhone(phone: string, hmacKey: string): string {
  if (hmacKey.length < 32) throw new Error("SMS_AUDIT_HMAC_KEY must be at least 32 characters");
  return createHmac("sha256", hmacKey).update(phone).digest("hex");
}

async function settleAuditWrite(write: Promise<void>, timeoutMs: number): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      write.catch(() => undefined),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function processSendSmsWebhook(input: {
  rawBody: string;
  headers: Record<string, string>;
  secrets: string[];
  auditHmacKey: string;
  repository: SmsDeliveryRepository;
  sendSms: (phone: string, otp: string) => Promise<AliyunSmsResult>;
  auditWriteTimeoutMs?: number;
}): Promise<HookResponse> {
  if (Buffer.byteLength(input.rawBody, "utf8") > MAX_SEND_SMS_HOOK_BYTES) {
    return { status: 413, body: { error: "payload_too_large" } };
  }

  let verified: unknown;
  try {
    verified = verifySendSmsWebhook(input.rawBody, input.headers, input.secrets);
  } catch (error) {
    if (error instanceof MalformedWebhookPayloadError) {
      return { status: 400, body: { error: "invalid_payload" } };
    }
    return { status: 401, body: { error: "invalid_signature" } };
  }

  const payload = parseSendSmsPayload(verified);
  const webhookId = input.headers["webhook-id"];
  if (!payload || !webhookId) {
    return { status: 400, body: { error: "invalid_payload" } };
  }

  let reservation: SmsDeliveryReservation;
  try {
    reservation = await input.repository.reserve({
      webhookId,
      phoneHash: hashPhone(payload.user.phone, input.auditHmacKey),
    });
  } catch {
    return { status: 503, body: { error: "reservation_unavailable" } };
  }

  if (reservation.outcome === "duplicate") {
    return { status: 200, body: {} };
  }
  if (reservation.outcome === "rate_limited") {
    return { status: 400, body: { error: "phone_rate_limited" } };
  }

  let result: AliyunSmsResult;
  try {
    result = await input.sendSms(payload.user.phone, payload.sms.otp);
  } catch {
    await settleAuditWrite(
      input.repository.fail(webhookId, { code: "UNKNOWN_RESULT" }),
      input.auditWriteTimeoutMs ?? 500,
    );
    return { status: 504, body: { error: "provider_result_unknown" } };
  }

  if (!result.ok || result.code !== "OK") {
    await settleAuditWrite(
      input.repository.fail(webhookId, result),
      input.auditWriteTimeoutMs ?? 500,
    );
    return { status: 502, body: { error: "provider_rejected" } };
  }

  // Delivery success is the source of truth. A non-critical audit failure must
  // never make the client discard an OTP that Alibaba Cloud already accepted.
  await settleAuditWrite(
    input.repository.complete(webhookId, result),
    input.auditWriteTimeoutMs ?? 500,
  );
  return { status: 200, body: {} };
}
