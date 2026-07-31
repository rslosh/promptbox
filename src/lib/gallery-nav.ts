// Ordered entries of the most recently rendered gallery grid.
// The lightbox reads this to know its prev/next neighbors AND each
// image's storage path — so it can paint the (already-cached) thumbnail
// immediately instead of round-tripping to the DB first.
export interface GalleryNavEntry {
  id: string;
  storagePath: string;
}

let entries: GalleryNavEntry[] = [];

export function setGalleryNav(next: GalleryNavEntry[]) {
  entries = next;
}

export function getGalleryNav(): GalleryNavEntry[] {
  return entries;
}
