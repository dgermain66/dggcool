import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import os from "os";
import { generateVideoFromTextHf, isHfConfigured } from "@/lib/huggingface";

export const runtime = "nodejs";
export const maxDuration = 120;

const OUT = path.join(os.tmpdir(), "dggcool-hf-videos");

export async function POST(req: NextRequest) {
  const t0 = Date.now();
  try {
    if (!isHfConfigured()) {
      return NextResponse.json({
        success: false,
        error: "HuggingFace not configured. Set HF_API_KEY env var.",
      }, { status: 503 });
    }

    const { prompt } = await req.json();
    if (!prompt?.trim()) {
      return NextResponse.json({ success: false, error: "Prompt required." }, { status: 400 });
    }

    if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

    const result = await generateVideoFromTextHf(prompt.trim());

    // Save to /tmp and return as data URL
    const dataUrl = `data:${result.contentType};base64,${result.videoBuffer.toString("base64")}`;

    return NextResponse.json({
      success: true,
      url: dataUrl,
      prompt: prompt.trim(),
      provider: "huggingface",
      model: result.model,
      fileSize: result.videoBuffer.length,
      elapsedMs: Date.now() - t0,
    });
  } catch (err: any) {
    console.error("[hf-video] error:", err?.message);
    return NextResponse.json({
      success: false,
      error: err?.message || "HuggingFace video generation failed.",
    }, { status: 500 });
  }
}
