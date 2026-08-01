import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { runSceneCompose } from "@/lib/tagger";
import { getImageDimensions } from "@/lib/image-meta";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Counts and mutations must always hit the DB — never serve a cached count.
export const dynamic = "force-dynamic";

// Scoping to a collection walks prompts -> asset -> collection_assets with
// inner joins, so Postgres does the filtering. Collecting the collection's
// asset IDs first and passing them to .in() would blow the URL length limit
// once a collection passes a few hundred images.
const ASSET_COLS = "storage_path, format, width, height";

function promptSelect(collectionId: string | null): string {
  return collectionId
    ? `id, asset:image_assets!inner(${ASSET_COLS}, collection_assets!inner(collection_id))`
    : `id, asset:image_assets(${ASSET_COLS})`;
}

// A prompt needs backfilling when it has a real VisStruct analysis
// (json_prompt.image_type present) but no SceneCompose result yet
// (scene_prompt.high_level_description absent). Constraining on json_prompt
// keeps the work-set to prompts we can actually reformat, so repeated batches
// always converge to zero remaining.
async function countPending(collectionId: string | null = null): Promise<number> {
  const select = collectionId
    ? "id, asset:image_assets!inner(collection_assets!inner(collection_id))"
    : "id";
  let query = supabase
    .from("prompts")
    .select(select, { count: "exact", head: true })
    .is("scene_prompt->>high_level_description", null)
    .not("json_prompt->>image_type", "is", null);
  if (collectionId) query = query.eq("asset.collection_assets.collection_id", collectionId);
  const { count } = await query;
  return count ?? 0;
}

// Total prompts in scope (used by the "re-run all / overwrite" flow).
async function countTotal(collectionId: string | null = null): Promise<number> {
  const select = collectionId
    ? "id, asset:image_assets!inner(collection_assets!inner(collection_id))"
    : "id";
  let query = supabase.from("prompts").select(select, { count: "exact", head: true });
  if (collectionId) query = query.eq("asset.collection_assets.collection_id", collectionId);
  const { count } = await query;
  return count ?? 0;
}

