import { cn } from "@/lib/utils";
import type { ImageSize } from "./view-options";

const skeletonGridClasses: Record<ImageSize, string> = {
  small: "grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10",
  medium: "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6",
  large: "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
};

/** Shimmering placeholder grid shown during a cold gallery load. Each tile
 *  carries a staggered gradient sheen (see .skeleton-tile in globals.css). */
export function GallerySkeleton({
  imageSize = "medium",
  count = 12,
}: {
  imageSize?: ImageSize;
  count?: number;
}) {
  return (
    <div className={cn("grid gap-3", skeletonGridClasses[imageSize])}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="skeleton-tile aspect-square rounded-xl"
          style={{ "--sheen-delay": `${i * 60}ms` } as React.CSSProperties}
        />
      ))}
    </div>
  );
}
