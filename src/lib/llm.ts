/**
 * Shared LLM call with Z.AI → Pollinations fallback.
 *
 * Z.AI's chat API is heavily rate-limited at times. Pollinations.ai offers
 * a free text generation API (no key) that we use as a fallback so the
 * Enhance / Keywords / Script features keep working even during Z.AI outages.
 *
 * Pollinations is flaky (~40% of requests return 402 or timeout), so we
 * retry up to 3 times with the anonymous GET endpoint.
 */
import ZAI from "z-ai-web-dev-sdk";
import { retryWithBackoff } from "./rate-limit";
import { ensureZaiConfig } from "./zai-config";

// Ensure config file exists before any ZAI.create() call
ensureZaiConfig();

export interface LlmMessage { role: "system" | "user" | "assistant"; content: string; }
export interface LlmResult { content: string; provider: "zai" | "pollinations"; elapsedMs: number; }

async function callZai(messages: LlmMessage[], label: string): Promise<string> {
  const zai = await ZAI.create();
  const response: any = await retryWithBackoff(
    async () => zai.chat.completions.create({ messages, stream: false, thinking: { type: "disabled" } }),
    { retries: 4, baseMs: 2000, maxMs: 12000, label }
  );
  const content = response?.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("Z.AI returned empty content");
  return content;
}

/**
 * Call Pollinations free text API (no key required).
 * Uses the simple GET endpoint (anonymous tier — no model param = free).
 * POST /openai with model=openai returns 402 ~40% of the time.
 * Retries up to 3 times since Pollinations is flaky.
 */
async function callPollinations(messages: LlmMessage[]): Promise<string> {
  const systemMsg = messages.find((m) => m.role === "system")?.content || "";
  const userMsg = messages.filter((m) => m.role === "user").map((m) => m.content).join("\n");
  const prompt = systemMsg ? `${systemMsg}\n\n${userMsg}` : userMsg;

  const encoded = encodeURIComponent(prompt.slice(0, 1800));
  const seed = Math.floor(Math.random() * 1_000_000);
  const url = `https://text.pollinations.ai/${encoded}?seed=${seed}`;

  let lastErr: any = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: { Accept: "text/plain" },
        signal: AbortSignal.timeout(20_000),
      });
      if (res.status === 429 || res.status === 402 || !res.ok) {
        lastErr = new Error(`Pollinations HTTP ${res.status}`);
        if (attempt < 3) await new Promise((r) => setTimeout(r, 1500 * attempt));
        continue;
      }
      const text = (await res.text()).trim();
      // Pollinations sometimes returns a JSON error string with 200 status
      if (!text || text.length < 2 || text.includes("402 Payment Required") || text.includes('"error"')) {
        lastErr = new Error("Pollinations returned error text");
        if (attempt < 3) await new Promise((r) => setTimeout(r, 1500 * attempt));
        continue;
      }
      return text;
    } catch (e: any) {
      lastErr = e;
      if (attempt < 3) await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
  throw lastErr || new Error("Pollinations failed after 3 attempts");
}

export async function callLlm(messages: LlmMessage[], label: string = "llm"): Promise<LlmResult> {
  const t0 = Date.now();
  try {
    const content = await callZai(messages, `zai-${label}`);
    return { content, provider: "zai", elapsedMs: Date.now() - t0 };
  } catch (zaiErr: any) {
    console.warn(`[llm:${label}] Z.AI failed (${zaiErr?.message?.slice(0,100)}), trying Pollinations...`);
    try {
      const content = await callPollinations(messages);
      return { content, provider: "pollinations", elapsedMs: Date.now() - t0 };
    } catch (pollErr: any) {
      console.error(`[llm:${label}] Pollinations also failed:`, pollErr?.message || pollErr);
      // Check if Z.AI has recovered by now (the retry took ~30s, Z.AI may have reset)
      console.warn(`[llm:${label}] Both failed. Trying Z.AI one final time...`);
      try {
        const content = await callZai(messages, `zai-${label}-retry`);
        return { content, provider: "zai", elapsedMs: Date.now() - t0 };
      } catch (finalErr: any) {
        const err = new Error("The AI writing engine is rate-limited right now. We tried Z.AI + Pollinations + Z.AI again. Please wait 1-2 minutes and try again.");
        (err as any).rateLimited = true;
        throw err;
      }
    }
  }
}
