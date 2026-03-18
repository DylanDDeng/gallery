import { createHmac, timingSafeEqual } from "crypto";

const PADDLE_API_BASE_URL = "https://api.paddle.com";

interface PaddleApiError {
  error?: {
    code?: string;
    detail?: string;
    type?: string;
  };
}

interface PaddleTransactionResponse {
  data?: {
    id?: string;
    status?: string;
  };
}

export interface PaddleWebhookEvent<T = Record<string, unknown>> {
  event_id: string;
  event_type: string;
  occurred_at: string;
  notification_id?: string;
  data: T;
}

export interface PaddleTransactionData {
  id: string;
  status: string;
  custom_data?: Record<string, unknown> | null;
}

interface CreatePaddleTransactionInput {
  priceId: string;
  orderId: string;
  userId: string;
  packageId: string;
  credits: number;
  checkoutPageUrl: string;
}

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name} environment variable`);
  }
  return value;
}

async function getErrorMessage(response: Response) {
  try {
    const json = (await response.json()) as PaddleApiError;
    return (
      json.error?.detail ||
      json.error?.code ||
      json.error?.type ||
      `Paddle API request failed with ${response.status}`
    );
  } catch {
    return `Paddle API request failed with ${response.status}`;
  }
}

export async function createPaddleTransaction(
  input: CreatePaddleTransactionInput
) {
  const apiKey = getRequiredEnv("PADDLE_API_KEY");

  const response = await fetch(`${PADDLE_API_BASE_URL}/transactions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      items: [
        {
          price_id: input.priceId,
          quantity: 1,
        },
      ],
      collection_mode: "automatic",
      checkout: {
        url: input.checkoutPageUrl,
      },
      custom_data: {
        order_id: input.orderId,
        user_id: input.userId,
        package_id: input.packageId,
        credits: input.credits,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  const json = (await response.json()) as PaddleTransactionResponse;
  const transactionId = json.data?.id;

  if (!transactionId) {
    throw new Error("Paddle transaction response did not include an id");
  }

  return {
    transactionId,
    checkoutUrl: `${input.checkoutPageUrl}?_ptxn=${encodeURIComponent(transactionId)}`,
  };
}

export function verifyPaddleWebhookSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string,
  toleranceSeconds = 300
) {
  const segments = signatureHeader.split(";");
  const signatures: string[] = [];
  let timestamp: string | null = null;

  for (const segment of segments) {
    const [key, value] = segment.split("=");
    if (!key || !value) {
      continue;
    }

    if (key === "ts") {
      timestamp = value;
      continue;
    }

    if (key === "h1") {
      signatures.push(value);
    }
  }

  if (!timestamp || signatures.length === 0) {
    return false;
  }

  const timestampNumber = Number(timestamp);
  if (!Number.isFinite(timestampNumber)) {
    return false;
  }

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestampNumber) > toleranceSeconds) {
    return false;
  }

  const payload = `${timestamp}:${rawBody}`;
  const expectedSignature = createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
  const expectedBuffer = Buffer.from(expectedSignature, "hex");

  return signatures.some((signature) => {
    try {
      const signatureBuffer = Buffer.from(signature, "hex");

      if (signatureBuffer.length !== expectedBuffer.length) {
        return false;
      }

      return timingSafeEqual(signatureBuffer, expectedBuffer);
    } catch {
      return false;
    }
  });
}

export function isPaddleSandbox() {
  const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN || "";
  return token.startsWith("test_");
}
