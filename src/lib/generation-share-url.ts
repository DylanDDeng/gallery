export function buildXShareUrl(shareUrl: string, text: string) {
  const intentUrl = new URL("https://twitter.com/intent/tweet");
  intentUrl.searchParams.set("text", text);
  intentUrl.searchParams.set("url", shareUrl);
  return intentUrl.toString();
}
