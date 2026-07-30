import puppeteer, { Browser, Page } from "puppeteer-core";
import { promises as fs } from "fs";
import path from "path";

const CHROME_PATH =
  process.env.CHROME_EXECUTABLE_PATH ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

export function extractShotdeckDeckId(url: string): string | null {
  const match = url.match(/\/deck\/(\d+)/);
  return match ? match[1] : null;
}

/** Parse Netscape-format cookie file into Puppeteer cookie objects. */
function parseNetscapeCookies(raw: string) {
  const cookies: {
    name: string;
    value: string;
    domain: string;
    path: string;
    expires: number;
    httpOnly: boolean;
    secure: boolean;
  }[] = [];

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const parts = trimmed.split("\t");
    if (parts.length < 7) continue;
    const [domain, , path, secure, expires, name, value] = parts;
    cookies.push({
      domain: domain.startsWith(".") ? domain : domain,
      path,
      secure: secure === "TRUE",
      expires: parseInt(expires, 10) || 0,
      httpOnly: false,
      name,
      value,
    });
  }
  return cookies;
}

async function launchWithSession(): Promise<{ browser: Browser; page: Page }> {
  const cookieStr = process.env.SHOTDECK_COOKIES;
  if (!cookieStr) {
    throw new Error("SHOTDECK_COOKIES must be set in .env.local (export cookies from browser)");
  }

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
    ],
  });

  const page = await browser.newPage();
  page.setDefaultTimeout(30000);

  await page.setUserAgent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36"
  );

  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    (window as unknown as Record<string, unknown>).chrome = { runtime: {} };
    Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, "languages", { get: () => ["en-US", "en"] });
  });

  // Inject cookies BEFORE any navigation so cf_clearance is present on the very first request
  const cookies = parseNetscapeCookies(cookieStr);
  await page.setCookie(...cookies);
  console.log(`[shotdeck] Injected ${cookies.length} cookies`);

  return { browser, page };
}

/** A reusable authenticated Shotdeck session. Call close() when done. */
export class ShotdeckSession {
  private browser: Browser;
  private page: Page;

  private constructor(browser: Browser, page: Page) {
    this.browser = browser;
    this.page = page;
  }

  static async create(): Promise<ShotdeckSession> {
    const { browser, page } = await launchWithSession();
    return new ShotdeckSession(browser, page);
  }

  async fetchDeckImages(deckUrl: string): Promise<{ imageUrls: string[]; deckName: string }> {
    const deckId = extractShotdeckDeckId(deckUrl);
    if (!deckId) throw new Error("Could not extract deck ID from Shotdeck URL");

    const deckResponsePromise = this.page.waitForResponse(
      (r) => r.url().includes(`/deck/showdeckajax/d/${deckId}`),
      { timeout: 20000 }
    );

    console.log(`[shotdeck] Navigating to deck ${deckId}...`);
    await this.page.goto(`https://shotdeck.com/browse/decks#/deck/${deckId}`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    const deckResponse = await deckResponsePromise;
    const status = deckResponse.status();
    const html = await deckResponse.text();
    console.log(`[shotdeck] Deck response: HTTP ${status}, length: ${html.length}`);

    if (status !== 200) {
      console.log(`[shotdeck] Response snippet: ${html.slice(0, 300)}`);
      throw new Error(`Failed to load deck: HTTP ${status}`);
    }

    const nameMatch = html.match(/data-name="([^"]+)"/);
    const deckName = nameMatch
      ? nameMatch[1].replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())
      : `Shotdeck ${deckId}`;

    const shotIds = [...new Set(
      [...html.matchAll(/data-shotid='([^']+)'/g)].map((m) => m[1])
    )];

    if (shotIds.length === 0)
      throw new Error("No shots found in deck — deck may be empty or private");

    console.log(`[shotdeck] Found ${shotIds.length} shots in "${deckName}"`);

    const imageUrls = shotIds.map(
      (id) => `https://shotdeck.com/assets/images/stills/${id}.jpg`
    );

    return { imageUrls, deckName };
  }

  /** Download a single image using the existing authenticated browser session. */
  async downloadImage(imageUrl: string, destDir: string): Promise<string | null> {
    const imgPage = await this.browser.newPage();
    try {
      const response = await imgPage.goto(imageUrl, { timeout: 30000 });
      if (!response || !response.ok()) return null;

      const buffer = await response.buffer();
      const shotId =
        imageUrl.match(/stills\/([^.]+)\.jpg/)?.[1] || Math.random().toString(36).slice(2);
      const dest = path.join(destDir, `shotdeck-${shotId}.jpg`);
      await fs.writeFile(dest, buffer);
      return dest;
    } catch {
      return null;
    } finally {
      await imgPage.close();
    }
  }

  async close() {
    await this.browser.close();
  }
}

/** Convenience wrapper: fetch deck image list (opens a browser, logs in, closes after). */
export async function fetchShotdeckDeckImages(
  deckUrl: string
): Promise<{ imageUrls: string[]; deckName: string }> {
  const session = await ShotdeckSession.create();
  try {
    return await session.fetchDeckImages(deckUrl);
  } finally {
    await session.close();
  }
}
