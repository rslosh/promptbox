/**
 * The tagging config (Gemini key, per-pass prompts, per-pass models) lives in
 * the browser's localStorage, so server routes can't read it. Every client that
 * kicks off tagging must forward it explicitly — otherwise the server silently
 * falls back to its built-in defaults (Flash + the stock prompts), which
 * produces different, lower-quality output than the image page's "Regenerate".
 *
 * Shape matches the `tagSettings` body field accepted by /api/collections/[id]/sync
 * and /api/gallery-dl.
 */
export type TagSettings = {
  apiKey?: string;
  visionPrompt?: string | null;
  prosePrompt?: string | null;
  scenePrompt?: string | null;
  visionModel?: string | null;
  proseModel?: string | null;
  sceneModel?: string | null;
};

const SETTINGS_KEY = "promptbox_settings";

/** Reads the user's saved tagging settings. Returns {} if unset or unreadable. */
export function readTagSettings(): TagSettings {
  if (typeof window === "undefined") return {};
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (!stored) return {};
    const s = JSON.parse(stored);
    return {
      apiKey: s.geminiApiKey || undefined,
      visionPrompt: s.geminiSystemPrompt,
      prosePrompt: s.geminiProsePrompt,
      scenePrompt: s.geminiScenePrompt,
      visionModel: s.visionModel,
      proseModel: s.proseModel,
      sceneModel: s.sceneModel,
    };
  } catch {
    return {};
  }
}
