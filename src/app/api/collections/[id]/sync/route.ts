import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { spawn } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";
import { fetchCosmosClusterImages, downloadCosmosImage, fetchArenaChannelImages, downloadArenaImage } from "@/lib/cosmos";
import { runTagger } from "@/lib/tagger";
import { fetchMidjourneyImages, downloadMidjourneyImage } from "@/lib/midjourney";
import { getImageDimensions } from "@/lib/image-meta";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Tagging config forwarded from the user's browser settings so sync tags with
// the same model + prompts as the image page's "Regenerate" (otherwise sync
// falls back to server defaults — Flash + default prompt).
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
    // Accept both request shapes: a bundled `tagSettings` object (readTagSettings)
    // or the older flat body fields.
    const tagSettings: TagSettings = body.tagSettings || {
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
    // Skip for sites where query params / hash fragments are load-bearing.
    const skipResolve = sourceUrl.includes("midjourney.com") || sourceUrl.includes("shotdeck.com");
    const resolvedUrl = skipResolve ? sourceUrl : await resolveUrl(sourceUrl);
    if (resolvedUrl !== sourceUrl) {
      console.log(`[sync] Resolved URL: ${sourceUrl} → ${resolvedUrl}`);
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
    // For platforms that enumerate the full remote set up front (cosmos/are_na),
    // record the remote total so the sidebar can show a pending-sync badge.
    let remoteTotal: number | null = null;

    async function processFile(filePath: string): Promise<void> {
      try {
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
      } catch (err) {
        console.error(`[sync] Skipping ${filePath}: ${err instanceof Error ? err.message : err}`);
      }
    }

    if (platform === "cosmos" || resolvedUrl.includes("cosmos.so")) {
      const imageUrls = await fetchCosmosClusterImages(resolvedUrl);
      remoteTotal = imageUrls.length;
      console.log(`[sync] Found ${imageUrls.length} Cosmos image URLs`);
      for (const url of imageUrls) {
        if (limit !== null && addedCount >= limit) break;
        const filePath = await downloadCosmosImage(url, tempDir);
        if (filePath) await processFile(filePath);
      }
    } else if (platform === "are_na" || resolvedUrl.includes("are.na")) {
      const imageUrls = await fetchArenaChannelImages(resolvedUrl);
      remoteTotal = imageUrls.length;
      console.log(`[sync] Found ${imageUrls.length} Are.na image URLs`);
      for (const url of imageUrls) {
        if (limit !== null && addedCount >= limit) break;
        const filePath = await downloadArenaImage(url, tempDir);
        if (filePath) await processFile(filePath);
      }
    } else if (platform === "midjourney" || resolvedUrl.includes("midjourney.com")) {
      // Scroll limit must cover existing images (all duplicates) + desired new ones
      const scrollLimit = limit !== null
        ? Math.max(limit * 3, existingHashes.size + limit * 2)
        : null;
      const imageUrls = await fetchMidjourneyImages(resolvedUrl, scrollLimit);
      console.log(`[sync] Found ${imageUrls.length} Midjourney image URLs`);
      for (const url of imageUrls) {
        if (limit !== null && addedCount >= limit) break;
        const filePath = await downloadMidjourneyImage(url, tempDir);
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
      // Prefer the user's forwarded key, then the server env key.
      const geminiKey = tagSettings.apiKey || process.env.GEMINI_API_KEY;
      if (geminiKey) {
        console.log(`[sync] Starting auto-tagging for ${newAssetIds.length} images`);
        await tagImages(newAssetIds, geminiKey, tagSettings);
      } else {
        console.log("[sync] Skipping auto-tag: no Gemini API key in Settings or GEMINI_API_KEY env");
      }
    }

    // Update collection sync timestamp (and remote total when we have it).
    const now = new Date().toISOString();
    await supabase
      .from("collections")
      .update(
        remoteTotal !== null
          ? { last_synced_at: now, remote_count: remoteTotal, remote_count_checked_at: now }
          : { last_synced_at: now }
      )
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
    const args = [
      "--dest", outputDir,
      "--no-mtime",
      // Skip video pins/posts: we only ingest images, and video otherwise
      // routes to yt-dlp (not installed) and fails the whole run.
      "-o", "extractor.pinterest.videos=false",
      "-o", "extractor.tumblr.videos=false",
    ];
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
        return;
      }

      if (stderr.includes("Unsupported URL")) {
        reject(
          new Error(
            `Unsupported URL. For Pinterest, use a board URL like: https://www.pinterest.com/username/boardname/`
          )
        );
        return;
      }

      // gallery-dl uses a bitfield exit code: 4 = HTTP/download error, 8 = not
      // found. Those mean SOME items failed (e.g. a stray video) while others
      // downloaded fine — don't fail the whole sync; let the caller ingest
      // whatever images landed. Any other bits set are treated as fatal.
      const NON_FATAL = 4 | 8;
      if (code !== null && (code & ~NON_FATAL) === 0) {
        console.warn(
          `[sync] gallery-dl exited ${code} (partial download); continuing with what downloaded. stderr: ${stderr.slice(0, 400)}`
        );
        resolve(stdout);
        return;
      }

      reject(new Error(`gallery-dl exited with code ${code}: ${stderr}`));
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

    // Upload to storage (retry up to 3 times on transient network errors)
    let uploadError;
    for (let attempt = 1; attempt <= 3; attempt++) {
      ({ error: uploadError } = await supabase.storage
        .from("image_assets")
        .upload(storagePath, buffer, { contentType: mimeType, upsert: false }));
      if (!uploadError || uploadError.message.includes("already exists")) break;
      if (attempt < 3) {
        console.log(`[sync] Upload attempt ${attempt} failed (${uploadError.message}), retrying...`);
        await new Promise((r) => setTimeout(r, attempt * 1000));
      }
    }
    if (uploadError && !uploadError.message.includes("already exists")) {
      throw new Error(`Failed to upload: ${uploadError.message}`);
    }

    // Upload thumbnail (best-effort, no retry needed)
    const thumbPath = `${hash.slice(0, 2)}/${hash.slice(2, 4)}/${hash}_thumb.${ext}`;
    await supabase.storage
      .from("image_thumbs")
      .upload(thumbPath, buffer, {
        contentType: mimeType,
        upsert: false,
      });

    // Create asset record with real pixel dimensions.
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
        dimensions,
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
