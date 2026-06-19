import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { runSceneCompose } from "@/lib/tagger";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Counts and mutations must always hit the DB — never serve a cached count.
export const dynamic = "force-dynamic";

// A prompt needs backfilling when it has a real VisStruct analysis
// (json_prompt.image_type present) but no SceneCompose result yet
// (scene_prompt.high_level_description absent). Constraining on json_prompt
// keeps the work-set to prompts we can actually reformat, so repeated batches
// always converge to zero remaining.
async function countPending(): Promise<number> {
  const { count } = await supabase
    .from("prompts")
    .select("id", { count: "exact", head: true })
    .is("scene_prompt->>high_level_description", null)
    .not("json_prompt->>image_type", "is", null);
  return count ?? 0;
}

// Total prompts in the table (used by the "re-run all / overwrite" flow).
async function countTotal(): Promise<number> {
  const { count } = await supabase
    .from("prompts")
    .select("id", { count: "exact", head: true });
  return count ?? 0;
}

export async function POST(request: NextRequest) {
  try {
    const {
      apiKey,
      scenePrompt,
      sceneModel,
      limit = 5,
      mode = "missing",
      offset = 0,
      cap = null,
    } = await request.json();

    const geminiKey = apiKey || process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return NextResponse.json({ error: "Gemini API key not configured" }, { status: 400 });
    }

    const batchSize = Math.min(Math.max(Number(limit) || 5, 1), 25);

    // "missing": only prompts that lack a scene_prompt (fills gaps, converges
    // as rows get populated). "all": overwrite existing scene_prompts, newest
    // first, via offset pagination. An optional `cap` limits it to the most
    // recent N prompts. Both join the source asset so we re-analyze its image.
    let batch:
      | { id: string; asset: unknown }[]
      | null = null;

    const start = Math.max(0, Number(offset) || 0);
    const capNum = cap == null ? null : Math.max(1, Math.min(Number(cap) || 0, 5000));

    if (mode === "all") {
      // Don't fetch past the cap.
      const take = capNum == null ? batchSize : Math.min(batchSize, capNum - start);
      if (take <= 0) {
        return NextResponse.json({
          attempted: 0,
          succeeded: 0,
          failed: 0,
          offset: start,
          remaining: 0,
          done: true,
        });
      }
      const { data, error: fetchError } = await supabase
        .from("prompts")
        .select("id, asset:image_assets(storage_path, format)")
        .order("created_at", { ascending: false })
        .range(start, start + take - 1);
      if (fetchError) {
        console.error("[backfill-scene] Fetch error:", fetchError);
        return NextResponse.json({ error: "Failed to load prompts" }, { status: 500 });
      }
      batch = data;
    } else {
      const { data, error: fetchError } = await supabase
        .from("prompts")
        .select("id, asset:image_assets(storage_path, format)")
        .is("scene_prompt->>high_level_description", null)
        .not("json_prompt->>image_type", "is", null)
        .order("created_at", { ascending: true })
        .limit(batchSize);
      if (fetchError) {
        console.error("[backfill-scene] Fetch error:", fetchError);
        return NextResponse.json({ error: "Failed to load prompts" }, { status: 500 });
      }
      batch = data;
    }

    let succeeded = 0;
    let failed = 0;

    const CONCURRENCY = 3;
    const queue = [...(batch || [])];

    async function processOne(prompt: {
      id: string;
      asset: { storage_path: string; format: string } | null;
    }) {
      try {
        const asset = prompt.asset;
        if (!asset?.storage_path) {
          console.error(`[backfill-scene] No asset for prompt ${prompt.id}`);
          failed++;
          return;
        }

        const { data: imageData, error: downloadError } = await supabase.storage
          .from("image_assets")
          .download(asset.storage_path);

        if (downloadError || !imageData) {
          console.error(`[backfill-scene] Image download failed for ${prompt.id}:`, downloadError);
          failed++;
          return;
        }

        const base64Image = Buffer.from(await imageData.arrayBuffer()).toString("base64");
        const mimeType = `image/${asset.format}`;

        const scene = await runSceneCompose({
          base64Image,
          mimeType,
          apiKey: geminiKey,
          scenePrompt,
          sceneModel,
        });

        // Only count it done if the pass produced a valid scene document.
        if (!scene || typeof scene.high_level_description !== "string") {
          failed++;
          return;
        }

        const { error: updateError } = await supabase
          .from("prompts")
          .update({ scene_prompt: scene })
          .eq("id", prompt.id);

        if (updateError) {
          console.error(`[backfill-scene] Update failed for ${prompt.id}:`, updateError);
          failed++;
          return;
        }

        succeeded++;
        console.log(`[backfill-scene] Backfilled scene for prompt ${prompt.id}`);
      } catch (error) {
        console.error(`[backfill-scene] Failed for prompt ${prompt.id}:`, error);
        failed++;
      }
    }

    async function worker(): Promise<void> {
      const prompt = queue.shift();
      if (!prompt) return;
      // Supabase types the embedded asset as an array, but the FK is to-one so
      // it arrives as a single object at runtime — normalize before processing.
      const asset = Array.isArray(prompt.asset) ? prompt.asset[0] : prompt.asset;
      await processOne({ id: prompt.id, asset: asset ?? null });
      return worker();
    }

    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, queue.length) }, () => worker())
    );

    if (mode === "all") {
      // Advance the offset by the rows we just processed. We're done when the
      // batch came back short (end of table) or we've reached the cap.
      const rows = batch || [];
      const nextOffset = start + rows.length;
      const total = await countTotal();
      const ceiling = capNum == null ? total : Math.min(capNum, total);
      const remaining = Math.max(0, ceiling - nextOffset);
      return NextResponse.json({
        attempted: rows.length,
        succeeded,
        failed,
        offset: nextOffset,
        remaining,
        done: rows.length === 0 || nextOffset >= ceiling,
      });
    }

    const remaining = await countPending();

    return NextResponse.json({
      attempted: batch?.length || 0,
      succeeded,
      failed,
      remaining,
      done: remaining === 0,
    });
  } catch (error) {
    console.error("[backfill-scene] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Lightweight counts so the UI can show how much work is pending before
// starting — `remaining` for the missing-only fill, `total` for the overwrite.
export async function GET() {
  try {
    const [remaining, total] = await Promise.all([countPending(), countTotal()]);
    return NextResponse.json({ remaining, total });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
