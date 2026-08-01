import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { spawn } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";
import { fetchCosmosClusterImages, downloadCosmosImage } from "@/lib/cosmos";
import { runTagger } from "@/lib/tagger";
import { getImageDimensions } from "@/lib/image-meta";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Using untyped client for server-side operations to avoid strict type constraints
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// The browser forwards the user's Settings so a URL import tags with the same
// prompts/models as a manual upload or "Regenerate" — otherwise this route
// silently falls back to the built-in defaults.
type TagSettings = {
  apiKey?: string;
  visionPrompt?: string | null;
  prosePrompt?: string | null;
  scenePrompt?: string | null;
  visionModel?: string | null;
  proseModel?: string | null;
  sceneModel?: string | null;
};

function cosmosSlugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function cosmosExtractName(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split("/").filter(Boolean);
    if (pathParts.length >= 2) {
      return pathParts[1].replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    }
    return "Cosmos Collection";
  } catch {
    return "Cosmos Collection";
  }
}


export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, autoTag = true } = body;
    const tagSettings: TagSettings = body.tagSettings || {};

    if (!url) {
      return NextResponse.json({ error: "URL required" }, { status: 400 });
    }

    // Create ingestion job
    const { data: job, error: jobError } = await supabase
      .from("ingestion_jobs")
      .insert({
        status: "queued",
        source_type: "gallery_dl",
        source_ref: url,
      })
      .select()
      .single();

    if (jobError) {
      return NextResponse.json({ error: "Failed to create job" }, { status: 500 });
    }

    // Start the gallery-dl process in the background
    processGalleryDl(job.id, url, autoTag, tagSettings).catch(console.error);

    return NextResponse.json({
      message: "Job created",
      job,
    });
  } catch (error) {
    console.error("Gallery-DL error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function processGalleryDl(
  jobId: string,
  url: string,
  autoTag: boolean,
  tagSettings: TagSettings = {}
) {
  // Update job status to running
  await supabase
    .from("ingestion_jobs")
    .update({ status: "running" })
    .eq("id", jobId);

  // For Cosmos URLs, ensure a collection exists before processing
  let cosmosCollectionId: string | null = null;
  if (url.includes("cosmos.so")) {
    try {
      const { data: existing } = await supabase
        .from("collections")
        .select("id")
        .eq("source_url", url)
        .limit(1);

      if (existing && existing.length > 0) {
        cosmosCollectionId = existing[0].id;
        console.log(`[gallery-dl] Using existing Cosmos collection: ${cosmosCollectionId}`);
      } else {
        const name = cosmosExtractName(url);
        const baseSlug = cosmosSlugify(name);

        const { data: existingSlugs } = await supabase
          .from("collections")
          .select("slug")
          .like("slug", `${baseSlug}%`);

        let slug = baseSlug;
        if (existingSlugs && existingSlugs.length > 0) {
          const existingSet = new Set(existingSlugs.map((c: { slug: string }) => c.slug));
          let counter = 1;
          while (existingSet.has(slug)) {
            slug = `${baseSlug}-${counter}`;
            counter++;
          }
        }

        const { data: collection } = await supabase
          .from("collections")
          .insert({ name, slug, platform: "cosmos", source_url: url })
          .select("id")
          .single();

        if (collection) {
          cosmosCollectionId = collection.id;
          console.log(`[gallery-dl] Created Cosmos collection "${name}": ${cosmosCollectionId}`);
        }
      }
    } catch (err) {
      console.error("[gallery-dl] Failed to create Cosmos collection:", err);
    }
  }

  // Create temp directory for downloads
  const tempDir = path.join(os.tmpdir(), `gallery-dl-${jobId}`);
  await fs.mkdir(tempDir, { recursive: true });

  try {
    let files: string[];
    if (url.includes("cosmos.so")) {
      const imageUrls = await fetchCosmosClusterImages(url);
      const downloaded = await Promise.all(imageUrls.map((u) => downloadCosmosImage(u, tempDir)));
      files = downloaded.filter((f): f is string => f !== null);
    } else {
      await runGalleryDl(url, tempDir);
      files = await findImages(tempDir);
    }

    console.log(`[gallery-dl] Found ${files.length} images to process`);

    // Process each image and collect asset IDs for tagging
    const assetIds: string[] = [];
    for (const filePath of files) {
      const assetId = await processImage(filePath, url);
      if (assetId) {
        assetIds.push(assetId);
      }
    }

    console.log(`[gallery-dl] Uploaded ${assetIds.length} new images`);

    // Link new assets to the Cosmos collection
    if (cosmosCollectionId && assetIds.length > 0) {
      await supabase.from("collection_assets").insert(
        assetIds.map((id) => ({ collection_id: cosmosCollectionId, asset_id: id }))
      );
      console.log(`[gallery-dl] Linked ${assetIds.length} assets to Cosmos collection`);
    }

    // Auto-tag images if enabled and API key is available
    if (autoTag && assetIds.length > 0) {
      const geminiKey = tagSettings.apiKey || process.env.GEMINI_API_KEY;
      if (geminiKey) {
        console.log(`[gallery-dl] Starting auto-tagging for ${assetIds.length} images`);
        await tagImages(assetIds, geminiKey, tagSettings);
      } else {
        console.log("[gallery-dl] Skipping auto-tag: No Gemini API key configured");
      }
    }

    // Update job status to completed
    await supabase
      .from("ingestion_jobs")
      .update({ status: "completed" })
      .eq("id", jobId);
  } catch (error) {
    // Update job status to failed
    await supabase
      .from("ingestion_jobs")
      .update({
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      })
      .eq("id", jobId);
  } finally {
    // Cleanup temp directory
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function tagImages(assetIds: string[], apiKey: string, tagSettings: TagSettings = {}) {
  for (const assetId of assetIds) {
    try {
      const { data: asset, error: assetError } = await supabase
        .from("image_assets")
        .select("*")
        .eq("id", assetId)
        .single();

      if (assetError || !asset) {
        console.error(`[gallery-dl] Asset not found: ${assetId}`);
        continue;
      }

      const { data: imageData, error: imageError } = await supabase.storage
        .from("image_assets")
        .download(asset.storage_path);

      if (imageError || !imageData) {
        console.error(`[gallery-dl] Failed to download image: ${assetId}`);
        continue;
      }

      const buffer = Buffer.from(await imageData.arrayBuffer());
      const base64Image = buffer.toString("base64");
      const mimeType = `image/${asset.format}`;
      const dimensions = await getImageDimensions(buffer);

      const {
        jsonPrompt,
        naturalPrompt,
        scenePrompt: sceneJson,
        tags,
        modelParams,
      } = await runTagger({
        base64Image,
        mimeType,
        apiKey,
        visionPrompt: tagSettings.visionPrompt ?? undefined,
        prosePrompt: tagSettings.prosePrompt ?? undefined,
        scenePrompt: tagSettings.scenePrompt ?? undefined,
        visionModel: tagSettings.visionModel ?? undefined,
        proseModel: tagSettings.proseModel ?? undefined,
        sceneModel: tagSettings.sceneModel ?? undefined,
        dimensions,
      });

      if (tags.length > 0) {
        await supabase.from("asset_tags").insert(
          tags.map((t) => ({
            asset_id: assetId,
            tag: t.tag,
            confidence: t.confidence,
          }))
        );
      }

      const { data: prompt } = await supabase
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

      if (prompt) {
        await supabase.from("prompt_versions").insert({
          prompt_id: prompt.id,
          version_index: 1,
          json_prompt: jsonPrompt,
          natural_prompt: naturalPrompt,
          scene_prompt: sceneJson,
          edit_source: "llm",
        });
      }

      console.log(`[gallery-dl] Tagged image: ${assetId}`);

      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`[gallery-dl] Failed to tag image ${assetId}:`, error);
      // Continue with next image
    }
  }
}

function runGalleryDl(url: string, outputDir: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const args = [
      "--dest", outputDir,
      "--no-mtime",
      url,
    ];

    const proc = spawn("gallery-dl", args);
    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`gallery-dl exited with code ${code}: ${stderr}`));
      }
    });

    proc.on("error", (err) => {
      reject(new Error(`Failed to run gallery-dl: ${err.message}`));
    });
  });
}

