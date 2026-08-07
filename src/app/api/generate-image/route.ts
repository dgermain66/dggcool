import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import os from "os";
import ZAI from "z-ai-web-dev-sdk";
import { ensureZaiConfig } from "@/lib/zai-config";
ensureZaiConfig();

export const runtime = "nodejs";
export const maxDuration = 60; // Vercel Hobby caps at 10s, but we set 60s for Pro plan

const SUPPORTED = ["1024x1024","768x1344","864x1152","1344x768","1152x864","1440x720","720x1440"];

/**
 * Vercel Hobby plan caps functions at 10 seconds. Pollinations image API
 * takes 1-5s per attempt. We use a SINGLE attempt per provider with an 8s
 * timeout, and try providers in order. No retries (they push past 10s).
 *
 * On Vercel Pro plan, maxDuration is 60s so retries would work, but we
 * keep it simple and fast.
 */
const OUT = path.join(os.tmpdir(), "dggcool-generated");
function ensureDir(d: string) { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); }
function parseSize(s: string) { const [w,h] = s.split("x").map(n => parseInt(n,10)); return { w: w||1024, h: h||1024 }; }

async function streamUrlToFile(url: string, outPath: string, timeoutMs = 8000): Promise<number> {
  const res = await fetch(url, { method: "GET", headers: { Accept: "image/*" }, signal: AbortSignal.timeout(timeoutMs) });
  if (res.status === 429) { const e = new Error("HTTP 429"); (e as any).status = 429; throw e; }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (!res.body) throw new Error("No body");
  const ws = fs.createWriteStream(outPath);
  const reader = res.body.getReader();
  let total = 0;
  try { while (true) { const { done, value } = await reader.read(); if (done) break; ws.write(value); total += value.length; } }
  finally { ws.end(); await new Promise<void>((r,j) => { ws.on("finish",r); ws.on("error",j); }); }
  if (total < 1024) { try { fs.unlinkSync(outPath); } catch {} throw new Error("Truncated image"); }
  return total;
}

const COOLDOWN = 15000;
const health = new Map<string, number>();
const isCool = (n: string) => { const t = health.get(n); return t ? Date.now()-t < COOLDOWN : false; };

async function genZAI(prompt: string, size: string, out: string): Promise<number> {
  if (!process.env.ZAI_API_KEY && !fs.existsSync("/etc/.z-ai-config")) {
    throw new Error("ZAI_API_KEY not configured");
  }
  const zai = await ZAI.create();
  const r = await zai.images.generations.create({ prompt: prompt.trim(), size });
  if (!r?.data?.[0]?.base64) throw new Error("Z.AI no data");
  const b = Buffer.from(r.data[0].base64, "base64"); fs.writeFileSync(out, b); return b.length;
}

async function genPoll(prompt: string, size: string, out: string, model: string): Promise<number> {
  const { w, h } = parseSize(size);
  const seed = Math.floor(Math.random()*1_000_000);
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt.slice(0,400))}?width=${w}&height=${h}&nologo=true&seed=${seed}&model=${model}`;
  try { return await streamUrlToFile(url, out, 8000); }
  catch (e: any) {
    if (e?.status === 429) { health.set(model === "turbo" ? "turbo" : "pollinations", Date.now()); }
    throw e;
  }
}

function fileToDataUrl(filePath: string): string {
  const buf = fs.readFileSync(filePath);
  return `data:image/png;base64,${buf.toString("base64")}`;
}

export async function POST(req: NextRequest) {
  const t0 = Date.now();
  try {
    const { prompt, size = "1024x1024", provider = "auto" } = await req.json();
    if (!prompt?.trim()) return NextResponse.json({ success: false, error: "Prompt required." }, { status: 400 });
    if (!SUPPORTED.includes(size)) return NextResponse.json({ success: false, error: `Unsupported size.` }, { status: 400 });
    ensureDir(OUT);
    const hash = crypto.createHash("md5").update(`${prompt}-${size}-${Date.now()}`).digest("hex").slice(0,12);
    const filename = `img_${hash}.png`; const filepath = path.join(OUT, filename);

    // Provider order: fastest first. NO retries (Vercel Hobby 10s limit).
    const all = [
      { name: "turbo", fn: () => genPoll(prompt, size, filepath, "turbo") },
      { name: "pollinations", fn: () => genPoll(prompt, size, filepath, "flux") },
      { name: "zai", fn: () => genZAI(prompt, size, filepath) },
    ];
    let providers = provider === "auto" ? all : all.filter(p => p.name === provider);
    if (providers.length === 1 && isCool(providers[0].name)) providers = all;
    const avail = providers.filter(p => !isCool(p.name));
    const final = avail.length > 0 ? avail : providers;

    let lastErr: any = null, lastStatus: number | null = null, bytes = 0, used = null;
    const tried: { name: string; error: string }[] = [];
    for (const p of final) {
      if (fs.existsSync(filepath)) try { fs.unlinkSync(filepath); } catch {}
      try {
        bytes = await p.fn(); used = p.name; health.delete(p.name); break;
      } catch (e: any) {
        lastErr = e; lastStatus = (e as any).status || null;
        tried.push({ name: p.name, error: e?.message || "?" });
        console.error(`[img] ${p.name} failed:`, e?.message);
        // Don't retry — move to next provider immediately
      }
    }
    if (!used || bytes === 0) {
      if (fs.existsSync(filepath)) try { fs.unlinkSync(filepath); } catch {}
      const rl = tried.some(t => t.error.includes("429"));
      return NextResponse.json({
        success: false,
        error: rl
          ? "All image providers are rate-limited. Wait ~15s and try again."
          : `Generation failed: ${tried.map(t=>`${t.name}(${t.error})`).join("; ")}`,
        rateLimited: rl, tried, retryAfterMs: rl?COOLDOWN:0
      }, { status: lastStatus===429?429:502 });
    }
    const dataUrl = fileToDataUrl(filepath);
    try { fs.unlinkSync(filepath); } catch {}
    return NextResponse.json({
      success: true, url: dataUrl, prompt: prompt.trim(), size,
      provider: used, fileSize: bytes, elapsedMs: Date.now()-t0
    });
  } catch (err: any) {
    console.error("[img] fatal:", err?.message);
    return NextResponse.json({ success: false, error: err?.message || "Unknown error." }, { status: 500 });
  }
}
