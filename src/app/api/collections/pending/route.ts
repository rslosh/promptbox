import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchCosmosCount } from "@/lib/cosmos";
import { COUNTABLE_PLATFORMS, type Platform } from "@/lib/platforms";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export const dynamic = "force-dynamic";

// Don't re-hit the remote source more often than this per collection.
const THROTTLE_MS = 10 * 60 * 1000; // 10 minutes
const CONCURRENCY = 4;

async function remoteCountFor(platform: Platform, sourceUrl: string): Promise<number | null> {
  if (platform === "cosmos") return fetchCosmosCount(sourceUrl);
  return null;
}

/**
 * Refresh remote image totals for countable collections (cosmos/are_na) whose
 * stored count is stale, then return the current remote_count per collection so
 * the sidebar can show a pending-sync badge. Throttled per collection so the
 * sidebar can call this freely on mount.
 */
export async function GET() {
  try {
    const { data: collections, error } = await supabase
      .from("collections")
      .select("id, platform, source_url, remote_count, remote_count_checked_at");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const now = Date.now();
    const countable = (collections || []).filter(
      (c) =>
        c.source_url &&
        COUNTABLE_PLATFORMS.has(c.platform as Platform)
    );

    // Only the stale ones need a remote hit; the rest keep their stored value.
    const stale = countable.filter((c) => {
      if (!c.remote_count_checked_at) return true;
      return now - new Date(c.remote_count_checked_at).getTime() > THROTTLE_MS;
    });

    // Refresh stale counts with bounded concurrency.
    const queue = [...stale];
    async function worker() {
      const c = queue.shift();
      if (!c) return;
      const count = await remoteCountFor(c.platform as Platform, c.source_url as string);
      if (count !== null) {
        await supabase
          .from("collections")
          .update({ remote_count: count, remote_count_checked_at: new Date().toISOString() })
          .eq("id", c.id);
        c.remote_count = count;
      }
      return worker();
    }
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, queue.length) }, () => worker())
    );

    // Return the (possibly refreshed) remote_count for every countable collection.
    const result: Record<string, number | null> = {};
    for (const c of countable) result[c.id] = c.remote_count ?? null;

    return NextResponse.json({ remoteCounts: result });
  } catch (error) {
    console.error("[collections/pending] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
