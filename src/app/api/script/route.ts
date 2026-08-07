import { NextRequest, NextResponse } from "next/server";
import { callLlm } from "@/lib/llm";
import { llmCached, setLlmCache, hashKey } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { topic, tone = "inspiring", length = "short" } = await req.json();
    if (!topic?.trim()) return NextResponse.json({ success: false, error: "Topic required." }, { status: 400 });
    const key = hashKey("script", tone, length, topic.trim().toLowerCase());
    const cached = llmCached(key);
    if (cached) { try { const s = JSON.parse(cached); if (Array.isArray(s)) return NextResponse.json({ success: true, topic: topic.trim(), tone, length, scenes: s, cached: true }); } catch {} }
    const lenHint = length === "long" ? "5-6 scenes" : length === "medium" ? "3-4 scenes" : "2-3 scenes";
    const sys = `You are a professional scriptwriter for short-form video. The user gives a topic. You produce a ${lenHint} script with a ${tone} tone. For each scene, output a JSON object with two string fields: "scene" (a short title) and "prompt" (a self-contained visual prompt for an AI video generator). Output ONLY a JSON array, no markdown fences, no commentary.`;
    const result = await callLlm([{ role: "system", content: sys }, { role: "user", content: topic.trim() }], "script");
    let scenes: { scene: string; prompt: string }[] = [];
    try {
      const cleaned = result.content.replace(/^```json\s*/i,"").replace(/^```\s*/i,"").replace(/```\s*$/i,"").trim();
      scenes = JSON.parse(cleaned); if (!Array.isArray(scenes)) scenes = [];
    } catch { scenes = []; }
    if (scenes.length > 0) setLlmCache(key, JSON.stringify(scenes));
    return NextResponse.json({ success: true, topic: topic.trim(), tone, length, scenes, cached: false });
  } catch (err: any) {
    const is429 = String(err?.message||"").toLowerCase().includes("rate-limited");
    return NextResponse.json({ success: false, error: err?.message, retryAfterMs: is429?60000:null }, { status: is429?429:500 });
  }
}
