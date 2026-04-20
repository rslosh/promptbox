import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

function normalizeUrl(raw: string): string {
  let s = raw.trim();
  // Auto-prefix protocol if missing
  if (s && !s.includes("://")) s = "https://" + s;
  try {
    const url = new URL(s);
    url.hostname = url.hostname.toLowerCase();
    if (url.pathname !== "/" && url.pathname.endsWith("/")) {
      url.pathname = url.pathname.slice(0, -1);
    }
    return url.toString();
  } catch {
    return s;
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function detectPlatform(url: string): "pinterest" | "are_na" | "tumblr" | "manual" | "cosmos" | "shotdeck" | "midjourney" {
  if (url.includes("pinterest.com")) return "pinterest";
  if (url.includes("are.na")) return "are_na";
  if (url.includes("tumblr.com")) return "tumblr";
  if (url.includes("cosmos.so")) return "cosmos";
  if (url.includes("shotdeck.com")) return "shotdeck";
  if (url.includes("midjourney.com")) return "midjourney";
  return "manual";
}

function extractBoardName(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split("/").filter(Boolean);
    
    // Pinterest: /username/board-name/
    if (urlObj.hostname.includes("pinterest.com") && pathParts.length >= 2) {
      return pathParts[1].replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    }
    
    // Are.na: /username/channel-name
    if (urlObj.hostname.includes("are.na") && pathParts.length >= 2) {
      return pathParts[1].replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    }
    
    // Tumblr: /tagged/tag-name or blog subdomain
    if (urlObj.hostname.includes("tumblr.com")) {
      if (pathParts[0] === "tagged" && pathParts[1]) {
        return pathParts[1].replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      }
      const subdomain = urlObj.hostname.split(".")[0];
      if (subdomain && subdomain !== "www") {
        return subdomain.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      }
    }

    // Cosmos: cosmos.so/{username}/{cluster-slug}
    if (urlObj.hostname.includes("cosmos.so") && pathParts.length >= 2) {
      return pathParts[1].replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    }

    // Midjourney: midjourney.com/explore?tab=likes, /likes, /{username}/likes, etc.
    if (urlObj.hostname.includes("midjourney.com")) {
      const tab = urlObj.searchParams.get("tab");
      if (tab) return `MJ ${tab.charAt(0).toUpperCase() + tab.slice(1)}`;
      const label = pathParts.find((p) => ["likes", "liked", "archive", "feed", "explore"].includes(p));
      if (label && label !== "explore") return `MJ ${label.charAt(0).toUpperCase() + label.slice(1)}`;
      if (pathParts.length >= 1) return `MJ ${pathParts[pathParts.length - 1].replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}`;
      return "Midjourney";
    }

    return "Untitled Collection";
  } catch {
    return "Untitled Collection";
  }
}

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("collections")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching collections:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, source_url, description } = body;

    if (!source_url && !name) {
      return NextResponse.json(
        { error: "Either name or source_url is required" },
        { status: 400 }
      );
    }

    const normalizedSourceUrl = source_url ? normalizeUrl(source_url) : null;

    // Return existing collection if source_url already imported
    if (normalizedSourceUrl) {
      const { data: existing } = await supabase
        .from("collections")
        .select("*")
        .eq("source_url", normalizedSourceUrl)
        .maybeSingle();
      if (existing) return NextResponse.json(existing, { status: 200 });
    }

    const platform = normalizedSourceUrl ? detectPlatform(normalizedSourceUrl) : "manual";
    const collectionName = name || extractBoardName(normalizedSourceUrl ?? "");
    const baseSlug = slugify(collectionName);

    // Ensure unique slug
    const { data: existingSlugs } = await supabase
      .from("collections")
      .select("slug")
      .like("slug", `${baseSlug}%`);

    let slug = baseSlug;
    if (existingSlugs && existingSlugs.length > 0) {
      const existingSet = new Set(existingSlugs.map((c) => c.slug));
      let counter = 1;
      while (existingSet.has(slug)) {
        slug = `${baseSlug}-${counter}`;
        counter++;
      }
    }

    const { data, error } = await supabase
      .from("collections")
      .insert({
        name: collectionName,
        slug,
        description: description || null,
        platform,
        source_url: normalizedSourceUrl || null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("Error creating collection:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
