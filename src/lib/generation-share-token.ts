import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_VERSION = 1;
const TOKEN_CONTEXT = "aestara:generation-share:";
const MAX_TOKEN_LENGTH = 1024;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ShareTokenPayload = {
  v: number;
  id: string;
};

function createSignature(payload: string, secret: string) {
  return createHmac("sha256", secret)
    .update(`${TOKEN_CONTEXT}${payload}`)
    .digest("base64url");
}

export function createGenerationShareToken(taskId: string, secret: string) {
  if (!UUID_PATTERN.test(taskId)) {
    throw new Error("Invalid generation task id");
  }

  if (!secret) {
    throw new Error("Generation share secret is not configured");
  }

  const payload = Buffer.from(
    JSON.stringify({ v: TOKEN_VERSION, id: taskId } satisfies ShareTokenPayload),
  ).toString("base64url");
  const signature = createSignature(payload, secret);

  return `${payload}.${signature}`;
}

export function readGenerationShareToken(token: string, secret: string) {
  if (!token || token.length > MAX_TOKEN_LENGTH || !secret) {
    return null;
  }

  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return null;
  }

  const [payload, signature] = parts;
  const expectedSignature = createSignature(payload, secret);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as Partial<ShareTokenPayload>;

    if (parsed.v !== TOKEN_VERSION || !parsed.id || !UUID_PATTERN.test(parsed.id)) {
      return null;
    }

    return parsed.id;
  } catch {
    return null;
  }
}
