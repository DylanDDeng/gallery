import { createHmac, randomUUID } from "node:crypto";
import { toMainlandNationalPhone } from "./phone.ts";

const ALIYUN_SMS_ENDPOINT = "https://dysmsapi.aliyuncs.com/";
const ALIYUN_SMS_API_VERSION = "2017-05-25";

export type AliyunSmsConfig = {
  accessKeyId: string;
  accessKeySecret: string;
  region: string;
  signName: string;
  templateCode: string;
  templateParam: string;
  timeoutMs?: number;
};

export type AliyunSmsResult = {
  ok: boolean;
  code: string;
  message?: string;
  requestId?: string;
  bizId?: string;
};

export class AliyunSmsUnknownResultError extends Error {
  constructor(message = "Alibaba Cloud SMS result is unknown") {
    super(message);
    this.name = "AliyunSmsUnknownResultError";
  }
}

function percentEncode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

export function buildAliyunSmsRequest(
  config: AliyunSmsConfig,
  phone: string,
  otp: string,
  now = new Date(),
  nonce = randomUUID(),
): { url: string; body: string } {
  const nationalPhone = toMainlandNationalPhone(phone);
  if (!nationalPhone) {
    throw new Error("Only mainland China phone numbers are supported");
  }

  const parameters: Record<string, string> = {
    AccessKeyId: config.accessKeyId,
    Action: "SendSms",
    Format: "JSON",
    PhoneNumbers: nationalPhone,
    RegionId: config.region,
    SignatureMethod: "HMAC-SHA1",
    SignatureNonce: nonce,
    SignatureVersion: "1.0",
    SignName: config.signName,
    TemplateCode: config.templateCode,
    TemplateParam: JSON.stringify({ [config.templateParam]: otp }),
    Timestamp: now.toISOString().replace(/\.\d{3}Z$/, "Z"),
    Version: ALIYUN_SMS_API_VERSION,
  };

  const canonicalQuery = Object.keys(parameters)
    .sort()
    .map((key) => `${percentEncode(key)}=${percentEncode(parameters[key])}`)
    .join("&");
  const stringToSign = `POST&${percentEncode("/")}&${percentEncode(canonicalQuery)}`;
  const signature = createHmac("sha1", `${config.accessKeySecret}&`)
    .update(stringToSign)
    .digest("base64");

  return {
    url: ALIYUN_SMS_ENDPOINT,
    body: `Signature=${percentEncode(signature)}&${canonicalQuery}`,
  };
}

type FetchLike = typeof fetch;

export async function sendAliyunSms(
  config: AliyunSmsConfig,
  phone: string,
  otp: string,
  fetchImpl: FetchLike = fetch,
): Promise<AliyunSmsResult> {
  const request = buildAliyunSmsRequest(config, phone, otp);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs ?? 2_800);

  let response: Response;
  try {
    response = await fetchImpl(request.url, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: request.body,
      signal: controller.signal,
      cache: "no-store",
    });
  } catch {
    throw new AliyunSmsUnknownResultError();
  } finally {
    clearTimeout(timer);
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await response.json()) as Record<string, unknown>;
  } catch {
    throw new AliyunSmsUnknownResultError("Alibaba Cloud SMS returned an unreadable response");
  }

  const code = typeof payload.Code === "string" ? payload.Code : `HTTP_${response.status}`;
  const result: AliyunSmsResult = {
    ok: response.ok && code === "OK",
    code,
  };
  if (typeof payload.Message === "string") result.message = payload.Message;
  if (typeof payload.RequestId === "string") result.requestId = payload.RequestId;
  if (typeof payload.BizId === "string") result.bizId = payload.BizId;
  return result;
}
