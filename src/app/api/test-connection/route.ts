import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export async function POST(request: NextRequest) {
  try {
    const { provider, apiKey } = await request.json();

    if (!apiKey) {
      return NextResponse.json({ error: "API key required" }, { status: 400 });
    }

    if (provider === "gemini" || provider === "secondary") {
      // Test Gemini connection using the new SDK
      const ai = new GoogleGenAI({ apiKey });
      
      // Simple test prompt
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite-preview",
        contents: "Say 'OK' if you can hear me.",
      });

      const text = response.text;

      if (text) {
        return NextResponse.json({ success: true, message: "Connected" });
      }
    }

    return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
  } catch (error) {
    console.error("Connection test error:", error);
    return NextResponse.json({ error: "Connection failed" }, { status: 500 });
  }
}
