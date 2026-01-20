import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Using untyped client to avoid strict type constraints during runtime
// Type safety is still enforced through our own types in @/lib/supabase/types
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export function getStorageUrl(path: string, bucket: string = "image_assets"): string {
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
}

export function getThumbnailUrl(storagePath: string): string {
  // Transform storage path to thumbnail path
  // e.g., "ab/cd/abcd123.jpg" -> "ab/cd/abcd123_thumb.jpg"
  const lastDotIndex = storagePath.lastIndexOf(".");
  if (lastDotIndex === -1) {
    return getStorageUrl(storagePath + "_thumb", "image_thumbs");
  }
  const thumbPath = storagePath.slice(0, lastDotIndex) + "_thumb" + storagePath.slice(lastDotIndex);
  return getStorageUrl(thumbPath, "image_thumbs");
}

export function getImageUrl(storagePath: string): string {
  return getStorageUrl(storagePath, "image_assets");
}

export async function getSignedUrl(
  path: string,
  bucket: string = "image_assets",
  expiresIn: number = 3600
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);

  if (error) {
    console.error("Error creating signed URL:", error);
    return null;
  }

  return data.signedUrl;
}
