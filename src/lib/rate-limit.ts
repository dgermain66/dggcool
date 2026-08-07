/**
 * Rate-limit + retry utilities for upstream AI providers.
 */
const locks = new Map<string, Promise<unknown>>();

async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(key) || Promise.resolve();
  let release!: () => void;
  const next = new Promise<void>((r) => (release = r));
  locks.set(key, prev.then(() => next));
  await prev;
  try { return await fn(); }
  finally { release(); await new Promise((r) => setTimeout(r, 150 + Math.random() * 100)); }
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  opts: { retries?: number; baseMs?: number; maxMs?: number; label?: string } = {}
): Promise<T> {
  const retries = opts.retries ?? 3;
  const baseMs = opts.baseMs ?? 1200;
  const maxMs = opts.maxMs ?? 8000;
  const label = opts.label ?? "provider";
  let lastErr: any = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try { return await withLock(label, fn); }
    catch (e: any) {
      lastErr = e;
      const msg = String(e?.message || e).toLowerCase();
      const is429 = msg.includes("429") || msg.includes("too many requests");
      const is5xx = msg.includes("500")||msg.includes("502")||msg.includes("503")||msg.includes("504")||msg.includes("bad gateway")||msg.includes("service unavailable")||msg.includes("gateway timeout");
      const isTransient = msg.includes("fetch failed") || msg.includes("network");
      if (attempt === retries || (!is429 && !is5xx && !isTransient)) throw e;
      const delay = Math.min(maxMs, baseMs * 2 ** attempt) + Math.random() * 500;
      console.warn(`[retry:${label}] attempt ${attempt + 1}/${retries + 1} failed (${is429?"429":is5xx?"5xx":"transient"}), retrying in ${Math.round(delay)}ms — ${msg.slice(0,120)}`);
      await sleep(delay);
    }
  }
  throw lastErr;
}

import crypto from "crypto";
const llmCache = new Map<string, { value: string; ts: number }>();
const LLM_CACHE_TTL = 1000 * 60 * 30;
export function llmCached(key: string): string | null {
  const hit = llmCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.ts > LLM_CACHE_TTL) { llmCache.delete(key); return null; }
  return hit.value;
}
export function setLlmCache(key: string, value: string) {
  llmCache.set(key, { value, ts: Date.now() });
  if (llmCache.size > 200) { const k = llmCache.keys().next().value; if (k) llmCache.delete(k); }
}
export function hashKey(...parts: string[]): string {
  return crypto.createHash("sha1").update(parts.join("||")).digest("hex").slice(0, 16);
}
