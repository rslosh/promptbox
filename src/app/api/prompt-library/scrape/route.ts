import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { GoogleGenAI } from "@google/genai";
import crypto from "crypto";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// ── Helpers ───────────────────────────────────────────────────────────────────

// Decode common HTML entities (OG tags often encode " as &quot; etc.)
function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

// OG tag extractor that also handles encoded content= attributes
function extractOgTag(html: string, property: string): string {
  // content may use double or single quotes, or be HTML-encoded
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`, "i"),
    new RegExp(`<meta[^>]+name=["']${property.replace("og:", "")}["'][^>]+content=["']([^"']+)["']`, "i"),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return decodeHtmlEntities(m[1].trim());
  }
  return "";
}

function cleanTwitterText(raw: string): string {
  return raw.replace(/\s*https?:\/\/t\.co\/\S+/g, "").trim();
}

// ── HTML visible-text extraction ─────────────────────────────────────────────
// Works for any SSR framework (including Next.js App Router / RSC).
// titleHint: the OG title without "| Site Name" — used to anchor the extraction
// so multi-paragraph prompts (split across separate <p> elements) are joined.

function extractVisibleText(html: string, titleHint = ""): string {
  // Priority 1: <pre> element — structured/code prompts are often in <pre>
  const preRe = /<pre[^>]*>([\s\S]*?)<\/pre>/gi;
  let preM: RegExpExecArray | null;
  let bestPre = "";
  while ((preM = preRe.exec(html)) !== null) {
    const t = decodeHtmlEntities(preM[1].replace(/<[^>]+>/g, "").trim());
    if (t.length > bestPre.length) bestPre = t;
  }
  if (bestPre.length > 100) return bestPre;

  // Strip non-visible elements, keeping content text intact
  const cleaned = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");

  // Strip all tags, preserving newlines at block boundaries
  const rawText = decodeHtmlEntities(
    cleaned
      .replace(/<\/?(p|div|section|article|main|li|h[1-6]|br)[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // Strategy A: anchor to title hint — works when prompt spans multiple <p> tags.
  // The title is usually the first sentence of the prompt on detail pages.
  const cleanTitle = titleHint.replace(/\s*\|.*$/, "").trim();
  if (cleanTitle.length > 20) {
    const lowerText = rawText.toLowerCase();
    const idx = lowerText.indexOf(cleanTitle.toLowerCase());
    if (idx >= 0) {
      // Skip PAST the title itself, then skip any short UI labels (e.g. "Prompt")
      let start = idx + cleanTitle.length;
      // Consume blank lines and single short words/phrases (≤4 words) after the title
      const afterTitle = rawText.slice(start);
      const skipLabels = afterTitle.match(/^(\s+([A-Z][a-zA-Z ]{0,30})\s+){0,5}/);
      if (skipLabels?.[0]) {
        // Only skip if each "word group" is a short UI label, not the start of the prompt
        const skipped = skipLabels[0];
        const hasLongLine = skipped.split("\n").some((l) => l.trim().length > 60);
        if (!hasLongLine) start += skipped.length;
      }

      const fromPrompt = rawText.slice(start).trim();
      const UI_STOP = /\n(Copy\s+prompt|Privacy Policy|Terms of Service|Model\s*\n|Category\s*\n|© \d{4}|Follow|Share|Like|Comment|Related|Discover|Browse)/i;
      const stopM = fromPrompt.match(UI_STOP);
      const extracted = stopM
        ? fromPrompt.slice(0, stopM.index).trim()
        : fromPrompt.slice(0, 8000).trim();
      if (extracted.length > 50) return extracted;
    }
  }

  // Strategy B: find a JSON block { ... } — handles JSON prompts with blank lines
  const jsonMatch = rawText.match(/\{[\s\S]{200,}\}/);
  if (jsonMatch) return jsonMatch[0].trim();

  // Strategy C: longest paragraph (split by 2+ newlines)
  const paragraphs = rawText
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 150);
  if (paragraphs.length > 0)
    return paragraphs.reduce((a, b) => (b.length > a.length ? b : a));

  // Strategy D: longest single line
  const lines = rawText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 50);
  if (lines.length > 0)
    return lines.reduce((a, b) => (b.length > a.length ? b : a));

  return "";
}

// ── JSON data walker (for __NEXT_DATA__ / RSC inline JSON) ───────────────────

// Keys whose object values ARE the prompt — serialize the object to JSON
const HIGH_PRIORITY_KEYS = new Set([
  "prompt", "json_prompt", "prompt_data", "prompt_content",
  "promptText", "prompt_text", "promptJson",
]);

interface WalkAcc {
  priorityTexts: string[];
  genericTexts: string[];
  images: string[];
}

function walkJsonData(
  val: unknown,
  acc: WalkAcc,
  depth = 0,
  parentKey?: string
): void {
  if (depth > 25) return;

  if (typeof val === "string") {
    const decoded = decodeHtmlEntities(val);
    if (/^https?:\/\/.+\.(jpg|jpeg|png|webp|gif)(\?.*)?$/i.test(decoded)) {
      acc.images.push(decoded);
      return;
    }
    // JSON-encoded string: parse and walk recursively
    const trimmed = decoded.trim();
    if ((trimmed.startsWith("{") || trimmed.startsWith("[")) && trimmed.length > 50) {
      try {
        walkJsonData(JSON.parse(trimmed), acc, depth + 1, parentKey);
        return;
      } catch { /* not JSON */ }
    }
    if (decoded.length > 50 && !decoded.startsWith("http")) {
      acc.genericTexts.push(decoded);
    }
  } else if (Array.isArray(val)) {
    val.forEach((v) => walkJsonData(v, acc, depth + 1));
  } else if (val && typeof val === "object") {
    const obj = val as Record<string, unknown>;
    if (parentKey && HIGH_PRIORITY_KEYS.has(parentKey)) {
      const json = JSON.stringify(obj, null, 2);
      if (json.length > 50) acc.priorityTexts.push(json);
    }
    for (const [k, v] of Object.entries(obj)) {
      walkJsonData(v, acc, depth + 1, k);
    }
  }
}

function bestText(acc: WalkAcc): string {
  const pick = (arr: string[]) =>
    arr.length > 0 ? arr.reduce((a, b) => (b.length > a.length ? b : a), "") : "";
  return pick(acc.priorityTexts) || pick(acc.genericTexts);
}

// ── JSON-LD extraction (schema.org) ──────────────────────────────────────────

function extractJsonLd(html: string): { content: string; imageUrl: string } {
  let content = "";
  let imageUrl = "";

  const scriptRe = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = scriptRe.exec(html)) !== null) {
    try {
      const data = JSON.parse(m[1]) as Record<string, unknown>;
      function walkLd(obj: unknown) {
        if (typeof obj === "string") {
          const d = decodeHtmlEntities(obj);
          if (d.length > content.length && d.length > 100) content = d;
        } else if (Array.isArray(obj)) {
          obj.forEach(walkLd);
        } else if (obj && typeof obj === "object") {
          Object.values(obj as Record<string, unknown>).forEach(walkLd);
        }
      }
      const desc = data.description ?? data.text ?? data.prompt;
      if (desc) walkLd(desc);
      else walkLd(data);

      if (!imageUrl) {
        const img = data.image ?? data.thumbnailUrl;
        if (typeof img === "string") imageUrl = img;
        else if (img && typeof img === "object")
          imageUrl = String((img as Record<string, unknown>).url ?? "");
      }
    } catch { /* skip */ }
  }
  return { content, imageUrl };
}

