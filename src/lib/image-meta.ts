import sharp from "sharp";

// Server-only image metadata helpers. Kept out of tagger.ts because that module
// is imported by client components and sharp is a native Node addon.

export interface ImageDimensions {
  width: number;
  height: number;
}

// Read real pixel dimensions from an image buffer. Returns 0×0 on failure so
// callers can store a sentinel rather than throw.
export async function getImageDimensions(buffer: Buffer): Promise<ImageDimensions> {
  try {
    const m = await sharp(buffer).metadata();
    return { width: m.width ?? 0, height: m.height ?? 0 };
  } catch {
    return { width: 0, height: 0 };
  }
}
