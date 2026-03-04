import { promises as fs } from "fs";
import path from "path";

// ── Are.na ──────────────────────────────────────────────────────────────────────

interface ArenaImageBlock {
  image?: {
    original?: { url?: string };
    display?: { url?: string };
  };
}

export async function fetchArenaChannelImages(channelUrl: string): Promise<string[]> {
  // Extract slug from URL: /username/channel-slug → channel-slug
  const slug = channelUrl.replace(/\/$/, "").split("/").pop();
  if (!slug) throw new Error("Could not extract Are.na channel slug from URL");

  // First request to get total length
  const firstRes = await fetch(`https://api.are.na/v2/channels/${slug}?per=1&page=1`);
  if (!firstRes.ok) throw new Error(`Are.na API error: ${firstRes.status}`);
  const firstData = await firstRes.json() as { length: number };
  const total = firstData.length || 0;
  if (total === 0) throw new Error("Are.na channel is empty or not found");

  const PER_PAGE = 50;
  const pages = Math.ceil(total / PER_PAGE);

  const urls: string[] = [];
  for (let page = 1; page <= pages; page++) {
    const res = await fetch(`https://api.are.na/v2/channels/${slug}?per=${PER_PAGE}&page=${page}`);
    if (!res.ok) break;
    const data = await res.json() as { contents: ArenaImageBlock[] };
    for (const block of data.contents ?? []) {
      const url = block.image?.original?.url ?? block.image?.display?.url;
      if (url) urls.push(url);
    }
  }

  if (urls.length === 0) throw new Error("No image blocks found in Are.na channel");
  return urls;
}

export async function downloadArenaImage(url: string, destDir: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "";
    const ext = ct.includes("png") ? "png" : ct.includes("gif") ? "gif" : ct.includes("webp") ? "webp" : "jpg";
    const dest = path.join(destDir, `arena-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`);
    await fs.writeFile(dest, Buffer.from(await res.arrayBuffer()));
    return dest;
  } catch {
    return null;
  }
}

export async function fetchCosmosClusterImages(clusterUrl: string): Promise<string[]> {
  const res = await fetch(clusterUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });
  if (!res.ok) throw new Error(`Failed to fetch Cosmos cluster page: ${res.status}`);
  const html = await res.text();

  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match) throw new Error("Could not find __NEXT_DATA__ on Cosmos cluster page");
  const nextData = JSON.parse(match[1]);

  const urls = new Set<string>();
  function walk(val: unknown) {
    if (typeof val === "string" && val.startsWith("https://cdn.cosmos.so/")) {
      urls.add(val.split("?")[0]);
    } else if (Array.isArray(val)) {
      val.forEach(walk);
    } else if (val && typeof val === "object") {
      Object.values(val as object).forEach(walk);
    }
  }
  walk(nextData);

  if (urls.size === 0) throw new Error("No images found in Cosmos cluster — cluster may be empty or private");
  return [...urls];
}

export async function downloadCosmosImage(url: string, destDir: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "";
    const ext = ct.includes("png")
      ? "png"
      : ct.includes("gif")
      ? "gif"
      : ct.includes("webp")
      ? "webp"
      : "jpg";
    const dest = path.join(
      destDir,
      `cosmos-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    );
    await fs.writeFile(dest, Buffer.from(await res.arrayBuffer()));
    return dest;
  } catch {
    return null;
  }
}
