import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabase = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * DELETE /api/admin/cleanup-orphans
 *
 * Two-pass cleanup for gallery_dl image_assets:
 *   1. Assets with no collection_assets entry (orphaned from deleted collections)
 *   2. Assets whose main storage file is missing (storage deleted, DB record left behind)
 * Uploaded assets (source_type = "upload") are never touched.
 */
export async function DELETE() {
  try {
    const { data: galleryAssets, error } = await supabase
      .from("image_assets")
      .select("id, storage_path")
      .eq("source_type", "gallery_dl");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!galleryAssets || galleryAssets.length === 0)
      return NextResponse.json({ deleted: 0 });

    const allIds = galleryAssets.map((a) => a.id);

    // Pass 1: no collection_assets entry
    const { data: linked } = await supabase
      .from("collection_assets")
      .select("asset_id")
      .in("asset_id", allIds);
    const linkedIds = new Set(linked?.map((l) => l.asset_id) ?? []);
    const orphanIds = new Set(
      galleryAssets.filter((a) => !linkedIds.has(a.id)).map((a) => a.id)
    );

    // Pass 2: storage file missing (HEAD the public URL)
    const CONCURRENCY = 20;
    const brokenIds = new Set<string>();
    for (let i = 0; i < galleryAssets.length; i += CONCURRENCY) {
      const batch = galleryAssets.slice(i, i + CONCURRENCY);
      await Promise.all(
        batch.map(async (a) => {
          const publicUrl = `${supabaseUrl}/storage/v1/object/public/image_assets/${a.storage_path}`;
          try {
            const res = await fetch(publicUrl, { method: "HEAD" });
            if (!res.ok) brokenIds.add(a.id);
          } catch {
            brokenIds.add(a.id);
          }
        })
      );
    }

    // Union: all assets to remove
    const toDelete = [...new Set([...orphanIds, ...brokenIds])];
    if (toDelete.length === 0) return NextResponse.json({ deleted: 0 });

    const toDeleteAssets = galleryAssets.filter((a) => toDelete.includes(a.id));
    const mainPaths = toDeleteAssets.map((a) => a.storage_path);
    const thumbPaths = toDeleteAssets.map((a) =>
      a.storage_path.replace(/(\.[^./]+)$/, "_thumb$1")
    );

    await Promise.all([
      supabase.storage.from("image_assets").remove(mainPaths),
      supabase.storage.from("image_thumbs").remove(thumbPaths),
    ]);

    await supabase.from("collection_assets").delete().in("asset_id", toDelete);
    await supabase.from("image_assets").delete().in("id", toDelete);

    return NextResponse.json({
      deleted: toDelete.length,
      orphaned: orphanIds.size,
      broken_storage: brokenIds.size,
    });
  } catch (err) {
    console.error("cleanup-orphans error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