async function findImages(dir: string): Promise<string[]> {
  const results: string[] = [];
  const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp"];

  async function walk(currentDir: string) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (imageExtensions.includes(ext)) {
          results.push(fullPath);
        }
      }
    }
  }

  await walk(dir);
  return results;
}

async function processImage(filePath: string, sourceUrl: string): Promise<string | null> {
  // Read file
  const buffer = await fs.readFile(filePath);
  
  // Calculate hash
  const hash = crypto.createHash("sha256").update(buffer).digest("hex");

  // Check for existing asset
  const { data: existingAsset } = await supabase
    .from("image_assets")
    .select("id")
    .eq("hash_sha256", hash)
    .single();

  if (existingAsset) {
    return null; // Skip duplicate
  }

  // Get format from extension
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const format = ext === "jpg" ? "jpeg" : ext;

  // Generate storage path
  const storagePath = `${hash.slice(0, 2)}/${hash.slice(2, 4)}/${hash}.${ext}`;

  // Determine MIME type
  const mimeTypes: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
  };
  const mimeType = mimeTypes[ext] || "image/jpeg";

  // Upload to storage
  const { error: uploadError } = await supabase.storage
    .from("image_assets")
    .upload(storagePath, buffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Failed to upload: ${uploadError.message}`);
  }

  // Upload thumbnail
  const thumbPath = `${hash.slice(0, 2)}/${hash.slice(2, 4)}/${hash}_thumb.${ext}`;
  await supabase.storage
    .from("image_thumbs")
    .upload(thumbPath, buffer, {
      contentType: mimeType,
      upsert: false,
    });

  // Create asset record and return the ID
  const { width, height } = await getImageDimensions(buffer);
  const { data: asset, error: assetError } = await supabase
    .from("image_assets")
    .insert({
      storage_path: storagePath,
      hash_sha256: hash,
      source_type: "gallery_dl",
      source_ref: sourceUrl,
      width,
      height,
      format,
    })
    .select("id")
    .single();

  if (assetError || !asset) {
    throw new Error(`Failed to create asset record: ${assetError?.message}`);
  }

  return asset.id;
}
