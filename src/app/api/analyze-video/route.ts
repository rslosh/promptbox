import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, createPartFromUri } from "@google/genai";
import { VIDEO_MODEL, VIDEOANALYZER_SYSTEM_INSTRUCTION } from "@/lib/video-analyzer";

// Video analysis holds the request open through the Gemini file upload,
// processing wait, and generation — well beyond the default timeout.
export const maxDuration = 300;

// Requests under this size send the video inline with generateContent; larger
// files go through the Gemini Files API (inline payloads cap out at ~20MB).
const INLINE_LIMIT_BYTES = 15 * 1024 * 1024;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const apiKey = (formData.get("apiKey") as string) || process.env.GEMINI_API_KEY;
    const systemPrompt = (formData.get("systemPrompt") as string) || null;
    const model = (formData.get("model") as string) || VIDEO_MODEL;

    if (!file) {
      return NextResponse.json({ error: "No video file provided" }, { status: 400 });
    }
    if (!apiKey) {
      return NextResponse.json({ error: "Gemini API key not configured" }, { status: 400 });
    }

    const mimeType = file.type || "video/mp4";
    const ai = new GoogleGenAI({ apiKey });

    let videoPart;
    if (file.size <= INLINE_LIMIT_BYTES) {
      const buffer = Buffer.from(await file.arrayBuffer());
      videoPart = { inlineData: { mimeType, data: buffer.toString("base64") } };
    } else {
      // Files API: upload, then wait for server-side processing to finish
      // before the file is usable in a generateContent call.
      let uploaded = await ai.files.upload({ file, config: { mimeType } });
      const deadline = Date.now() + 4 * 60 * 1000;
      while (uploaded.state === "PROCESSING") {
        if (Date.now() > deadline) {
          return NextResponse.json({ error: "Video processing timed out" }, { status: 504 });
        }
        await sleep(3000);
        uploaded = await ai.files.get({ name: uploaded.name! });
      }
      if (uploaded.state === "FAILED" || !uploaded.uri) {
        return NextResponse.json({ error: "Gemini failed to process the video" }, { status: 500 });
      }
      videoPart = createPartFromUri(uploaded.uri, uploaded.mimeType || mimeType);
    }

    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts: [videoPart, { text: "Analyze this video and generate the breakdown." }],
        },
      ],
      config: {
        systemInstruction: systemPrompt || VIDEOANALYZER_SYSTEM_INSTRUCTION,
      },
    });

    let caption = (response.text || "").trim();
    // Some styles (MiniMax H3) instruct the model to return the prompt inside
    // a code block — unwrap it so the caption is copy-ready plain text.
    const fenced = caption.match(/^```[a-zA-Z]*\n([\s\S]*?)\n?```$/);
    if (fenced) caption = fenced[1].trim();
    if (!caption) {
      return NextResponse.json({ error: "Gemini returned an empty response" }, { status: 500 });
    }

    return NextResponse.json({ caption, model });
  } catch (error) {
    console.error("Video analysis error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
