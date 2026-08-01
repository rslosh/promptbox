import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { runTagger } from "@/lib/tagger";
import { getImageDimensions } from "@/lib/image-meta";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: NextRequest) {
  try {
    const {
      assetId,
      apiKey,
      systemPrompt,
      prosePrompt,
      scenePrompt,
      visionModel,
      proseModel,
      sceneModel,
    } = await request.json();

    if (!assetId) {
      return NextResponse.json({ error: "Asset ID required" }, { status: 400 });
    }

    const { data: asset, error: assetError } = await supabase
      .from("image_assets")
      .select("*")
      .eq("id", assetId)
      .single();

    if (assetError || !asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    const { data: imageData, error: imageError } = await supabase.storage
      .from("image_assets")
      .download(asset.storage_path);

    if (imageError || !imageData) {
      return NextResponse.json({ error: "Failed to download image" }, { status: 500 });
    }

    const buffer = Buffer.from(await imageData.arrayBuffer());
    const base64Image = buffer.toString("base64");
    const mimeType = `image/${asset.format}`;

    const geminiKey = apiKey || process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return NextResponse.json({ error: "Gemini API key not configured" }, { status: 400 });
    }

    // Real pixel dimensions travel into the scene JSON (so the Ideogram output
    // keeps the source orientation) and backfill the asset if it was 0×0.
    const dimensions = await getImageDimensions(buffer);
    if (dimensions.width > 0 && (asset.width !== dimensions.width || asset.height !== dimensions.height)) {
      await supabase
        .from("image_assets")
        .update({ width: dimensions.width, height: dimensions.height })
        .eq("id", assetId);
    }

    const {
      jsonPrompt,
      naturalPrompt,
      scenePrompt: sceneJson,
      tags,
      modelParams,
    } = await runTagger({
      base64Image,
      mimeType,
      apiKey: geminiKey,
      visionPrompt: systemPrompt,
      prosePrompt,
      scenePrompt,
      visionModel,
      proseModel,
      sceneModel,
      dimensions,
    });

    if (tags.length > 0) {
      await supabase.from("asset_tags").delete().eq("asset_id", assetId);
      await supabase.from("asset_tags").insert(
        tags.map((t) => ({
          asset_id: assetId,
          tag: t.tag,
          confidence: t.confidence,
        }))
      );
    }

    const { data: prompt, error: promptError } = await supabase
      .from("prompts")
      .insert({
        asset_id: assetId,
        json_prompt: jsonPrompt,
        natural_prompt: naturalPrompt,
        scene_prompt: sceneJson,
        model_name: modelParams.vision_model,
        model_params: modelParams,
      })
      .select()
      .single();

    if (promptError) {
      console.error("Prompt save error:", promptError);
      return NextResponse.json({ error: "Failed to save prompt" }, { status: 500 });
    }

    await supabase.from("prompt_versions").insert({
      prompt_id: prompt.id,
      version_index: 1,
      json_prompt: jsonPrompt,
      natural_prompt: naturalPrompt,
      scene_prompt: sceneJson,
      edit_source: "llm",
    });

    return NextResponse.json({
      message: "Tagging complete",
      prompt,
      tags,
    });
  } catch (error) {
    console.error("Tagging error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
