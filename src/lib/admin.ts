function normalizeEmail(value: string) {
  return value
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim()
    .replace(/^['"]+|['"]+$/g, "")
    .trim()
    .toLowerCase();
}

export function getAdminEmails() {
  return (process.env.ADMIN_EMAILS || "")
    .split(/[,\n;]+/)
    .map((email) => normalizeEmail(email))
    .filter(Boolean);
}

export function isAdminEmail(email?: string | null) {
  if (!email) return false;
  return getAdminEmails().includes(normalizeEmail(email));
}

export function getAdminDebugInfo(email?: string | null) {
  const raw = process.env.ADMIN_EMAILS || "";
  const parsed = getAdminEmails();
  const normalizedEmail = email ? normalizeEmail(email) : null;

  return {
    userEmail: email || null,
    normalizedUserEmail: normalizedEmail,
    rawAdminEmails: raw,
    rawLength: raw.length,
    parsedAdminEmails: parsed,
    parsedCount: parsed.length,
    isMatch: normalizedEmail ? parsed.includes(normalizedEmail) : false,
  };
}
