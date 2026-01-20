import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get the asset to find storage paths
    const { data: asset, error: assetError } = await supabase
      .from("image_assets")
      .select("*")
      .eq("id", id)
      .single();

    if (assetError || !asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    // Delete from storage - original image
    await supabase.storage
      .from("image_assets")
      .remove([asset.storage_path]);

    // Delete thumbnail
    const lastDotIndex = asset.storage_path.lastIndexOf(".");
    const thumbPath = lastDotIndex !== -1
      ? asset.storage_path.slice(0, lastDotIndex) + "_thumb" + asset.storage_path.slice(lastDotIndex)
      : asset.storage_path + "_thumb";
    
    await supabase.storage
      .from("image_thumbs")
      .remove([thumbPath]);

    // Delete related records (cascades handle prompt_versions)
    await supabase.from("asset_tags").delete().eq("asset_id", id);
    await supabase.from("prompts").delete().eq("asset_id", id);
    
    // Delete the asset record
    const { error: deleteError } = await supabase
      .from("image_assets")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Delete error:", deleteError);
      return NextResponse.json({ error: "Failed to delete asset" }, { status: 500 });
    }

    return NextResponse.json({ message: "Asset deleted successfully" });
  } catch (error) {
    console.error("Delete error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
