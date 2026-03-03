import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { GoogleGenAI } from "@google/genai";

async function generateTitle(content: string): Promise<string> {
  const fallback = content.split(" ").slice(0, 6).join(" ") + (content.split(" ").length > 6 ? "…" : "");

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return fallback;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const resp = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Write a 3-7 word title for this prompt. Return only the title, no quotes:\n\n${content}`,
            },
          ],
        },
      ],
    });
    return resp.text?.trim() || fallback;
  } catch {
    return fallback;
  }
}

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("prompt_library")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching prompt library:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { content, type, source, source_image_ids, title: providedTitle } = body;

    if (!content || !type) {
      return NextResponse.json({ error: "content and type are required" }, { status: 400 });
    }

    const title = providedTitle?.trim() || (await generateTitle(content));

    const { data, error } = await (supabaseAdmin as any)
      .from("prompt_library")
      .insert({
        title,
        content,
        type,
        source: source || "manual",
        source_image_ids: source_image_ids || [],
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("Error creating prompt:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
