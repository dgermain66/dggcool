import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import os from "os";
import { spawn } from "child_process";

export const runtime = "nodejs";
export const maxDuration = 120;

const OUT = path.join(os.tmpdir(), "dggcool-mux");

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
    p.on("close", code => code === 0 ? resolve() : reject(new Error(`ffmpeg exit ${code}: ${stderr.slice(-1000)}`)));
  });
}

export async function POST(req: NextRequest) {
  const t0 = Date.now();
  try {
    const { videoUrl, audioUrl, mode = "replace" } = await req.json();
    if (!videoUrl || !audioUrl) return NextResponse.json({ success: false, error: "videoUrl and audioUrl required." }, { status: 400 });

    if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
    const id = crypto.createHash("md5").update(`${videoUrl}-${audioUrl}-${Date.now()}`).digest("hex").slice(0,12);
    const vTmp = path.join(OUT, `mux_${id}_v.mp4`); const aTmp = path.join(OUT, `mux_${id}_a.wav`);
    const outFile = path.join(OUT, `muxed_${id}.mp4`);

    // videoUrl and audioUrl are now data URLs (base64) — decode to files
    try {
      if (videoUrl.startsWith("data:")) {
        const b64 = videoUrl.split(",")[1];
        fs.writeFileSync(vTmp, Buffer.from(b64, "base64"));
      } else {
        await downloadToFile(videoUrl, vTmp);
      }
      if (audioUrl.startsWith("data:")) {
        const b64 = audioUrl.split(",")[1];
        fs.writeFileSync(aTmp, Buffer.from(b64, "base64"));
      } else {
        await downloadToFile(audioUrl, aTmp);
      }
    } catch (e: any) {
      try{fs.unlinkSync(vTmp);}catch{} try{fs.unlinkSync(aTmp);}catch{}
      return NextResponse.json({ success: false, error: `Download failed: ${e?.message}` }, { status: 502 });
    }

    const args = mode === "mix"
      ? ["-i",vTmp,"-i",aTmp,"-filter_complex","[0:a]volume=0.2[o];[o][1:a]amix=inputs=2:duration=shortest[a]","-map","0:v:0","-map","[a]","-c:v","copy","-c:a","aac","-b:a","192k","-shortest","-movflags","+faststart",outFile]
      : ["-i",vTmp,"-i",aTmp,"-map","0:v:0","-map","1:a:0","-c:v","copy","-c:a","aac","-b:a","192k","-shortest","-movflags","+faststart",outFile];
    try { await runFfmpeg(args); }
    catch {
      try { await runFfmpeg(["-i",vTmp,"-i",aTmp,"-map","0:v:0","-map","1:a:0","-c:v","libx264","-preset","fast","-crf","23","-c:a","aac","-b:a","192k","-shortest","-movflags","+faststart",outFile]); }
      catch (e2: any) { try{fs.unlinkSync(vTmp);}catch{} try{fs.unlinkSync(aTmp);}catch{} try{fs.unlinkSync(outFile);}catch{} return NextResponse.json({ success: false, error: `ffmpeg failed: ${e2?.message?.slice(0,600)}` }, { status: 500 }); }
    }
    if (!fs.existsSync(outFile) || fs.statSync(outFile).size < 1024) { try{fs.unlinkSync(vTmp);}catch{} try{fs.unlinkSync(aTmp);}catch{} return NextResponse.json({ success: false, error: "No output." }, { status: 500 }); }

    // Return as data URL
    const buf = fs.readFileSync(outFile);
    const dataUrl = `data:video/mp4;base64,${buf.toString("base64")}`;
    try{fs.unlinkSync(vTmp);}catch{} try{fs.unlinkSync(aTmp);}catch{} try{fs.unlinkSync(outFile);}catch{}
    return NextResponse.json({ success: true, url: dataUrl, mode, fileSize: buf.length, elapsedMs: Date.now()-t0 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 });
  }
}
