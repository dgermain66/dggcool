import { NextResponse } from "next/server";
import v8 from "v8";

export const runtime = "nodejs";

export async function GET() {
  const mem = process.memoryUsage();
  const heap = v8.getHeapStatistics();
  return NextResponse.json({
    success: true, status: "ok", service: "DGGCOOL Generator Server", version: "1.1.0",
    timestamp: new Date().toISOString(),
    uptime: `${Math.round(process.uptime())}s`,
    memory: {
      rss: `${Math.round(mem.rss/1048576)} MB`,
      heapUsed: `${Math.round(mem.heapUsed/1048576)} MB`,
      heapLimit: `${Math.round(heap.heap_size_limit/1048576)} MB`,
      heapUsedPct: `${Math.round(mem.heapUsed/heap.heap_size_limit*100)}%`,
    },
    capabilities: {
      "text-to-video": { endpoint: "/api/generate-video", statusEndpoint: "/api/video-status" },
      "image-to-video": { endpoint: "/api/generate-video", accepts: "base64 image" },
      "image-generation": { endpoint: "/api/generate-image", providers: ["turbo","pollinations","zai"], freeProviders: ["turbo","pollinations"] },
      "prompt-enhancement": { endpoint: "/api/enhance-prompt" },
      "script-generation": { endpoint: "/api/script" },
      "keywords-generator": { endpoint: "/api/generate-from-keywords" },
      "voiceover": { endpoint: "/api/generate-voiceover", voices: ["tongtong","jam","xiaochen","chuichui","kazi","douji","luodo"] },
      "mux-audio": { endpoint: "/api/mux-video-audio" },
    },
  });
}