// A prompt is "unfixed" when its scene JSON was NOT produced by the corrected
// pipeline. The corrected SceneCompose always stamps `aspect_ratio`, so its
// absence flags both "never had an Ideogram prompt" and "has an old, possibly
// axis-transposed one" in a single check. This is what the collection Retag
// targets — re-running it once clears the whole collection and re-running after
// that is a genuine no-op (count is 0). Note we do NOT constrain on
// json_prompt->>image_type: the image-based SceneCompose needs only the image,
// and most older prompts lack that key anyway.
async function countUnfixed(collectionId: string | null = null): Promise<number> {
  const select = collectionId
    ? "id, asset:image_assets!inner(collection_assets!inner(collection_id))"
    : "id, asset:image_assets!inner(id)";
  let query = supabase
    .from("prompts")
    .select(select, { count: "exact", head: true })
    .is("scene_prompt->>aspect_ratio", null);
  if (collectionId) query = query.eq("asset.collection_assets.collection_id", collectionId);
  const { count } = await query;
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
      collectionId = null,
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
      let query = supabase
        .from("prompts")
        .select(promptSelect(collectionId))
        .order("created_at", { ascending: false })
        .range(start, start + take - 1);
      if (collectionId) query = query.eq("asset.collection_assets.collection_id", collectionId);
      const { data, error: fetchError } = await query;
      if (fetchError) {
        console.error("[backfill-scene] Fetch error:", fetchError);
        return NextResponse.json({ error: "Failed to load prompts" }, { status: 500 });
      }
      // supabase-js can only infer row types from a literal select string; ours
      // is computed, so it falls back to an error type. The shape is checked at
      // runtime in processOne.
      batch = data as unknown as { id: string; asset: unknown }[];
    } else if (mode === "fix") {
      // The repair path: (re)generate scene JSON for every prompt not yet on the
      // corrected pipeline (aspect_ratio absent). Each processed row gains
      // aspect_ratio and drops out, so the set shrinks to zero and stays there.
      let query = supabase
        .from("prompts")
        .select(promptSelect(collectionId))
        .is("scene_prompt->>aspect_ratio", null)
        .order("created_at", { ascending: true })
        .limit(batchSize);
      if (collectionId) query = query.eq("asset.collection_assets.collection_id", collectionId);
      const { data, error: fetchError } = await query;
      if (fetchError) {
        console.error("[backfill-scene] Fetch error:", fetchError);
        return NextResponse.json({ error: "Failed to load prompts" }, { status: 500 });
      }
      batch = data as unknown as { id: string; asset: unknown }[];
    } else {
      let query = supabase
        .from("prompts")
        .select(promptSelect(collectionId))
        .is("scene_prompt->>high_level_description", null)
        .not("json_prompt->>image_type", "is", null)
        .order("created_at", { ascending: true })
        .limit(batchSize);
      if (collectionId) query = query.eq("asset.collection_assets.collection_id", collectionId);
      const { data, error: fetchError } = await query;
      if (fetchError) {
        console.error("[backfill-scene] Fetch error:", fetchError);
        return NextResponse.json({ error: "Failed to load prompts" }, { status: 500 });
      }
      // supabase-js can only infer row types from a literal select string; ours
      // is computed, so it falls back to an error type. The shape is checked at
      // runtime in processOne.
      batch = data as unknown as { id: string; asset: unknown }[];
    }

    let succeeded = 0;
    let failed = 0;
    // Gemini's per-day quota returns 429 / RESOURCE_EXHAUSTED. Once we see it,
    // every remaining call in this run will fail identically, so we stop the
    // whole run and tell the client rather than grinding through the batch.
    let quotaExceeded = false;

    function isQuotaError(error: unknown): boolean {
      const e = error as { status?: number; message?: string } | undefined;
      return e?.status === 429 || /RESOURCE_EXHAUSTED|exceeded your current quota/i.test(e?.message || "");
    }

    const CONCURRENCY = 3;
    const queue = [...(batch || [])];

    async function processOne(prompt: {
      id: string;
      asset: { storage_path: string; format: string; width: number; height: number } | null;
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

        const buffer = Buffer.from(await imageData.arrayBuffer());
        const base64Image = buffer.toString("base64");
        const mimeType = `image/${asset.format}`;
        const dimensions = await getImageDimensions(buffer);

        // Backfill the asset's dimensions if they were never recorded (0×0).
        if (
          dimensions.width > 0 &&
          (asset.width !== dimensions.width || asset.height !== dimensions.height)
        ) {
          await supabase
            .from("image_assets")
            .update({ width: dimensions.width, height: dimensions.height })
            .eq("storage_path", asset.storage_path);
        }

        const scene = await runSceneCompose({
          base64Image,
          mimeType,
          apiKey: geminiKey,
          scenePrompt,
          sceneModel,
          dimensions,
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
        if (isQuotaError(error)) {
          quotaExceeded = true;
          console.error(`[backfill-scene] Quota exceeded on prompt ${prompt.id} — halting run`);
        } else {
          console.error(`[backfill-scene] Failed for prompt ${prompt.id}:`, error);
        }
        failed++;
      }
    }

    async function worker(): Promise<void> {
      // Drain nothing further once the daily quota is spent.
      if (quotaExceeded) return;
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
      // batch came back short (end of table), we've reached the cap, or the
      // daily quota ran out mid-run.
      const rows = batch || [];
      const nextOffset = start + rows.length;
      const total = await countTotal(collectionId);
      const ceiling = capNum == null ? total : Math.min(capNum, total);
      const remaining = Math.max(0, ceiling - nextOffset);
      return NextResponse.json({
        attempted: rows.length,
        succeeded,
        failed,
        offset: nextOffset,
        remaining,
        quotaExceeded,
        done: quotaExceeded || rows.length === 0 || nextOffset >= ceiling,
      });
    }

    // "fix" converges on aspect_ratio; "missing" on high_level_description.
    const remaining =
      mode === "fix" ? await countUnfixed(collectionId) : await countPending(collectionId);

    return NextResponse.json({
      attempted: batch?.length || 0,
      succeeded,
      failed,
      remaining,
      quotaExceeded,
      done: quotaExceeded || remaining === 0,
    });
  } catch (error) {
    console.error("[backfill-scene] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Lightweight counts so the UI can show how much work is pending before
// starting — `unfixed` drives the collection Retag (prompts not on the
// corrected pipeline); `remaining`/`total` back the global Settings flows.
export async function GET(request: NextRequest) {
  try {
    // ?collectionId=… scopes the counts to one collection; omit it for global.
    const collectionId = request.nextUrl.searchParams.get("collectionId");
    const [remaining, total, unfixed] = await Promise.all([
      countPending(collectionId),
      countTotal(collectionId),
      countUnfixed(collectionId),
    ]);
    return NextResponse.json({ remaining, total, unfixed });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
