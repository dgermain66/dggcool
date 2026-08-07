import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import os from "os";
import { spawn } from "child_process";

export const runtime = "nodejs";
export const maxDuration = 120;

const TMP = path.join(os.tmpdir(), "dggcool-stitch");

async function downloadToFile(url: string, out: string): Promise<number> {
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (!res.body) throw new Error("No body");
  const ws = fs.createWriteStream(out);
  const reader = res.body.getReader();
  let total = 0;
  try { while (true) { const { done, value } = await reader.read(); if (done) break; ws.write(value); total += value.length; } }
  finally { ws.end(); await new Promise<void>((r,j) => { ws.on("finish",r); ws.on("error",j); }); }
  return total;
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn("ffmpeg", ["-y", ...args], { stdio: ["pipe","pipe","pipe"] });
    let stderr = "";
    p.stderr.on("data", d => stderr += d.toString());
    p.on("error", e => reject(new Error(`ffmpeg spawn: ${e.message}`)));
    p.on("close", code => code === 0 ? resolve() : reject(new Error(`ffmpeg exit ${code}: ${stderr.slice(-800)}`)));
  });
}

export async function POST(req: NextRequest) {
  const t0 = Date.now();
  try {
    const { videoUrls } = await req.json();
    if (!Array.isArray(videoUrls) || videoUrls.length === 0) {
      return NextResponse.json({ success: false, error: "videoUrls array required." }, { status: 400 });
    }
    if (videoUrls.length === 1) {
      // Single video — no stitching needed, just return it
      return NextResponse.json({ success: true, url: videoUrls[0], clips: 1, elapsedMs: Date.now() - t0 });
    }

    if (!fs.existsSync(TMP)) fs.mkdirSync(TMP, { recursive: true });
    const id = crypto.createHash("md5").update(`${Date.now()}`).digest("hex").slice(0, 12);

    // Download all clips
    const clips: string[] = [];
    for (let i = 0; i < videoUrls.length; i++) {
      const clipPath = path.join(TMP, `clip_${id}_${i}.mp4`);
      const url = videoUrls[i];
      if (url.startsWith("data:")) {
        const b64 = url.split(",")[1];
        fs.writeFileSync(clipPath, Buffer.from(b64, "base64"));
      } else {
        await downloadToFile(url, clipPath);
      }
      clips.push(clipPath);
    }

    // Create concat list file
    const listPath = path.join(TMP, `list_${id}.txt`);
    const listContent = clips.map(c => `file '${c.replace(/'/g, "'\\''")}'`).join("\n");
    fs.writeFileSync(listPath, listContent);

    // Stitch with ffmpeg concat demuxer (fast, no re-encode if codecs match)
    const outputPath = path.join(TMP, `stitched_${id}.mp4`);
    try {
      // Try fast concat first (works if all clips have same codec)
      await runFfmpeg(["-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", "-movflags", "+faststart", outputPath]);
    } catch {
      // Fallback: re-encode each clip to ensure compatibility
      // First, normalize all clips to same format
      const normalizedClips: string[] = [];
      for (let i = 0; i < clips.length; i++) {
        const normPath = path.join(TMP, `norm_${id}_${i}.mp4`);
        await runFfmpeg(["-i", clips[i], "-c:v", "libx264", "-preset", "fast", "-crf", "23", "-c:a", "aac", "-b:a", "128k", "-r", "30", "-s", "1280x720", "-aspect", "16:9", "-movflags", "+faststart", normPath]);
        normalizedClips.push(normPath);
      }
      // Update list with normalized clips
      const normListContent = normalizedClips.map(c => `file '${c.replace(/'/g, "'\\''")}'`).join("\n");
      fs.writeFileSync(listPath, normListContent);
      // Concat the normalized clips
      await runFfmpeg(["-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", "-movflags", "+faststart", outputPath]);
    }

    // Verify output
    if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size < 1024) {
      throw new Error("Stitching produced no output.");
    }

    // Read as data URL
    const buf = fs.readFileSync(outputPath);
    const dataUrl = `data:video/mp4;base64,${buf.toString("base64")}`;

    // Cleanup
    [...clips, listPath, outputPath].forEach(f => { try { fs.unlinkSync(f); } catch {} });

    return NextResponse.json({
      success: true,
      url: dataUrl,
      clips: videoUrls.length,
      fileSize: buf.length,
      elapsedMs: Date.now() - t0,
    });
  } catch (err: any) {
    console.error("[stitch-videos] error:", err?.message);
    return NextResponse.json({ success: false, error: err?.message || "Stitching failed." }, { status: 500 });
  }
}
