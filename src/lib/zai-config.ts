/**
 * Z.AI config initialization.
 *
 * The z-ai-web-dev-sdk reads config from a file (NOT env vars). It checks:
 *   1. process.cwd()/.z-ai-config
 *   2. os.homedir()/.z-ai-config
 *   3. /etc/.z-ai-config
 *
 * On Vercel:
 *   - process.cwd() is READ-ONLY (Lambda bundle)
 *   - os.homedir() is WRITABLE (/home/sbx_user1055 or similar)
 *   - /etc/ is read-only
 *
 * So we write the config to os.homedir()/.z-ai-config from the ZAI_API_KEY
 * env var. This runs before any ZAI.create() call.
 *
 * Required env vars:
 *   ZAI_API_KEY   - Your Z.AI API key (from chat.z.ai → Settings → API Keys)
 */
import fs from "fs";
import path from "path";
import os from "os";

const CONFIG_FILENAME = ".z-ai-config";
let initialized = false;
let initResult: boolean | null = null;

export function ensureZaiConfig(): boolean {
  if (initialized) return initResult === true;

  // Priority 1: process.cwd()/.z-ai-config (works in sandbox, read-only on Vercel)
  const cwdConfig = path.join(process.cwd(), CONFIG_FILENAME);
  if (fs.existsSync(cwdConfig)) {
    initialized = true;
    initResult = true;
    return true;
  }

  // Priority 2: os.homedir()/.z-ai-config (writable on Vercel!)
  const homeConfig = path.join(os.homedir(), CONFIG_FILENAME);
  if (fs.existsSync(homeConfig)) {
    initialized = true;
    initResult = true;
    return true;
  }

  // Priority 3: /etc/.z-ai-config (sandbox only)
  if (fs.existsSync("/etc/.z-ai-config")) {
    initialized = true;
    initResult = true;
    return true;
  }

  // No config file found anywhere — create one in homedir from env var
  const apiKey = process.env.ZAI_API_KEY;
  if (!apiKey) {
    // No key set — Z.AI features will fail, but Pollinations fallback works
    initialized = true;
    initResult = false;
    return false;
  }

  const baseUrl = process.env.ZAI_BASE_URL || "https://api.z.ai/v1";
  const config = JSON.stringify({ baseUrl, apiKey });

  try {
    // Write to homedir (writable on Vercel)
    fs.writeFileSync(homeConfig, config, { mode: 0o600 });
    console.log(`[zai-config] Wrote config to ${homeConfig}`);
    initialized = true;
    initResult = true;
    return true;
  } catch (e: any) {
    console.error(`[zai-config] Failed to write to ${homeConfig}:`, e?.message);
    // Fallback: try /tmp (always writable on Vercel)
    const tmpConfig = path.join(os.tmpdir(), CONFIG_FILENAME);
    try {
      fs.writeFileSync(tmpConfig, config, { mode: 0o600 });
      console.log(`[zai-config] Wrote config to ${tmpConfig}`);
      // But the SDK won't check /tmp... so we need to also set HOME to /tmp
      // so the SDK's os.homedir() call returns /tmp
      process.env.HOME = os.tmpdir();
      initialized = true;
      initResult = true;
      return true;
    } catch (e2: any) {
      console.error(`[zai-config] Failed to write to ${tmpConfig}:`, e2?.message);
      initialized = true;
      initResult = false;
      return false;
    }
  }
}

// Auto-initialize on import
const configReady = ensureZaiConfig();
if (!configReady) {
  console.warn("[zai-config] ⚠️ No Z.AI config available. ZAI_API_KEY env var is not set. " +
    "Z.AI features (video, voiceover, LLM) will fail. " +
    "Add ZAI_API_KEY in Vercel → Settings → Environment Variables. " +
    "Get a free key at https://chat.z.ai → Settings → API Keys.");
}
