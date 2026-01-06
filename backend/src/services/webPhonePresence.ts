type PresenceKey = string;

type PresenceValue = {
  ready: boolean;
  updatedAt: number;
};

const presence = new Map<PresenceKey, PresenceValue>();

const keyFor = (tenantId: string, userId: string): PresenceKey =>
  `${tenantId}:${userId}`;

export function setWebPhoneReady(input: {
  tenantId: string;
  userId: string;
  ready: boolean;
}) {
  if (!input.tenantId || !input.userId) return;
  presence.set(keyFor(input.tenantId, input.userId), {
    ready: Boolean(input.ready),
    updatedAt: Date.now(),
  });
}

export function isWebPhoneReady(input: {
  tenantId: string;
  userId: string;
}): boolean {
  const v = presence.get(keyFor(input.tenantId, input.userId));
  return Boolean(v?.ready);
}

export function clearWebPhonePresence(input: {
  tenantId: string;
  userId: string;
}) {
  if (!input.tenantId || !input.userId) return;
  presence.delete(keyFor(input.tenantId, input.userId));
}

export function getWebPhonePresenceSnapshot(
  tenantId: string
): Array<{ userId: string; ready: boolean; updatedAt: number }> {
  const out: Array<{ userId: string; ready: boolean; updatedAt: number }> = [];
  for (const [k, v] of presence.entries()) {
    if (!k.startsWith(`${tenantId}:`)) continue;
    const userId = k.slice(`${tenantId}:`.length);
    out.push({ userId, ready: v.ready, updatedAt: v.updatedAt });
  }
  return out;
}
