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

const COSMOS_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// Only the fields we need. The web app's full query pulls 30+ fields per item.
const COSMOS_CLUSTER_QUERY =
  "query GetClusterElements($clusterId:ClusterId$pageCursor:String$pageSize:Int){" +
  "clusterConnections(clusterId:$clusterId meta:{pageSize:$pageSize pageCursor:$pageCursor}){" +
  "items{element{__typename" +
  " ...on MediaElementTile{media{__typename ...on StaticImage{url} ...on AnimatedImage{url}}}" +
  " ...on ProductElementTile{media{__typename ...on StaticImage{url} ...on AnimatedImage{url}}}" +
  " ...on WebsiteElementTile{media{__typename ...on StaticImage{url} ...on AnimatedImage{url}}}" +
  "}}meta{nextPageCursor count}}}";

interface CosmosClusterResponse {
  data?: {
    clusterConnections?: {
      items?: Array<{
        element?: {
          media?: { url?: string; __typename?: string };
        };
      }>;
      meta?: { nextPageCursor?: string | null; count?: number };
    };
  };
  errors?: Array<{ message: string }>;
}

export async function fetchCosmosClusterImages(clusterUrl: string): Promise<string[]> {
  // Cosmos uses the Next.js App Router (no __NEXT_DATA__) and lazy-loads
  // elements via GraphQL. Fetch the page only to extract the numeric clusterId,
  // then paginate api.cosmos.so/graphql to get every element.
  const pageRes = await fetch(clusterUrl, { headers: { "User-Agent": COSMOS_UA } });
  if (!pageRes.ok) throw new Error(`Failed to fetch Cosmos cluster page: ${pageRes.status}`);
  const html = await pageRes.text();

  const idMatch = html.match(/"clusterId":(\d+)/);
  if (!idMatch) throw new Error("Could not find clusterId on Cosmos cluster page");
  const clusterId = Number(idMatch[1]);

  const urls = new Set<string>();
  let pageCursor: string | null = null;
  for (let page = 0; page < 50; page++) {
    const gqlRes = await fetch("https://api.cosmos.so/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": COSMOS_UA,
        Origin: "https://www.cosmos.so",
        Referer: "https://www.cosmos.so/",
      },
      body: JSON.stringify({
        operationName: "GetClusterElements",
        variables: { clusterId, pageSize: 100, pageCursor },
        query: COSMOS_CLUSTER_QUERY,
      }),
    });
    if (!gqlRes.ok) throw new Error(`Cosmos GraphQL error: ${gqlRes.status}`);
    const data = (await gqlRes.json()) as CosmosClusterResponse;
    if (data.errors?.length) throw new Error(`Cosmos GraphQL error: ${data.errors[0].message}`);

    const conn = data.data?.clusterConnections;
    if (!conn) throw new Error("Unexpected Cosmos API response");
    for (const item of conn.items ?? []) {
      const url = item.element?.media?.url;
      if (typeof url === "string" && url.startsWith("https://cdn.cosmos.so/")) {
        urls.add(url.split("?")[0]);
      }
    }
    pageCursor = conn.meta?.nextPageCursor ?? null;
    if (!pageCursor) break;
  }

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
