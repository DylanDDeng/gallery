const MAINLAND_MOBILE_PATTERN = /^1[3-9]\d{9}$/;

export function normalizeMainlandPhone(input: string): string | null {
  const compact = input.trim().replace(/[\s()-]/g, "");
  const national = compact.startsWith("+86")
    ? compact.slice(3)
    : compact.startsWith("0086")
      ? compact.slice(4)
      : compact.startsWith("86") && compact.length === 13
        ? compact.slice(2)
        : compact;

  return MAINLAND_MOBILE_PATTERN.test(national) ? `+86${national}` : null;
}

export function isMainlandPhone(input: string): boolean {
  return normalizeMainlandPhone(input) === input;
}

export function toMainlandNationalPhone(phone: string): string | null {
  return isMainlandPhone(phone) ? phone.slice(3) : null;
}

export function maskPhone(phone: string): string {
  const normalized = normalizeMainlandPhone(phone);
  if (!normalized) return "";
  const national = normalized.slice(3);
  return `+86 ${national.slice(0, 3)}****${national.slice(-4)}`;
}
