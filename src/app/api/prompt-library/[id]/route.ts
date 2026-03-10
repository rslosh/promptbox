import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

const ALLOWED_PATCH_FIELDS = ["is_favorite", "title", "content", "type", "output_image_id", "source_url"] as const;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const field of ALLOWED_PATCH_FIELDS) {
      if (field in body) {
        update[field] = body[field];
      }
    }

    const { data, error } = await (supabaseAdmin as any)
      .from("prompt_library")
      .update(update)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error updating prompt:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { error } = await supabaseAdmin
      .from("prompt_library")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting prompt:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
