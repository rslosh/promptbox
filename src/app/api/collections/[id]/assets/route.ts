import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { asset_ids } = await request.json();

    if (!Array.isArray(asset_ids) || asset_ids.length === 0) {
      return NextResponse.json({ error: "asset_ids array required" }, { status: 400 });
    }

    // Insert BEFORE the current minimum position so manually added images
    // show first (the collection view orders position ascending, so smallest
    // position = top-left). Negative positions are fine.
    const { data: minRow } = await (supabaseAdmin as any)
      .from("collection_assets")
      .select("position")
      .eq("collection_id", id)
      .order("position", { ascending: true })
      .limit(1)
      .single();

    const startPosition =
      ((minRow as { position: number } | null)?.position ?? 0) - asset_ids.length;

    const rows = asset_ids.map((asset_id: string, i: number) => ({
      collection_id: id,
      asset_id,
      position: startPosition + i,
    }));

    // Use upsert with ignoreDuplicates so already-linked assets don't
    // cause the entire batch to fail.
    const { error } = await (supabaseAdmin as any)
      .from("collection_assets")
      .upsert(rows, { onConflict: "collection_id,asset_id", ignoreDuplicates: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Keep image_count in sync
    const { count } = await (supabaseAdmin as any)
      .from("collection_assets")
      .select("*", { count: "exact", head: true })
      .eq("collection_id", id);

    await (supabaseAdmin as any)
      .from("collections")
      .update({ image_count: count ?? 0, updated_at: new Date().toISOString() })
      .eq("id", id);

    return NextResponse.json({ added: asset_ids.length });
  } catch (error) {
    console.error("Error adding assets to collection:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { asset_id } = await request.json();

    if (!asset_id) {
      return NextResponse.json({ error: "asset_id required" }, { status: 400 });
    }

    const { error } = await (supabaseAdmin as any)
      .from("collection_assets")
      .delete()
      .eq("collection_id", id)
      .eq("asset_id", asset_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Keep image_count in sync
    const { count } = await (supabaseAdmin as any)
      .from("collection_assets")
      .select("*", { count: "exact", head: true })
      .eq("collection_id", id);

    await (supabaseAdmin as any)
      .from("collections")
      .update({ image_count: count ?? 0, updated_at: new Date().toISOString() })
      .eq("id", id);

    return NextResponse.json({ removed: 1 });
  } catch (error) {
    console.error("Error removing asset from collection:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
