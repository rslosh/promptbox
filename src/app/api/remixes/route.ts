import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      image_ids,
      prompt_components = [],
      edit_instructions = "",
      generated_prompt = "",
      history = [],
    } = body;

    if (!image_ids || !Array.isArray(image_ids) || image_ids.length === 0) {
      return NextResponse.json(
        { error: "image_ids array is required and must not be empty" },
        { status: 400 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabaseAdmin as any)
      .from("playground_remixes")
      .insert({
        name,
        image_ids,
        prompt_components,
        edit_instructions,
        generated_prompt,
        history,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating remix:", error);
      return NextResponse.json(
        { error: "Failed to create remix" },
        { status: 500 }
      );
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/remixes:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const { data, error, count } = await supabaseAdmin
      .from("playground_remixes")
      .select("*", { count: "exact" })
      .order("updated_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Error fetching remixes:", error);
      return NextResponse.json(
        { error: "Failed to fetch remixes" },
        { status: 500 }
      );
    }

    return NextResponse.json({ data, count });
  } catch (error) {
    console.error("Error in GET /api/remixes:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
