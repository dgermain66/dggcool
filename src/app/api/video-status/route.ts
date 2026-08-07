import { NextRequest, NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";
import { ensureZaiConfig } from "@/lib/zai-config";
ensureZaiConfig();

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { taskId } = await req.json();
    if (!taskId) return NextResponse.json({ success: false, error: "taskId required." }, { status: 400 });
    const zai = await ZAI.create();
    const result: any = await zai.async.result.query(taskId);
    const status = result?.task_status || "UNKNOWN";
    let videoUrl: string | null = null;
    if (status === "SUCCESS") videoUrl = result?.video_result?.[0]?.url || result?.video_url || result?.url || result?.video || null;
    return NextResponse.json({ success: true, taskId, taskStatus: status, videoUrl, model: result?.model || null });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 });
  }
}
