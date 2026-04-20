import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { GoogleGenAI } from "@google/genai";

async function generateRemixTitle(generatedPrompt: string, promptComponents: unknown[]): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return "Untitled Remix";

  try {
    const context = generatedPrompt ||
      (promptComponents as { value?: string }[]).slice(0, 5).map((c) => c.value).filter(Boolean).join(", ");
    if (!context) return "Untitled Remix";

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: [{ role: "user", parts: [{ text: `Give this creative project an evocative title (8-12 words, no quotes, no punctuation). Base it on: ${context.slice(0, 500)}` }] }],
    });
    const title = response.text?.trim().replace(/['"]/g, "").slice(0, 120);
    return title || "Untitled Remix";
  } catch {
    return "Untitled Remix";
  }
}

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

    const resolvedName = name || await generateRemixTitle(generated_prompt, prompt_components);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabaseAdmin as any)
      .from("playground_remixes")
      .insert({
        name: resolvedName,
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
