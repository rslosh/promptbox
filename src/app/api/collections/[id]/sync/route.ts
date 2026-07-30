import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { spawn } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";
import { fetchCosmosClusterImages, downloadCosmosImage, fetchArenaChannelImages, downloadArenaImage } from "@/lib/cosmos";
import { runTagger } from "@/lib/tagger";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Custom prompts / per-pass models from Settings, forwarded by the client so
// synced images get tagged with the same instructions as manual uploads.
type TagSettings = {
  apiKey?: string | null;
  visionPrompt?: string | null;
  prosePrompt?: string | null;
  scenePrompt?: string | null;
  visionModel?: string | null;
  proseModel?: string | null;
  sceneModel?: string | null;
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const autoTag = body.autoTag !== false;
    const limit: number | null = body.limit ? Math.max(1, Number(body.limit)) : null;
    const tagSettings: TagSettings = {
      apiKey: body.apiKey,
      visionPrompt: body.systemPrompt,
      prosePrompt: body.prosePrompt,
      scenePrompt: body.scenePrompt,
      visionModel: body.visionModel,
      proseModel: body.proseModel,
      sceneModel: body.sceneModel,
    };

    // Get the collection
    const { data: collection, error: collectionError } = await supabase
      .from("collections")
      .select("*")
      .eq("id", id)
      .single();

    if (collectionError || !collection) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    }

    if (!collection.source_url) {
      return NextResponse.json(
        { error: "Collection has no source URL to sync from" },
        { status: 400 }
      );
    }

    // Create ingestion job
    const { data: job, error: jobError } = await supabase
      .from("ingestion_jobs")
      .insert({
        status: "queued",
        source_type: "collection_sync",
        source_ref: collection.source_url,
      })
      .select()
      .single();

    if (jobError) {
      return NextResponse.json({ error: "Failed to create job" }, { status: 500 });
    }

    // Start sync in background
    syncCollection(job.id, collection.id, collection.source_url, autoTag, collection.platform ?? null, limit, tagSettings).catch(console.error);

    return NextResponse.json({
      message: "Sync started",
      job,
      collection_id: collection.id,
    });
  } catch (error) {
    console.error("Collection sync error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function syncCollection(
  jobId: string,
  collectionId: string,
  sourceUrl: string,
  autoTag: boolean,
  platform: string | null = null,
  limit: number | null = null,
  tagSettings: TagSettings = {}
) {
  // Update job status to running
  await supabase
    .from("ingestion_jobs")
    .update({ status: "running" })
    .eq("id", jobId);

  // Create temp directory for downloads
  const tempDir = path.join(os.tmpdir(), `collection-sync-${jobId}`);
  await fs.mkdir(tempDir, { recursive: true });

  try {
    // Get existing hashes in this collection to skip duplicates
    const { data: existingAssets } = await supabase
      .from("collection_assets")
      .select("asset:image_assets(hash_sha256)")
      .eq("collection_id", collectionId);

    const existingHashes = new Set(
      existingAssets?.map((a) => (a.asset as unknown as { hash_sha256: string })?.hash_sha256).filter(Boolean) || []
    );

    console.log(`[sync] Collection has ${existingHashes.size} existing images`);

    // Normalize the URL (e.g. Pinterest ?boardId= links → canonical /username/board/)
    const resolvedUrl = await resolveUrl(sourceUrl);
    if (resolvedUrl !== sourceUrl) {
      console.log(`[sync] Resolved URL: ${sourceUrl} → ${resolvedUrl}`);
      await supabase.from("collections").update({ source_url: resolvedUrl }).eq("id", collectionId);
    }

    // Backfill platform if collection was created before cosmos detection was added
    if (platform !== "cosmos" && resolvedUrl.includes("cosmos.so")) {
      await supabase.from("collections").update({ platform: "cosmos" }).eq("id", collectionId);
    }

    // Fetch + process images. For URL-based platforms (Cosmos, Are.na) we download
    // lazily one-at-a-time so we can stop as soon as `limit` NEW (non-duplicate)
    // images have been added — avoiding wasteful downloads of images that will just
    // be skipped as duplicates.
    // For gallery-dl we pass --range since it handles its own sequencing.
    const newAssetIds: string[] = [];
    let position = existingHashes.size;
    let addedCount = 0;

    async function processFile(filePath: string): Promise<void> {
      const result = await processImageForCollection(
        filePath,
        sourceUrl,
        collectionId,
        existingHashes,
        position
      );
      if (result) {
        newAssetIds.push(result.assetId);
        existingHashes.add(result.hash);
        position++;
        addedCount++;
      }
    }

    if (platform === "cosmos" || resolvedUrl.includes("cosmos.so")) {
      const imageUrls = await fetchCosmosClusterImages(resolvedUrl);
      console.log(`[sync] Found ${imageUrls.length} Cosmos image URLs`);
      for (const url of imageUrls) {
        if (limit !== null && addedCount >= limit) break;
        const filePath = await downloadCosmosImage(url, tempDir);
        if (filePath) await processFile(filePath);
      }
    } else if (platform === "are_na" || resolvedUrl.includes("are.na")) {
      const imageUrls = await fetchArenaChannelImages(resolvedUrl);
      console.log(`[sync] Found ${imageUrls.length} Are.na image URLs`);
      for (const url of imageUrls) {
        if (limit !== null && addedCount >= limit) break;
        const filePath = await downloadArenaImage(url, tempDir);
        if (filePath) await processFile(filePath);
      }
    } else {
      // For gallery-dl: when syncing incrementally (existing images present) fetch
      // a generous batch to account for duplicates; on a fresh collection the limit
      // is tight because there are no dupes to skip.
      const dlLimit = limit === null
        ? null
        : existingHashes.size === 0
          ? limit
          : limit * 4;
      await runGalleryDl(resolvedUrl, tempDir, dlLimit);
      const files = await findImages(tempDir);
      console.log(`[sync] Found ${files.length} images to process`);
      for (const filePath of files) {
        if (limit !== null && addedCount >= limit) break;
        await processFile(filePath);
      }
    }

    console.log(`[sync] Added ${newAssetIds.length} new images to collection`);

    // Auto-tag new images if enabled
    if (autoTag && newAssetIds.length > 0) {
      const geminiKey = tagSettings.apiKey || process.env.GEMINI_API_KEY;
      if (geminiKey) {
        console.log(`[sync] Starting auto-tagging for ${newAssetIds.length} images`);
        await tagImages(newAssetIds, geminiKey, tagSettings);
      } else {
        console.log("[sync] Skipping auto-tag: no Gemini API key in Settings or GEMINI_API_KEY env");
      }
    }

    // Update collection sync timestamp
    await supabase
      .from("collections")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("id", collectionId);

    // Update job status to completed
    await supabase
      .from("ingestion_jobs")
      .update({ status: "completed" })
      .eq("id", jobId);
  } catch (error) {
    console.error("[sync] Error:", error);
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

async function resolveUrl(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    const resolved = response.url;
    // Only use if it resolved to a meaningfully different, non-auth URL
    if (resolved !== url && !resolved.includes("/login") && !resolved.includes("/auth")) {
      return resolved;
    }
  } catch {
    // Fall through — use original
  }
  return url;
}

function runGalleryDl(url: string, outputDir: string, limit: number | null = null): Promise<string> {
  return new Promise((resolve, reject) => {
    const args = ["--dest", outputDir, "--no-mtime"];
    if (limit !== null) args.push("--range", `1-${limit}`);
    args.push(url);

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
        const unsupported = stderr.includes("Unsupported URL");
        const message = unsupported
          ? `Unsupported URL. For Pinterest, use a board URL like: https://www.pinterest.com/username/boardname/`
          : `gallery-dl exited with code ${code}: ${stderr}`;
        reject(new Error(message));
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

async function processImageForCollection(
  filePath: string,
  sourceUrl: string,
  collectionId: string,
  existingHashes: Set<string>,
  position: number
): Promise<{ assetId: string; hash: string } | null> {
  // Read file and calculate hash
  const buffer = await fs.readFile(filePath);
  const hash = crypto.createHash("sha256").update(buffer).digest("hex");

  // Skip if already in this collection
  if (existingHashes.has(hash)) {
    console.log(`[sync] Skipping duplicate: ${path.basename(filePath)}`);
    return null;
  }

  // Check if image exists in database (might be in another collection)
  const { data: existingAsset } = await supabase
    .from("image_assets")
    .select("id")
    .eq("hash_sha256", hash)
    .single();

  let assetId: string;

  if (existingAsset) {
    // Image exists, just link to collection
    assetId = existingAsset.id;
    console.log(`[sync] Linking existing asset to collection: ${assetId}`);
  } else {
    // Upload new image
    const ext = path.extname(filePath).slice(1).toLowerCase();
    const format = ext === "jpg" ? "jpeg" : ext;
    const storagePath = `${hash.slice(0, 2)}/${hash.slice(2, 4)}/${hash}.${ext}`;

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

    if (uploadError && !uploadError.message.includes("already exists")) {
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

    // Create asset record
    const { data: asset, error: assetError } = await supabase
      .from("image_assets")
      .insert({
        storage_path: storagePath,
        hash_sha256: hash,
        source_type: "gallery_dl",
        source_ref: sourceUrl,
        width: 0,
        height: 0,
        format,
      })
      .select("id")
      .single();

    if (assetError || !asset) {
      throw new Error(`Failed to create asset record: ${assetError?.message}`);
    }

    assetId = asset.id;
    console.log(`[sync] Created new asset: ${assetId}`);
  }

  // Link asset to collection
  const { error: linkError } = await supabase.from("collection_assets").insert({
    collection_id: collectionId,
    asset_id: assetId,
    position,
    source_item_id: path.basename(filePath, path.extname(filePath)),
  });

  if (linkError && !linkError.message.includes("duplicate")) {
    console.error(`[sync] Failed to link asset: ${linkError.message}`);
  }

  return { assetId, hash };
}

async function tagImages(assetIds: string[], apiKey: string, tagSettings: TagSettings = {}) {
  const CONCURRENCY = 3;

  async function tagOne(assetId: string) {
    try {
      const { data: asset, error: assetError } = await supabase
        .from("image_assets")
        .select("*")
        .eq("id", assetId)
        .single();

      if (assetError || !asset) return;

      const { data: imageData, error: imageError } = await supabase.storage
        .from("image_assets")
        .download(asset.storage_path);

      if (imageError || !imageData) return;

      const buffer = Buffer.from(await imageData.arrayBuffer());
      const base64Image = buffer.toString("base64");
      const mimeType = `image/${asset.format}`;

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
        visionPrompt: tagSettings.visionPrompt,
        prosePrompt: tagSettings.prosePrompt,
        scenePrompt: tagSettings.scenePrompt,
        visionModel: tagSettings.visionModel,
        proseModel: tagSettings.proseModel,
        sceneModel: tagSettings.sceneModel,
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

      console.log(`[sync] Tagged image: ${assetId}`);
    } catch (error) {
      console.error(`[sync] Failed to tag image ${assetId}:`, error);
    }
  }

  // Concurrency pool — keeps CONCURRENCY workers busy at all times
  const queue = [...assetIds];
  async function worker(): Promise<void> {
    const assetId = queue.shift();
    if (!assetId) return;
    await tagOne(assetId);
    return worker();
  }
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, assetIds.length) }, worker)
  );
}
