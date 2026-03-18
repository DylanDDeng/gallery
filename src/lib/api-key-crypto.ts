import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const ENCRYPTION_PREFIX = "v1";

function getEncryptionKey() {
  const secret = process.env.USER_API_KEYS_ENCRYPTION_KEY;

  if (!secret) {
    throw new Error("Missing USER_API_KEYS_ENCRYPTION_KEY environment variable");
  }

  return createHash("sha256").update(secret).digest();
}

export function encryptApiKey(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return `${ENCRYPTION_PREFIX}:${iv.toString("hex")}:${authTag.toString(
    "hex"
  )}:${ciphertext.toString("hex")}`;
}

export function decryptApiKey(value: string) {
  if (!value.startsWith(`${ENCRYPTION_PREFIX}:`)) {
    return Buffer.from(value, "base64").toString("utf-8");
  }

  const [, ivHex, authTagHex, ciphertextHex] = value.split(":");

  if (!ivHex || !authTagHex || !ciphertextHex) {
    throw new Error("Invalid encrypted API key payload");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(ivHex, "hex")
  );

  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextHex, "hex")),
    decipher.final(),
  ]);

  return plaintext.toString("utf-8");
}
