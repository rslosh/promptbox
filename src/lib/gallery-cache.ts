import type { ImageAsset, AssetTag, Prompt, Collection } from "@/lib/supabase/types";

export interface ImageWithDetails extends ImageAsset {
  tags?: AssetTag[];
  prompts?: Prompt[];
}

export type SortBy = "newest" | "oldest" | "random";

export interface GalleryFilters {
  selectedTags: string[];
  selectedCollections: string[];
  sourceFilter: "all" | "upload" | "gallery_dl";
  sortBy: SortBy;
}

interface GalleryCacheState {
  // `null` means "never loaded this session" — distinguishes a cold start
  // (show skeleton) from a genuinely empty result (show empty state).
  images: ImageWithDetails[] | null;
  allImagesCount: number;
  tags: string[];
  collections: Collection[];
  filters: GalleryFilters;
  scrollY: number;
  // Stable per-image random sort keys for the "random" sort. Persisted so the
  // shuffle order survives navigation (open an image and back) and background
  // revalidates, instead of reshuffling on every fetch. Cleared to reshuffle.
  randomKeys: Record<string, number>;
}

export const DEFAULT_FILTERS: GalleryFilters = {
  selectedTags: [],
  selectedCollections: [],
  sourceFilter: "all",
  sortBy: "newest",
};

// Lives at module scope so it survives client-side route changes — the JS
// module graph persists across soft navigations (e.g. opening an image and
// pressing back), but is cleared on a hard reload. This lets the gallery
// re-render instantly from memory on return, so scroll restoration works.
const cache: GalleryCacheState = {
  images: null,
  allImagesCount: 0,
  tags: [],
  collections: [],
  filters: DEFAULT_FILTERS,
  scrollY: 0,
  randomKeys: {},
};

export function getGalleryCache(): GalleryCacheState {
  return cache;
}

// Drop all random sort keys so the next "random" fetch reshuffles from scratch.
export function clearGalleryRandom(): void {
  cache.randomKeys = {};
}

export function updateGalleryCache(patch: Partial<GalleryCacheState>): void {
  Object.assign(cache, patch);
}

export function setGalleryScroll(y: number): void {
  cache.scrollY = y;
}
