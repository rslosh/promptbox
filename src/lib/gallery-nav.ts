// Ordered image ids of the most recently rendered gallery grid.
// The lightbox reads this to know its prev/next neighbors without
// re-fetching or threading the whole list through the route.
let orderedIds: string[] = [];

export function setGalleryNav(ids: string[]) {
  orderedIds = ids;
}

export function getGalleryNav(): string[] {
  return orderedIds;
}
