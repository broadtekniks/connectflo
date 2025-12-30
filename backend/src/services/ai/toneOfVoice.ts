export const DEFAULT_TONE_OF_VOICE = "Friendly & Casual" as const;

export const TONE_OF_VOICE_OPTIONS = [
  "Friendly & Casual",
  "Professional & Formal",
  "Empathetic & Calm",
  "Technical & Precise",
] as const;

export type ToneOfVoice = (typeof TONE_OF_VOICE_OPTIONS)[number];

export function normalizeToneOfVoice(
  toneOfVoice?: string | null
): ToneOfVoice | undefined {
  const candidate = (toneOfVoice ?? "").trim();
  if (!candidate) return undefined;
  return (TONE_OF_VOICE_OPTIONS as readonly string[]).includes(candidate)
    ? (candidate as ToneOfVoice)
    : undefined;
}

export function applyToneOfVoiceToSystemPrompt(
  systemPrompt: string,
  toneOfVoice?: string | null
): string {
  const normalized = normalizeToneOfVoice(toneOfVoice);
  if (!normalized) return systemPrompt;

  const guidance = (() => {
    switch (normalized) {
      case "Professional & Formal":
        return "Use a professional, formal tone. Be polite, structured, and avoid slang.";
      case "Empathetic & Calm":
        return "Use an empathetic, calm tone. Acknowledge feelings, reassure, and be gentle.";
      case "Technical & Precise":
        return "Use a technical, precise tone. Be concise, accurate, and provide step-by-step guidance when helpful.";
      case "Friendly & Casual":
      default:
        return "Use a friendly, casual tone. Be warm, conversational, and approachable.";
    }
  })();

  return `${systemPrompt}\n\nTone of Voice: ${normalized}. ${guidance}`;
}
