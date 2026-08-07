import { NextRequest, NextResponse } from "next/server";
import { callLlm } from "@/lib/llm";
import { llmCached, setLlmCache, hashKey } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const t0 = Date.now();
  try {
    const { productName, productDescription, style = "premium", targetAudience, duration = "short" } = await req.json();
    if (!productName?.trim()) return NextResponse.json({ success: false, error: "Product name required." }, { status: 400 });

    const cacheKey = hashKey("commercial", productName, productDescription || "", style, targetAudience || "", duration);
    const cached = llmCached(cacheKey);
    if (cached) { try { const p = JSON.parse(cached); return NextResponse.json({ ...p, cached: true, elapsedMs: Date.now() - t0 }); } catch {} }

    const sceneCount = duration === "long" ? 5 : duration === "medium" ? 4 : 3;
    const styleMap: Record<string, string> = {
      premium: "luxury, elegant, high-end product photography",
      energetic: "fast-paced, dynamic, vibrant, social media",
      cinematic: "dramatic, cinematic, film-like, moody",
      minimal: "clean, minimalist, Apple-style",
      playful: "fun, colorful, TikTok-style",
    };
    const styleDesc = styleMap[style] || styleMap.premium;

    const sys = `You are a professional commercial director. Create a ${sceneCount}-scene commercial for a product.

For each scene output JSON with:
- "scene": short title
- "motionPrompt": image-to-video motion prompt (camera angle, movement, lighting, mood) — this will animate the product photo
- "narration": 1-2 sentence voiceover text

Style: ${styleDesc}
Product: ${productName}
${productDescription ? `Description: ${productDescription}` : ""}
${targetAudience ? `Target: ${targetAudience}` : ""}

Output ONLY a JSON array of ${sceneCount} scenes.`;

    const result = await callLlm([{ role: "system", content: sys }, { role: "user", content: `Create commercial for: ${productName}` }], "commercial");

    let scenes: { scene: string; motionPrompt: string; narration: string }[] = [];
    try { const c = result.content.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim(); scenes = JSON.parse(c); if (!Array.isArray(scenes)) scenes = []; } catch { scenes = []; }

    if (scenes.length === 0) {
      const d = productDescription || "a premium product";
      const defaults = [
        { scene: "Hero Shot", motionPrompt: `Slow orbit around ${productName}, ${d}, studio lighting, dark background, gentle rotation, ${styleDesc}`, narration: `Introducing ${productName}. Designed for those who demand the best.` },
        { scene: "Detail Close-up", motionPrompt: `Macro close-up of ${productName} surface, shallow depth of field, soft bokeh, slow push-in, ${styleDesc}`, narration: `Every detail, crafted with precision.` },
        { scene: "Lifestyle", motionPrompt: `${productName} in real-world setting, natural lighting, warm tones, smooth tracking, ${styleDesc}`, narration: `Perfect for your everyday life.` },
        { scene: "Feature Reveal", motionPrompt: `Dynamic shot revealing features of ${productName}, clean background, rotating slowly, premium light, ${styleDesc}`, narration: `Experience the difference.` },
        { scene: "Final Logo", motionPrompt: `Elegant final shot of ${productName}, logo space, dramatic lighting, slow zoom out, fade, ${styleDesc}`, narration: `${productName}. Available now.` },
      ];
      scenes = defaults.slice(0, sceneCount);
    }

    const fullScript = scenes.map((s, i) => `Scene ${i+1}: ${s.scene}\n${s.narration}`).join("\n\n");
    const payload = { success: true, productName: productName.trim(), scenes, fullScript, style, sceneCount: scenes.length };
    setLlmCache(cacheKey, JSON.stringify(payload));
    return NextResponse.json({ ...payload, elapsedMs: Date.now() - t0 });
  } catch (err: any) {
    const is429 = String(err?.message || "").toLowerCase().includes("rate-limited");
    return NextResponse.json({ success: false, error: err?.message, rateLimited: is429 }, { status: is429 ? 429 : 500 });
  }
}
