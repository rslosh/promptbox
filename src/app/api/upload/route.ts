import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { execFile } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Using untyped client for server-side operations
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Read file as buffer
    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Calculate SHA-256 hash for deduplication
    const hash = crypto.createHash("sha256").update(buffer).digest("hex");

    // Check for existing asset with same hash
    const { data: existingAsset } = await supabase
      .from("image_assets")
      .select("*")
      .eq("hash_sha256", hash)
      .single();

    if (existingAsset) {
      return NextResponse.json({
        message: "Asset already exists",
        asset: existingAsset,
        duplicate: true,
      });
    }

    // Videos take their own path: probe + poster frame via ffmpeg, then the
    // same storage/dedupe/asset plumbing as images.
    if (file.type.startsWith("video/")) {
      return await handleVideoUpload(file, buffer, hash);
    }

    // Get image dimensions (basic approach using first bytes)
    const { width, height, format } = await getImageDimensions(buffer, file.type);

    // Generate unique storage path
    const ext = file.name.split(".").pop() || "jpg";
    const storagePath = `${hash.slice(0, 2)}/${hash.slice(2, 4)}/${hash}.${ext}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from("image_assets")
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
    }

    // Create thumbnail (simplified - in production use sharp or similar)
    const thumbPath = `${hash.slice(0, 2)}/${hash.slice(2, 4)}/${hash}_thumb.${ext}`;
    await supabase.storage
      .from("image_thumbs")
      .upload(thumbPath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    // Create asset record
    const { data: asset, error: assetError } = await supabase
      .from("image_assets")
      .insert({
        storage_path: storagePath,
        hash_sha256: hash,
        source_type: "upload",
        source_ref: file.name,
        width,
        height,
        format,
      })
      .select()
      .single();

    if (assetError) {
      console.error("Asset creation error:", assetError);
      return NextResponse.json({ error: "Failed to create asset record" }, { status: 500 });
    }

    return NextResponse.json({
      message: "Upload successful",
      asset,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Store an uploaded video: probe dimensions/duration with ffprobe, extract a
 * poster frame with ffmpeg (into image_thumbs, like image thumbnails), upload
 * the video itself to image_assets, and create the asset row.
 */
async function handleVideoUpload(file: File, buffer: Buffer, hash: string) {
  const ext = (file.name.split(".").pop() || "mp4").toLowerCase();
  const storagePath = `${hash.slice(0, 2)}/${hash.slice(2, 4)}/${hash}.${ext}`;
  const posterPath = `${hash.slice(0, 2)}/${hash.slice(2, 4)}/${hash}_poster.jpg`;

  // ffmpeg/ffprobe need a real file — write to a temp dir, clean up after.
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "promptbox-video-"));
  const tempVideo = path.join(tempDir, `in.${ext}`);
  const tempPoster = path.join(tempDir, "poster.jpg");

  try {
    await fs.writeFile(tempVideo, buffer);

    // Probe stream dimensions + duration.
    let width = 0;
    let height = 0;
    let duration: number | null = null;
    try {
      const { stdout } = await execFileAsync("ffprobe", [
        "-v", "error",
        "-select_streams", "v:0",
        "-show_entries", "stream=width,height:format=duration",
        "-of", "json",
        tempVideo,
      ]);
      const probe = JSON.parse(stdout);
      width = probe.streams?.[0]?.width ?? 0;
      height = probe.streams?.[0]?.height ?? 0;
      const d = parseFloat(probe.format?.duration);
      duration = Number.isFinite(d) ? Math.round(d * 10) / 10 : null;
    } catch (e) {
      console.warn("[upload] ffprobe failed (continuing without metadata):", e);
    }

    // Poster frame from ~1s in (falls back to first frame on very short clips).
    let posterBuffer: Buffer | null = null;
    try {
      const seek = duration !== null && duration < 1.2 ? "0" : "1";
      await execFileAsync("ffmpeg", [
        "-y", "-loglevel", "error",
        "-ss", seek,
        "-i", tempVideo,
        "-frames:v", "1",
        "-q:v", "3",
        tempPoster,
      ]);
      posterBuffer = await fs.readFile(tempPoster);
    } catch (e) {
      console.warn("[upload] poster extraction failed (video saved without poster):", e);
    }

    const { error: uploadError } = await supabase.storage
      .from("image_assets")
      .upload(storagePath, buffer, { contentType: file.type, upsert: false });
    if (uploadError) {
      console.error("Video upload error:", uploadError);
      return NextResponse.json({ error: "Failed to upload video" }, { status: 500 });
    }

    if (posterBuffer) {
      await supabase.storage
        .from("image_thumbs")
        .upload(posterPath, posterBuffer, { contentType: "image/jpeg", upsert: false });
    }

    const { data: asset, error: assetError } = await supabase
      .from("image_assets")
      .insert({
        storage_path: storagePath,
        hash_sha256: hash,
        source_type: "upload",
        source_ref: file.name,
        width,
        height,
        format: ext,
        media_type: "video",
        duration_seconds: duration,
        poster_path: posterBuffer ? posterPath : null,
      })
      .select()
      .single();

    if (assetError) {
      console.error("Video asset creation error:", assetError);
      return NextResponse.json({ error: "Failed to create asset record" }, { status: 500 });
    }

    return NextResponse.json({ message: "Upload successful", asset });
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function getImageDimensions(
  buffer: Buffer,
  mimeType: string
): Promise<{ width: number; height: number; format: string }> {
  // Basic dimension extraction from image headers
  // In production, use a library like sharp for accurate results
  
  const format = mimeType.split("/")[1] || "unknown";
  
  // Default dimensions - would be extracted properly with sharp
  let width = 0;
  let height = 0;

  try {
    if (mimeType === "image/png") {
      // PNG: width at bytes 16-19, height at bytes 20-23
      if (buffer.length > 24) {
        width = buffer.readUInt32BE(16);
        height = buffer.readUInt32BE(20);
      }
    } else if (mimeType === "image/jpeg" || mimeType === "image/jpg") {
      // JPEG: search for SOF0 marker
      let offset = 2;
      while (offset < buffer.length) {
        if (buffer[offset] !== 0xff) break;
        const marker = buffer[offset + 1];
        if (marker === 0xc0 || marker === 0xc2) {
          height = buffer.readUInt16BE(offset + 5);
          width = buffer.readUInt16BE(offset + 7);
          break;
        }
        const length = buffer.readUInt16BE(offset + 2);
        offset += 2 + length;
      }
    } else if (mimeType === "image/gif") {
      // GIF: width at bytes 6-7, height at bytes 8-9
      if (buffer.length > 10) {
        width = buffer.readUInt16LE(6);
        height = buffer.readUInt16LE(8);
      }
    } else if (mimeType === "image/webp") {
      // WebP: more complex, use default for now
      width = 0;
      height = 0;
    }
  } catch (e) {
    console.error("Error extracting dimensions:", e);
  }

  return { width: width || 512, height: height || 512, format };
}
