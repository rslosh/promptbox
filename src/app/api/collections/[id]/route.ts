import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Try to find by ID first, then by slug
    let query = supabase.from("collections").select("*");
    
    // Check if it's a UUID format
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    
    if (isUuid) {
      query = query.eq("id", id);
    } else {
      query = query.eq("slug", id);
    }

    const { data, error } = await query.single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Collection not found" }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get the images in this collection
    const { data: assets, error: assetsError } = await supabase
      .from("collection_assets")
      .select(`
        position,
        source_item_id,
        asset:image_assets(
          *,
          tags:asset_tags(*),
          prompts:prompts(*)
        )
      `)
      .eq("collection_id", data.id)
      .order("position", { ascending: true });

    if (assetsError) {
      console.error("Error fetching collection assets:", assetsError);
    }

    return NextResponse.json({
      ...data,
      assets: assets?.map((a) => ({ ...a.asset, position: a.position })) || [],
    });
  } catch (error) {
    console.error("Error fetching collection:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description } = body;

    const updates: Record<string, string | null> = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No updates provided" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("collections")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Collection not found" }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error updating collection:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Find all asset IDs in this collection
    const { data: collectionAssets } = await supabase
      .from("collection_assets")
      .select("asset_id")
      .eq("collection_id", id);

    const assetIds = collectionAssets?.map((a) => a.asset_id) ?? [];

    if (assetIds.length > 0) {
      // Find which of those assets appear in OTHER collections
      const { data: sharedAssets } = await supabase
        .from("collection_assets")
        .select("asset_id")
        .in("asset_id", assetIds)
        .neq("collection_id", id);

      const sharedIds = new Set(sharedAssets?.map((a) => a.asset_id) ?? []);
      const exclusiveIds = assetIds.filter((aid) => !sharedIds.has(aid));

      if (exclusiveIds.length > 0) {
        // Fetch storage paths for exclusive assets
        const { data: assetsToDelete } = await supabase
          .from("image_assets")
          .select("id, storage_path")
          .in("id", exclusiveIds);

        if (assetsToDelete && assetsToDelete.length > 0) {
          const mainPaths = assetsToDelete.map((a) => a.storage_path);
          const thumbPaths = assetsToDelete.map((a) =>
            a.storage_path.replace(/(\.[^./]+)$/, "_thumb$1")
          );

          // Delete from both storage buckets (best-effort)
          await Promise.all([
            supabase.storage.from("image_assets").remove(mainPaths),
            supabase.storage.from("image_thumbs").remove(thumbPaths),
          ]);

          // Delete collection_assets rows for exclusive assets (all collections)
          await supabase.from("collection_assets").delete().in("asset_id", exclusiveIds);

          // Delete image_asset records (also cascades to asset_tags, prompts)
          await supabase.from("image_assets").delete().in("id", exclusiveIds);
        }
      }
    }

    // Delete any remaining collection_assets for this collection (shared assets not yet removed)
    await supabase.from("collection_assets").delete().eq("collection_id", id);

    // Delete the collection
    const { error } = await supabase
      .from("collections")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting collection:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