// ── Image download + Supabase storage upload ──────────────────────────────────

async function downloadAndStore(imageUrl: string): Promise<string | null> {
  try {
    const res = await fetch(imageUrl, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(20000),
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

    const buffer = Buffer.from(await res.arrayBuffer());
    const hash = crypto.createHash("sha256").update(buffer).digest("hex");

    // Dedup check
    const { data: existing } = await (supabaseAdmin as any)
      .from("image_assets")
      .select("id")
      .eq("hash_sha256", hash)
      .single();
    if (existing) return (existing as { id: string }).id;

    const storagePath = `${hash.slice(0, 2)}/${hash.slice(2, 4)}/${hash}.${ext}`;
    const mimeType = ct.split(";")[0].trim() || `image/${ext}`;

    const { error: upErr } = await supabaseAdmin.storage
      .from("image_assets")
      .upload(storagePath, buffer, { contentType: mimeType, upsert: false });
    if (upErr) return null;

    // Thumbnail (same file for now — matches existing upload route behaviour)
    const thumbPath = `${hash.slice(0, 2)}/${hash.slice(2, 4)}/${hash}_thumb.${ext}`;
    await supabaseAdmin.storage
      .from("image_thumbs")
      .upload(thumbPath, buffer, { contentType: mimeType, upsert: false });

    const { data: asset } = await (supabaseAdmin as any)
      .from("image_assets")
      .insert({
        storage_path: storagePath,
        hash_sha256: hash,
        source_type: "upload",
        source_ref: imageUrl,
        width: 0,
        height: 0,
        format: ext,
      })
      .select("id")
      .single();

    return (asset as { id: string } | null)?.id ?? null;
  } catch {
    return null;
  }
}

async function generateTitle(content: string): Promise<string> {
  const fallback =
    content.split(" ").slice(0, 6).join(" ") + (content.split(" ").length > 6 ? "…" : "");
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return fallback;
  try {
    const ai = new GoogleGenAI({ apiKey });
    const resp = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: [
        {
          role: "user",
          parts: [{ text: `Write a 3-7 word title for this prompt. Return only the title, no quotes:\n\n${content}` }],
        },
      ],
    });
    return resp.text?.trim() || fallback;
  } catch {
    return fallback;
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const { url, type = "image_gen" } = await request.json();
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }

    // ── Twitter/X — use syndication API (direct scraping is blocked) ────────────
    const isTwitter = url.includes("twitter.com/") || url.includes("x.com/");
    if (isTwitter) {
      let twitterContent = "";
      let twitterImageUrl = "";

      const tweetIdMatch = url.match(/\/status\/(\d+)/);
      const tweetId = tweetIdMatch?.[1];
      if (tweetId) {
        // Strategy 1: fxtwitter API — open-source proxy, supports X Premium Note Tweets (full text)
        try {
          const fxRes = await fetch(
            `https://api.fxtwitter.com/status/${tweetId}`,
            { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(10000) }
          );
          if (fxRes.ok) {
            const fx = await fxRes.json() as {
              tweet?: { text?: string; media?: { photos?: Array<{ url: string }> } };
              code?: number;
            };
            if (fx.tweet?.text) {
              twitterContent = cleanTwitterText(fx.tweet.text);
              const photo = fx.tweet.media?.photos?.[0];
              if (photo?.url) twitterImageUrl = photo.url;
            }
          }
        } catch { /* fall through */ }

        // Strategy 2: Twitter syndication API (fallback — truncates note tweets)
        if (!twitterContent) {
          try {
            const token = Math.round((Number(tweetId) / 1e15) * Math.PI).toString(36);
            const syndRes = await fetch(
              `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&lang=en&token=${token}`,
              {
                headers: { "User-Agent": UA, Referer: "https://platform.twitter.com/" },
                signal: AbortSignal.timeout(10000),
              }
            );
            if (syndRes.ok) {
              const synd = await syndRes.json() as Record<string, unknown>;
              const rawText = (synd.full_text as string) || (synd.text as string) || "";
              twitterContent = cleanTwitterText(rawText);
              const mediaDetails = synd.mediaDetails as Array<{ media_url_https?: string }> | undefined;
              if (!twitterImageUrl && mediaDetails?.[0]?.media_url_https) {
                twitterImageUrl = mediaDetails[0].media_url_https;
              }
            }
          } catch { /* fall through to oEmbed */ }
        }
      }

      // Strategy 2: oEmbed fallback (truncates long tweets, but better than nothing)
      if (!twitterContent) {
        const oEmbedRes = await fetch(
          `https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}&omit_script=true`,
          { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(10000) }
        );
        if (oEmbedRes.ok) {
          const oEmbed = await oEmbedRes.json() as { html: string };
          const pMatch = oEmbed.html.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
          if (pMatch) {
            twitterContent = cleanTwitterText(
              decodeHtmlEntities(pMatch[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())
            );
          }
        }
      }

      if (!twitterContent) {
        return NextResponse.json(
          { error: "Could not fetch tweet. Make sure the tweet is public." },
          { status: 400 }
        );
      }

      // If the tweet contains a JSON block, extract just that as the prompt
      const jsonBlockMatch = twitterContent.match(/\{[\s\S]{100,}\}/);
      const finalContent = jsonBlockMatch ? jsonBlockMatch[0].trim() : twitterContent;

      let outputImageId: string | null = null;
      if (twitterImageUrl) outputImageId = await downloadAndStore(twitterImageUrl);

      const title = await generateTitle(finalContent);

      const { data, error } = await (supabaseAdmin as any)
        .from("prompt_library")
        .insert({
          title: title.slice(0, 200),
          content: finalContent,
          type,
          source: "manual",
          source_url: url,
          source_image_ids: [],
          output_image_id: outputImageId,
        })
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json(data, { status: 201 });
    }

    // Fetch the page
    const pageRes = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
      signal: AbortSignal.timeout(15000),
    });
    if (!pageRes.ok) {
      return NextResponse.json(
        { error: `Could not fetch page (${pageRes.status})` },
        { status: 400 }
      );
    }
    const html = await pageRes.text();

    let content = "";
    let imageUrl = "";
    let title = "";

    // Extract OG title early so we can use it as an anchor for text extraction
    const ogTitle = extractOgTag(html, "og:title");

    // ── 1. Visible-text extraction (works for all SSR frameworks incl. RSC) ───
    // Pass the OG title as a hint so multi-paragraph prompts get joined correctly.
    const visibleText = extractVisibleText(html, ogTitle);
    if (visibleText) content = visibleText;

    // ── 2. JSON data walkers (__NEXT_DATA__ for Pages Router sites) ───────────
    const ndMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (ndMatch) {
      try {
        const nd = JSON.parse(ndMatch[1]) as Record<string, unknown>;
        const acc: WalkAcc = { priorityTexts: [], genericTexts: [], images: [] };
        walkJsonData(nd, acc);
        const best = bestText(acc);
        // Only override visible-text if we found something in a priority key
        if (acc.priorityTexts.length > 0 && best.length > content.length) content = best;
        if (acc.images.length > 0) imageUrl = acc.images[0];
      } catch { /* ignore */ }
    }

    // ── 3. JSON-LD (schema.org) ───────────────────────────────────────────────
    const jsonLd = extractJsonLd(html);
    if (jsonLd.content && jsonLd.content.length > content.length) content = jsonLd.content;
    if (!imageUrl && jsonLd.imageUrl) imageUrl = jsonLd.imageUrl;

    // ── 4. OG tag fallbacks ───────────────────────────────────────────────────
    if (!imageUrl) imageUrl = extractOgTag(html, "og:image");
    if (!content) {
      let ogDesc = extractOgTag(html, "og:description");
      ogDesc = ogDesc.replace(/\s*[—–-]\s*Created with .+$/i, "").trim();
      content = ogDesc;
    }
    if (!title && ogTitle) title = ogTitle;

    if (!content && !imageUrl) {
      return NextResponse.json(
        { error: "Could not extract any content from this URL. Try pasting the prompt manually." },
        { status: 400 }
      );
    }

    // ── 4. Download + store image ─────────────────────────────────────────────
    let outputImageId: string | null = null;
    if (imageUrl) {
      outputImageId = await downloadAndStore(imageUrl);
    }

    // ── 5. Generate title if missing ──────────────────────────────────────────
    if (!title && content) {
      title = await generateTitle(content);
    }
    if (!title) title = new URL(url).hostname;

    // ── 6. Create prompt_library row ──────────────────────────────────────────
    const { data, error } = await (supabaseAdmin as any)
      .from("prompt_library")
      .insert({
        title: title.slice(0, 200),
        content: content || imageUrl,
        type,
        source: "manual",
        source_url: url,
        source_image_ids: [],
        output_image_id: outputImageId,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("Scrape error:", error);
    return NextResponse.json({ error: "Failed to scrape URL" }, { status: 500 });
  }
}
