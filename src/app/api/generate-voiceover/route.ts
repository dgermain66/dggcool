import { NextRequest, NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";
import { ensureZaiConfig } from "@/lib/zai-config";
ensureZaiConfig();

export const runtime = "nodejs";
export const maxDuration = 60;

const VOICES = ["tongtong","chuichui","xiaochen","jam","kazi","douji","luodo"] as const;

export async function POST(req: NextRequest) {
  const t0 = Date.now();
  try {
    const { text, voice = "tongtong", speed = 1.0 } = await req.json();
    if (!text?.trim()) return NextResponse.json({ success: false, error: "Text required." }, { status: 400 });
    if (text.length > 1024) return NextResponse.json({ success: false, error: `Text too long (${text.length} > 1024).` }, { status: 400 });
    if (!VOICES.includes(voice as any)) return NextResponse.json({ success: false, error: `Invalid voice. Available: ${VOICES.join(", ")}` }, { status: 400 });

    const zai = await ZAI.create();
    const response = await zai.audio.tts.create({ input: text.trim(), voice, speed: Math.max(0.5, Math.min(2.0, Number(speed)||1.0)), response_format: "wav", stream: false });
    const ab = await response.arrayBuffer();
    const buf = Buffer.from(new Uint8Array(ab));
    if (buf.length < 100) throw new Error("TTS empty");

    // Return as data URL (works on Vercel — no file system writes needed)
    const dataUrl = `data:audio/wav;base64,${buf.toString("base64")}`;
    return NextResponse.json({ success: true, url: dataUrl, text: text.trim(), voice, fileSize: buf.length, elapsedMs: Date.now()-t0 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 });
  }
}
