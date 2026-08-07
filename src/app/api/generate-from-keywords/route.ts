import { NextRequest, NextResponse } from "next/server";
import { callLlm } from "@/lib/llm";
import { llmCached, setLlmCache, hashKey } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

type Target = "video-prompt" | "image-prompt" | "script";
const VALID: Target[] = ["video-prompt","image-prompt","script"];
const TONES = ["inspiring","playful","cinematic","documentary","hype","serene"];
const LENGTHS = ["short","medium","long"];

export async function POST(req: NextRequest) {
  const t0 = Date.now();
  try {
    const { keywords, target = "video-prompt", tone = "cinematic", length = "short", style } = await req.json();
    if (!keywords?.trim()) return NextResponse.json({ success: false, error: "Keywords required." }, { status: 400 });
    if (!VALID.includes(target)) return NextResponse.json({ success: false, error: "Invalid target." }, { status: 400 });
    const kwList = keywords.split(/[,\n]/).map(s => s.trim()).filter(Boolean).slice(0,5);
    const kwText = kwList.join(", ");
    if (kwList.length === 0) return NextResponse.json({ success: false, error: "Provide at least one keyword." }, { status: 400 });

    const cacheKey = hashKey(kwText, target, tone, length, style || "");
    const cached = llmCached(cacheKey);
    if (cached) { try { const p = JSON.parse(cached); return NextResponse.json({ ...p, keywords: kwText, cached: true, elapsedMs: Date.now()-t0 }); } catch {} }

    if (target === "script") {
      const vTone = TONES.includes(tone) ? tone : "cinematic";
      const vLen = LENGTHS.includes(length) ? length : "short";
      const lenHint = vLen === "long" ? "5-6 scenes" : vLen === "medium" ? "3-4 scenes" : "2-3 scenes";
      const sys = `You are a professional scriptwriter for short-form video. The user gives a few keywords and a tone. Internally expand the keywords into a clear topic, then produce a ${lenHint} script with a ${vTone} tone. For each scene, output a JSON object with "scene" (short title) and "prompt" (self-contained visual prompt). Output ONLY a JSON array, no markdown fences.`;
      const result = await callLlm([{ role: "system", content: sys }, { role: "user", content: `Keywords: ${kwText}\nTone: ${vTone}` }], "keywords-script");
      let scenes: { scene: string; prompt: string }[] = [];
      try { const c = result.content.replace(/^```json\s*/i,"").replace(/^```\s*/i,"").replace(/```\s*$/i,"").trim(); scenes = JSON.parse(c); if (!Array.isArray(scenes)) scenes = []; } catch { scenes = []; }
      const payload = { success: true, target, keywords: kwText, tone: vTone, length: vLen, scenes, topic: kwText };
      setLlmCache(cacheKey, JSON.stringify(payload));
      return NextResponse.json({ ...payload, elapsedMs: Date.now()-t0 });
    }

    const styleHint = style ? ` Style: ${style}.` : "";
    const sys = target === "video-prompt"
      ? `You are a world-class prompt engineer for AI video generation. Expand the user's keywords into a single vivid cinematic video prompt. Include subject, motion, camera, lighting, mood, style. Output ONE paragraph, no preamble, no lists, no quotes.${styleHint}`
      : `You are a world-class prompt engineer for AI image generation. Expand the user's keywords into a single vivid detailed image prompt. Include subject, composition, lighting, palette, art style, quality cues. Output ONE paragraph, no preamble, no lists, no quotes.${styleHint}`;
    const result = await callLlm([{ role: "system", content: sys }, { role: "user", content: `Keywords: ${kwText}` }], "keywords-prompt");
    const payload = { success: true, target, keywords: kwText, content: result.content, style: style || null };
    setLlmCache(cacheKey, JSON.stringify(payload));
    return NextResponse.json({ ...payload, elapsedMs: Date.now()-t0 });
  } catch (err: any) {
    const is429 = String(err?.message||"").toLowerCase().includes("rate-limited");
    return NextResponse.json({ success: false, error: err?.message, rateLimited: is429, retryAfterMs: is429?60000:0 }, { status: is429?429:500 });
  }
}
