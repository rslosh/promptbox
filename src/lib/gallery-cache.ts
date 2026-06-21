import type { ImageAsset, AssetTag, Prompt, Collection } from "@/lib/supabase/types";

export interface ImageWithDetails extends ImageAsset {
  tags?: AssetTag[];
  prompts?: Prompt[];
}

export interface GalleryFilters {
  selectedTags: string[];
  selectedCollections: string[];
  sourceFilter: "all" | "upload" | "gallery_dl";
  sortBy: "newest" | "oldest";
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
};

export function getGalleryCache(): GalleryCacheState {
  return cache;
}

export function updateGalleryCache(patch: Partial<GalleryCacheState>): void {
  Object.assign(cache, patch);
}

export function setGalleryScroll(y: number): void {
  cache.scrollY = y;
}
