import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI, createPartFromUri } from "@google/genai";
import {
  VIDEO_MODEL,
  VIDEOANALYZER_SYSTEM_INSTRUCTION,
  VIDEO_CAPTION_STYLES,
} from "@/lib/video-analyzer";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Video analysis holds the request open through the Gemini file upload,
// processing wait, and generation — well beyond the default timeout.
export const maxDuration = 300;

// Requests under this size send the video inline with generateContent; larger
// files go through the Gemini Files API (inline payloads cap out at ~20MB).
const INLINE_LIMIT_BYTES = 15 * 1024 * 1024;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const assetId = (formData.get("assetId") as string) || null;
    const styleKey = (formData.get("styleKey") as string) || null;
    const apiKey = (formData.get("apiKey") as string) || process.env.GEMINI_API_KEY;
    const systemPrompt = (formData.get("systemPrompt") as string) || null;
    const model = (formData.get("model") as string) || VIDEO_MODEL;

    if (!apiKey) {
      return NextResponse.json({ error: "Gemini API key not configured" }, { status: 400 });
    }

    // Resolve the video bytes: either a direct file (stateless mode) or a
    // stored asset (persistent mode — caption is saved as a prompt row).
    let videoBytes: { buffer: Buffer; mimeType: string; size: number };
    if (file) {
      const buffer = Buffer.from(await file.arrayBuffer());
      videoBytes = { buffer, mimeType: file.type || "video/mp4", size: file.size };
    } else if (assetId) {
      const { data: asset, error: assetError } = await supabase
        .from("image_assets")
        .select("storage_path, format")
        .eq("id", assetId)
        .single();
      if (assetError || !asset) {
        return NextResponse.json({ error: "Asset not found" }, { status: 404 });
      }
      const { data: blob, error: dlError } = await supabase.storage
        .from("image_assets")
        .download(asset.storage_path);
      if (dlError || !blob) {
        return NextResponse.json({ error: "Failed to download video" }, { status: 500 });
      }
      const buffer = Buffer.from(await blob.arrayBuffer());
      videoBytes = { buffer, mimeType: `video/${asset.format}`, size: buffer.length };
    } else {
      return NextResponse.json({ error: "No video file or assetId provided" }, { status: 400 });
    }

    const ai = new GoogleGenAI({ apiKey });

    let videoPart;
    if (videoBytes.size <= INLINE_LIMIT_BYTES) {
      videoPart = {
        inlineData: { mimeType: videoBytes.mimeType, data: videoBytes.buffer.toString("base64") },
      };
    } else {
      // Files API: upload, then wait for server-side processing to finish
      // before the file is usable in a generateContent call.
      const blob = new Blob([new Uint8Array(videoBytes.buffer)], { type: videoBytes.mimeType });
      let uploaded = await ai.files.upload({ file: blob, config: { mimeType: videoBytes.mimeType } });
      const deadline = Date.now() + 4 * 60 * 1000;
      while (uploaded.state === "PROCESSING") {
        if (Date.now() > deadline) {
          return NextResponse.json({ error: "Video processing timed out" }, { status: 504 });
        }
        await sleep(3000);
        uploaded = await ai.files.get({ name: uploaded.name! });
      }
      if (uploaded.state === "FAILED" || !uploaded.uri) {
        return NextResponse.json({ error: "Gemini failed to process the video" }, { status: 500 });
      }
      videoPart = createPartFromUri(uploaded.uri, uploaded.mimeType || videoBytes.mimeType);
    }

    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts: [videoPart, { text: "Analyze this video and generate the breakdown." }],
        },
      ],
      config: {
        systemInstruction: systemPrompt || VIDEOANALYZER_SYSTEM_INSTRUCTION,
      },
    });

    let caption = (response.text || "").trim();
    // Some styles (MiniMax H3) instruct the model to return the prompt inside
    // a code block — unwrap it so the caption is copy-ready plain text.
    const fenced = caption.match(/^```[a-zA-Z]*\n([\s\S]*?)\n?```$/);
    if (fenced) caption = fenced[1].trim();
    if (!caption) {
      return NextResponse.json({ error: "Gemini returned an empty response" }, { status: 500 });
    }

    // Persist against the asset so the caption shows up in the gallery and
    // image inspector like any other prompt. One prompt row per style; a
    // re-run replaces that style's previous row instead of stacking dupes.
    let promptId: string | null = null;
    if (assetId && styleKey && VIDEO_CAPTION_STYLES.some((s) => s.key === styleKey)) {
      const { data: existing } = await supabase
        .from("prompts")
        .select("id, model_params")
        .eq("asset_id", assetId);
      const stale = (existing || []).filter(
        (p) => (p.model_params as { style?: string } | null)?.style === styleKey
      );
      if (stale.length > 0) {
        await supabase
          .from("prompts")
          .delete()
          .in("id", stale.map((p) => p.id));
      }

      const { data: prompt, error: promptError } = await supabase
        .from("prompts")
        .insert({
          asset_id: assetId,
          json_prompt: {},
          natural_prompt: caption,
          model_name: model,
          model_params: { style: styleKey, video_model: model },
        })
        .select()
        .single();
      if (promptError) {
        console.error("[analyze-video] Failed to save prompt:", promptError);
      } else if (prompt) {
        promptId = prompt.id;
        await supabase.from("prompt_versions").insert({
          prompt_id: prompt.id,
          version_index: 1,
          json_prompt: {},
          natural_prompt: caption,
          edit_source: "llm",
        });
      }
    }

    return NextResponse.json({ caption, model, promptId });
  } catch (error) {
    console.error("Video analysis error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
