export async function readResponseBodyWithLimit(
  response: Response,
  maxBytes: number
): Promise<ArrayBuffer> {
  const body = response.body;
  if (!body) {
    throw new Error("Failed to read response body");
  }

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        throw new Error("Reference image is too large");
      }

      chunks.push(value);
    }
  } catch (error) {
    try {
      await reader.cancel();
    } catch {
      // Ignore cancellation errors.
    }
    throw error;
  }

  const merged = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return merged.buffer;
}
