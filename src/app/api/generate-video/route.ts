import { NextRequest, NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";
import { ensureZaiConfig } from "@/lib/zai-config";
ensureZaiConfig();
import { retryWithBackoff } from "@/lib/rate-limit";
import { generateVideoFromTextHf, isHfConfigured } from "@/lib/huggingface";

export const runtime = "nodejs";
export const maxDuration = 120;

const SUPPORTED_SIZES = ["1920x1080","1280x720","1080x1920","1024x1024"];
const SAFE_FPS = [30];
const safeFps = (n: number) => SAFE_FPS.includes(n) ? n : 30;
const SAFE_DUR = [5, 10];
const safeDur = (n: number) => SAFE_DUR.includes(n) ? n : 5;

export async function POST(req: NextRequest) {
  try {
    const { prompt, imageUrl, size = "1280x720", duration = 5, fps = 30, quality = "speed", with_audio = false } = await req.json();
    if (!prompt?.trim()) return NextResponse.json({ success: false, error: "Prompt required." }, { status: 400 });
    if (!SUPPORTED_SIZES.includes(size)) return NextResponse.json({ success: false, error: "Unsupported size." }, { status: 400 });

    // === Try Z.AI first (supports image-to-video + text-to-video) ===
    try {
      const zai = await ZAI.create();
      const params: Record<string, unknown> = { prompt: prompt.trim(), quality, with_audio: !!with_audio, size, fps: safeFps(fps), duration: safeDur(duration) };
      if (imageUrl?.startsWith("data:image/")) params.image_url = imageUrl;
      const task: any = await retryWithBackoff(() => zai.video.generations.create(params as any), { retries: 3, baseMs: 3000, maxMs: 15000, label: "zai-video" });
      return NextResponse.json({ success: true, taskId: task.id, taskStatus: task.task_status, model: task.model || null, provider: "zai" });
    } catch (zaiErr: any) {
      const msg = String(zaiErr?.message || "").toLowerCase();
      const is429 = msg.includes("429") || msg.includes("too many requests");

      // === Fallback: HuggingFace (text-to-video only, no image support) ===
      // Only use HF for text-to-video (no image), and only if Z.AI failed
      if (!imageUrl && isHfConfigured()) {
        console.warn("[generate-video] Z.AI failed, trying HuggingFace fallback...");
        try {
          const hfResult = await generateVideoFromTextHf(prompt.trim());
          const dataUrl = `data:${hfResult.contentType};base64,${hfResult.videoBuffer.toString("base64")}`;
          return NextResponse.json({
            success: true,
            // Return the video directly (no polling needed — HF is synchronous)
            directVideoUrl: dataUrl,
            provider: "huggingface",
            model: hfResult.model,
            fileSize: hfResult.videoBuffer.length,
          });
        } catch (hfErr: any) {
          console.error("[generate-video] HuggingFace also failed:", hfErr?.message);
          // Both failed — return Z.AI's error (more informative)
        }
      }

      const is502 = msg.includes("502") || msg.includes("bad gateway");
      const isTimeout = msg.includes("timeout") || msg.includes("timed out");
      const friendlyError = is429
        ? "Video engine rate-limited. Retried 3×. " + (isHfConfigured() ? "HuggingFace fallback also failed." : "Wait ~60s or set HF_API_KEY for backup.")
        : is502
          ? "Video engine returned 502 (overloaded). Retried 3×. Try again in a moment."
          : isTimeout
            ? "Video engine timed out. Try again."
            : zaiErr?.message || "Video generation failed.";
      return NextResponse.json({ success: false, error: friendlyError, retryAfterMs: is429 ? 60000 : 0 }, { status: is429 ? 429 : 502 });
    }
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || "Unknown error." }, { status: 500 });
  }
}
