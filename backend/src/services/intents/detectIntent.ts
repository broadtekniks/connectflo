export const DEFAULT_INTENT_ID = "general_inquiry";

function normalizeKeywordList(keywords: unknown): string[] {
  if (Array.isArray(keywords)) {
    return keywords
      .map((k) => String(k || "").trim())
      .filter((k) => k.length > 0);
  }

  if (typeof keywords === "string") {
    return keywords
      .split(",")
      .map((k) => k.trim())
      .filter((k) => k.length > 0);
  }

  return [];
}

/**
 * Keyword-based intent detection.
 *
 * - Uses tenant-configured intents from AiConfig.intents.
 * - Returns an intent id string.
 * - Fallback behavior:
 *   1) If "general_inquiry" is enabled, return it.
 *   2) Else return the first enabled intent.
 *   3) Else return "general_inquiry".
 */
export function detectIntentFromConfiguredIntents(
  messageText: string,
  rawIntents: unknown,
  options?: { fallbackIntentId?: string }
): string {
  const fallback = String(
    options?.fallbackIntentId || DEFAULT_INTENT_ID
  ).trim();
  const text = String(messageText || "").toLowerCase();

  if (!Array.isArray(rawIntents)) return fallback;

  const intents = rawIntents
    .map((intent: any) => {
      const id = String(intent?.id || intent?.name || "").trim();
      const enabled = intent?.enabled !== false;
      const keywords = normalizeKeywordList(intent?.keywords);
      return { id, enabled, keywords };
    })
    .filter((i) => i.enabled && i.id.length > 0);

  for (const intent of intents) {
    for (const keyword of intent.keywords) {
      const kw = keyword.toLowerCase();
      if (kw && text.includes(kw)) {
        return intent.id;
      }
    }
  }

  const general = intents.find((i) => i.id === fallback);
  if (general) return fallback;
  return intents[0]?.id || fallback;
}
