import puppeteer from "puppeteer-core";
import { promises as fs } from "fs";
import path from "path";

const CHROME_PATH =
  process.env.CHROME_EXECUTABLE_PATH ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const MIN_FILE_SIZE = 10 * 1024;

function parseCookieString(raw: string) {
  return raw
    .split(";")
    .map((pair) => pair.trim())
    .filter((pair) => pair.includes("="))
    .map((pair) => {
      const idx = pair.indexOf("=");
      const name = pair.slice(0, idx).trim();
      const value = pair.slice(idx + 1).trim();
      const isHostCookie = name.startsWith("__Host-");
      return {
        name,
        value,
        ...(isHostCookie
          ? { url: "https://www.midjourney.com" }
          : { domain: ".midjourney.com" }),
        path: "/",
        httpOnly: false,
        secure: true,
        expires: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
      };
    });
}

/** Recursively extract UUID `id` fields from any JSON structure. */
function extractJobIds(obj: unknown, out: Set<string>): void {
  if (!obj || typeof obj !== "object") return;
  if (Array.isArray(obj)) {
    obj.forEach((item) => extractJobIds(item, out));
    return;
  }
  const record = obj as Record<string, unknown>;
  const id = record.id;
  if (
    typeof id === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)
  ) {
    out.add(id);
  }
  Object.values(record).forEach((v) => extractJobIds(v, out));
}

export async function fetchMidjourneyImages(
  pageUrl: string,
  limit: number | null = null
): Promise<string[]> {
  const cookieStr = process.env.MIDJOURNEY_COOKIES;
  if (!cookieStr) throw new Error("MIDJOURNEY_COOKIES must be set in .env.local");

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-blink-features=AutomationControlled"],
  });

  const page = await browser.newPage();
  page.setDefaultTimeout(60000);
  await page.setUserAgent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36"
  );
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    (window as unknown as Record<string, unknown>).chrome = { runtime: {} };
  });

  try {
    const cookies = parseCookieString(cookieStr);
    await page.setCookie(...cookies);

    // Intercept API responses BEFORE navigation
    const jobIds = new Set<string>();
    page.on("response", (response) => {
      const url = response.url();
      if (!url.includes("midjourney.com")) return;
      // Only capture likes-related API responses (skip /api/folders, /api/imagine, etc.)
      const pathname = new URL(url).pathname;
      if (!pathname.includes("like")) return;
      const ct = response.headers()["content-type"] || "";
      if (!ct.includes("json")) return;

      response
        .json()
        .then((json) => {
          const before = jobIds.size;
          extractJobIds(json, jobIds);
          if (jobIds.size > before) {
            console.log(`[midjourney] API response from ${new URL(url).pathname} — ${jobIds.size} job IDs so far`);
          }
        })
        .catch(() => {});
    });

    console.log(`[midjourney] Navigating to ${pageUrl}...`);
    await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await new Promise((r) => setTimeout(r, 3000));

    // Find the main scrollable container ONCE (MJ uses a fixed-height virtual list div,
    // not window scroll — so window.scrollBy does nothing).
    const containerId = await page.evaluate((): string | null => {
      let best: HTMLElement | null = null;
      let bestDiff = 0;
      for (const el of Array.from(document.querySelectorAll("*"))) {
        const h = el as HTMLElement;
        const s = window.getComputedStyle(h);
        if (s.overflowY !== "auto" && s.overflowY !== "scroll") continue;
        const diff = h.scrollHeight - h.clientHeight;
        if (diff > bestDiff && h.clientHeight > 400) {
          bestDiff = diff;
          best = h;
        }
      }
      if (!best) return null;
      if (!best.id) best.id = "__mjscroll__";
      return best.id;
    });
    console.log(`[midjourney] Scroll container: ${containerId ?? "window (fallback)"}`);

    console.log("[midjourney] Scrolling to trigger API pagination...");
    let staleSince = 0;
    let lastSize = 0;
    for (let i = 0; i < 300; i++) {
      await page.evaluate((cid: string | null) => {
        const el = cid ? document.getElementById(cid) : null;
        if (el) {
          // Scroll the virtual list container to its current bottom
          el.scrollTop = el.scrollHeight;
        } else {
          // Fallback
          window.scrollTo(0, document.body.scrollHeight);
          document.documentElement.scrollTop = document.documentElement.scrollHeight;
        }
      }, containerId);
      await new Promise((r) => setTimeout(r, 1500));

      if (jobIds.size > lastSize) {
        lastSize = jobIds.size;
        staleSince = 0;
      } else {
        staleSince++;
        if (staleSince >= 15) break; // ~22s with no new IDs
      }

      if (limit !== null && jobIds.size >= limit) break;
    }

    // Extra wait for any in-flight responses
    await new Promise((r) => setTimeout(r, 2000));

    console.log(`[midjourney] Found ${jobIds.size} unique job IDs via API interception`);

    // Reverse so newest images come first (API returns oldest first as you scroll down)
    const imageUrls = [...jobIds].reverse().map(
      (id) => `https://cdn.midjourney.com/${id}/0_0.jpeg`
    );

    return limit !== null ? imageUrls.slice(0, limit) : imageUrls;
  } finally {
    await browser.close();
  }
}

export async function downloadMidjourneyImage(
  imageUrl: string,
  destDir: string
): Promise<string | null> {
  try {
    const res = await fetch(imageUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Referer": "https://www.midjourney.com/",
      },
    });
    if (!res.ok) return null;

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < MIN_FILE_SIZE) return null;

    const urlPath = new URL(imageUrl).pathname;
    const parts = urlPath.split("/").filter(Boolean);
    const jobId = parts[0] ?? Math.random().toString(36).slice(2);
    const ext = path.extname(parts[1] ?? "0_0.jpeg") || ".jpeg";
    const filename = `mj-${jobId}${ext}`;
    const dest = path.join(destDir, filename);
    await fs.writeFile(dest, buffer);
    return dest;
  } catch {
    return null;
  }
}
