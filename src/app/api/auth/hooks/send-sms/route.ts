import { NextResponse } from "next/server";
import { sendAliyunSms, type AliyunSmsConfig } from "@/lib/aliyun-sms";
import {
  MAX_SEND_SMS_HOOK_BYTES,
  parseWebhookSecrets,
  processSendSmsWebhook,
  type DeliveryStatus,
  type SmsDeliveryRepository,
} from "@/lib/send-sms-hook";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: Record<string, string>, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function getAliyunConfig(): AliyunSmsConfig {
  return {
    accessKeyId: requireEnv("ALIYUN_ACCESS_KEY_ID"),
    accessKeySecret: requireEnv("ALIYUN_ACCESS_KEY_SECRET"),
    region: process.env.ALIYUN_SMS_REGION?.trim() || "cn-hangzhou",
    signName: requireEnv("ALIYUN_SMS_SIGN_NAME"),
    templateCode: requireEnv("ALIYUN_SMS_TEMPLATE_CODE"),
    templateParam: process.env.ALIYUN_SMS_TEMPLATE_PARAM?.trim() || "code",
    timeoutMs: 2_000,
  };
}

function methodNotAllowed() {
  return json({ error: "method_not_allowed" }, 405);
}

export const GET = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;

const DELIVERY_STATUSES: DeliveryStatus[] = [
  "pre_send",
  "provider_attempted",
  "completed",
  "failed",
];

const repository: SmsDeliveryRepository = {
  async reserve(input) {
    const { data, error } = await supabaseAdmin.rpc("reserve_sms_delivery_attempt", {
      p_webhook_id: input.webhookId,
      p_phone_hash: input.phoneHash,
    });
    if (error) throw error;

    const row = (data as Array<{ outcome?: string; existing_status?: string | null }> | null)?.[0];
    if (row?.outcome === "reserved") return { outcome: "reserved" };
    if (row?.outcome === "rate_limited") return { outcome: "rate_limited" };
    if (
      row?.outcome === "duplicate" &&
      DELIVERY_STATUSES.includes(row.existing_status as DeliveryStatus)
    ) {
      return { outcome: "duplicate", status: row.existing_status as DeliveryStatus };
    }
    throw new Error("Invalid SMS delivery reservation response");
  },
  async complete(webhookId, result) {
    const { error } = await supabaseAdmin
      .from("sms_delivery_attempts")
      .update({
        status: "completed",
        provider_code: result.code,
        provider_request_id: result.requestId ?? null,
        provider_message_id: result.bizId ?? null,
        completed_at: new Date().toISOString(),
      })
      .eq("webhook_id", webhookId);
    if (error) throw error;
  },
  async fail(webhookId, result) {
    const { error } = await supabaseAdmin
      .from("sms_delivery_attempts")
      .update({
        status: "failed",
        provider_code: result?.code ?? null,
        provider_request_id: result?.requestId ?? null,
        failed_at: new Date().toISOString(),
      })
      .eq("webhook_id", webhookId);
    if (error) throw error;
  },
};

async function readRequestBodyWithLimit(
  request: Request,
  maxBytes: number,
): Promise<{ body?: string; tooLarge?: boolean }> {
  if (!request.body) return { body: "" };
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return { tooLarge: true };
      }
      chunks.push(value);
    }
  } catch {
    return {};
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { body: new TextDecoder().decode(merged) };
}

export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return json({ error: "unsupported_media_type" }, 415);
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_SEND_SMS_HOOK_BYTES) {
    return json({ error: "payload_too_large" }, 413);
  }

  let secrets: string[];
  let config: AliyunSmsConfig;
  let auditHmacKey: string;
  try {
    secrets = parseWebhookSecrets(requireEnv("SEND_SMS_HOOK_SECRETS"));
    auditHmacKey = requireEnv("SMS_AUDIT_HMAC_KEY");
    if (auditHmacKey.length < 32) throw new Error("SMS_AUDIT_HMAC_KEY is too short");
    config = getAliyunConfig();
  } catch {
    return json({ error: "hook_not_configured" }, 500);
  }

  const raw = await readRequestBodyWithLimit(request, MAX_SEND_SMS_HOOK_BYTES);
  if (raw.tooLarge) return json({ error: "payload_too_large" }, 413);
  if (raw.body === undefined) return json({ error: "invalid_body" }, 400);

  const headers = {
    "webhook-id": request.headers.get("webhook-id") ?? "",
    "webhook-timestamp": request.headers.get("webhook-timestamp") ?? "",
    "webhook-signature": request.headers.get("webhook-signature") ?? "",
  };

  const result = await processSendSmsWebhook({
    rawBody: raw.body,
    headers,
    secrets,
    auditHmacKey,
    repository,
    sendSms: (phone, otp) => sendAliyunSms(config, phone, otp),
  });
  return json(result.body, result.status);
}
