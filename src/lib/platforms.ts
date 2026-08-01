// Shared metadata for collection source platforms — icon, display label, and
// the order platform groups appear in the sidebar. Keep this the single source
// of truth so the sidebar, filters, and any future UI stay consistent.

export type Platform =
  | "cosmos"
  | "midjourney"
  | "pinterest"
  | "are_na"
  | "tumblr"
  | "shotdeck"
  | "manual";

export interface PlatformMeta {
  label: string;
  icon: string; // emoji
}

// Insertion order here is the display order of platform groups in the sidebar.
export const PLATFORMS: Record<Platform, PlatformMeta> = {
  cosmos: { label: "Cosmos", icon: "🌌" },
  midjourney: { label: "Midjourney", icon: "🚢" },
  pinterest: { label: "Pinterest", icon: "📌" },
  are_na: { label: "Are.na", icon: "🔲" },
  tumblr: { label: "Tumblr", icon: "📝" },
  shotdeck: { label: "Shotdeck", icon: "🎬" },
  manual: { label: "Manual", icon: "📁" },
};

export const PLATFORM_ORDER = Object.keys(PLATFORMS) as Platform[];

// Platforms whose remote source exposes a cheap, accurate image total, so we
// can show a real "+N pending" badge. Others only get staleness ("synced Xd
// ago"). Note: Are.na is intentionally excluded — its API's cheap `length`
// counts ALL blocks (text/links/images), not images, so it would mislead.
export const COUNTABLE_PLATFORMS: ReadonlySet<Platform> = new Set<Platform>([
  "cosmos",
]);

export function platformMeta(platform: string): PlatformMeta {
  return PLATFORMS[platform as Platform] ?? { label: platform, icon: "📁" };
}
