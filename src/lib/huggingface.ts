/**
 * HuggingFace video generation fallback.
 *
 * Free tier: https://huggingface.co/pricing (no card needed)
 * Get token: https://huggingface.co/settings/tokens
 *
 * Models used:
 * - damo-vilab/text-to-video-ms-1.7b (text-to-video, ~2s clips)
 * - stabilityai/stable-video-diffusion-img2vid-xt (image-to-video, ~4s clips)
 *
 * The HF inference API has cold starts (model loading ~20-40s on first call).
 * After that, generation takes ~10-30s depending on model load.
 *
 * Response is binary video data (mp4 or gif).
 */

const HF_TOKEN = process.env.HF_API_KEY || process.env.HUGGINGFACE_API_KEY;

interface HfVideoResult {
  videoBuffer: Buffer;
  contentType: string;
  model: string;
}

/**
 * Generate video from text using HuggingFace.
 * Returns a Buffer of video data.
 */
export async function generateVideoFromTextHf(
  prompt: string,
  retries = 2
): Promise<HfVideoResult> {
  if (!HF_TOKEN) {
    throw new Error("HF_API_KEY not configured");
  }

  const model = "damo-vilab/text-to-video-ms-1.7b";
  const url = `https://api-inference.huggingface.co/models/${model}`;

  let lastErr: any = null;
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${HF_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ inputs: prompt.slice(0, 500) }),
        signal: AbortSignal.timeout(90_000), // HF can take 60-90s on cold start
      });

      if (res.status === 503) {
        // Model is loading — wait and retry
        const wait = Number(res.headers.get("estimated_time") || 20);
        console.warn(`[hf-video] model loading, waiting ${wait}s...`);
        await new Promise((r) => setTimeout(r, Math.min(wait * 1000, 40000)));
        continue;
      }

      if (res.status === 429) {
        console.warn(`[hf-video] rate limited, waiting 10s...`);
        await new Promise((r) => setTimeout(r, 10000));
        continue;
      }

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HF HTTP ${res.status}: ${text.slice(0, 200)}`);
      }

      const contentType = res.headers.get("content-type") || "video/mp4";
      const arrayBuffer = await res.arrayBuffer();
      const videoBuffer = Buffer.from(new Uint8Array(arrayBuffer));

      if (videoBuffer.length < 1000) {
        throw new Error("HF returned empty video");
      }

      return { videoBuffer, contentType, model };
    } catch (e: any) {
      lastErr = e;
      if (attempt <= retries) {
        console.warn(`[hf-video] attempt ${attempt} failed: ${e?.message}, retrying...`);
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
  }

  throw lastErr || new Error("HuggingFace video generation failed");
}

/**
 * Check if HuggingFace is configured.
 */
export function isHfConfigured(): boolean {
  return !!HF_TOKEN;
}

/**
 * Get the HF token (for health endpoint).
 */
export function getHfStatus(): { configured: boolean; model: string | null } {
  return {
    configured: !!HF_TOKEN,
    model: HF_TOKEN ? "damo-vilab/text-to-video-ms-1.7b" : null,
  };
}
