import { NextRequest, NextResponse } from "next/server";
import { callLlm } from "@/lib/llm";
import { llmCached, setLlmCache, hashKey } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { prompt, mode = "video" } = await req.json();
    if (!prompt?.trim()) return NextResponse.json({ success: false, error: "Prompt required." }, { status: 400 });
    const key = hashKey("enhance", mode, prompt.trim().toLowerCase());
    const cached = llmCached(key);
    if (cached) return NextResponse.json({ success: true, enhanced: cached, cached: true });
    const sys = mode === "video"
      ? "You are a world-class prompt engineer for AI video generation. Rewrite the user's idea into a single vivid cinematic prompt. Include subject, motion, camera, lighting, mood, style. Output ONE paragraph, no preamble, no lists, no quotes."
      : "You are a world-class prompt engineer for AI image generation. Rewrite the user's idea into a single vivid detailed prompt. Include subject, composition, lighting, palette, art style, quality cues. Output ONE paragraph, no preamble, no lists, no quotes.";
    const result = await callLlm([{ role: "system", content: sys }, { role: "user", content: prompt.trim() }], "enhance");
    setLlmCache(key, result.content);
    return NextResponse.json({ success: true, enhanced: result.content, provider: result.provider, cached: false });
  } catch (err: any) {
    const is429 = String(err?.message||"").toLowerCase().includes("rate-limited");
    return NextResponse.json({ success: false, error: err?.message, retryAfterMs: is429?60000:null }, { status: is429?429:500 });
  }
}
