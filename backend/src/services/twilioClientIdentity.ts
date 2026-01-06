export function toTwilioClientIdentity(input: {
  tenantId: string;
  userId: string;
}): string {
  const raw = `tenant_${input.tenantId}_user_${input.userId}`;
  // Keep alphanumeric, underscore, and hyphen.
  // UUIDs contain hyphens; preserving them ensures we can parse IDs back out.
  return raw.replace(/[^A-Za-z0-9_-]/g, "_");
}

export function parseTwilioClientIdentity(
  identity: string
): { tenantId: string; userId: string } | null {
  const raw = String(identity || "").trim();
  if (!raw.startsWith("tenant_")) return null;
  const rest = raw.slice("tenant_".length);
  const parts = rest.split("_user_");
  if (parts.length !== 2) return null;
  const tenantId = parts[0];
  const userId = parts[1];
  if (!tenantId || !userId) return null;
  return { tenantId, userId };
}
