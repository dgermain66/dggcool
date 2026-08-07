"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Wand2, Image as ImageIcon, Clapperboard, Film, FileText, Play, Download, Loader2, ChevronRight, ArrowRight, Zap, Layers, AudioLines, CheckCircle2, Star, Github, Twitter, Youtube, Menu, X, RefreshCw, AlertCircle, CircleCheck, Clock, Smartphone, Globe, RotateCcw, Upload, Save, FolderOpen, Trash2, ShoppingBag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { VoiceInputButton } from "@/components/voice-input-button";
import { KeywordGenerator } from "@/components/keyword-generator";

type VideoStatus = "IDLE" | "CREATING" | "PROCESSING" | "SUCCESS" | "FAIL" | "TIMEOUT";
type ImageStatus = "IDLE" | "GENERATING" | "SUCCESS" | "FAIL";
type ScriptStatus = "IDLE" | "WRITING" | "SUCCESS" | "FAIL";
interface GeneratedAsset { id: string; url: string; prompt: string; kind: "image" | "video"; createdAt: number; }

const uid = () => Math.random().toString(36).slice(2, 11);

const SAMPLE_PROMPTS = [
  "A neon cyberpunk city at night, rain-soaked streets reflecting holographic billboards, drone shot gliding between skyscrapers",
  "A majestic lion made of constellations and stardust, galloping across a midnight desert, cinematic, slow motion",
  "A surreal underwater scene with bioluminescent jellyfish drifting through an ancient sunken temple",
  "Aerial view of a tropical island transitioning through the four seasons in one continuous shot",
  "A retro 80s synthwave car driving down an infinite highway toward a purple sunset, vaporwave aesthetic",
  "Macro shot of paint exploding in zero gravity, vibrant colors mixing in slow motion, studio lighting",
];

const SHOWCASE = [
  { title: "Neon Dreams", tag: "Text → Video", gradient: "from-emerald-500 via-teal-500 to-cyan-500", img: "/generated/showcase/neon-dreams.png" },
  { title: "Ocean Whisper", tag: "Image → Video", gradient: "from-cyan-400 via-blue-500 to-sky-500", img: "/generated/showcase/ocean-whisper.png" },
  { title: "Cosmic Voyage", tag: "Text → Video", gradient: "from-teal-400 via-emerald-500 to-blue-500", img: "/generated/showcase/cosmic-voyage.png" },
  { title: "Urban Pulse", tag: "Image → Video", gradient: "from-emerald-400 via-teal-500 to-cyan-500", img: "/generated/showcase/urban-pulse.png" },
  { title: "Forest Spirit", tag: "Text → Video", gradient: "from-green-400 via-emerald-500 to-teal-600", img: "/generated/showcase/forest-spirit.png" },
  { title: "Solar Flare", tag: "Text → Video", gradient: "from-sky-400 via-blue-500 to-indigo-500", img: "/generated/showcase/solar-flare.png" },
];

const FEATURES = [
  { icon: Film, title: "Text-to-Video", desc: "Describe any scene in plain language and watch it come alive as a cinematic video clip in seconds.", color: "from-emerald-500 to-blue-600" },
  { icon: Clapperboard, title: "Image-to-Video", desc: "Upload a still image and direct the motion — animate portraits, products, and landscapes with natural movement.", color: "from-cyan-400 to-blue-600" },
  { icon: ImageIcon, title: "AI Image Studio", desc: "Generate photorealistic or stylized images in seven aspect ratios, from vertical mobile banners to wide cinematic landscapes.", color: "from-teal-400 to-emerald-600" },
  { icon: FileText, title: "AI Scriptwriter", desc: "Give a topic, get a scene-by-scene script with ready-to-use visual prompts. The fastest way to storyboard your next short.", color: "from-emerald-400 to-teal-600" },
  { icon: Wand2, title: "Prompt Enhancer", desc: "Our model rewrites your idea into a director-grade prompt with lighting, camera, mood, and style cues baked in.", color: "from-sky-400 to-blue-600" },
  { icon: AudioLines, title: "Audio & Voiceovers", desc: "Add generated audio tracks and voiceovers to your videos with a single toggle, ready for social or ads.", color: "from-teal-400 to-cyan-600" },
];

const STATS = [
  { value: "2.4M+", label: "Videos generated" },
  { value: "180+", label: "Countries" },
  { value: "98%", label: "Satisfaction" },
  { value: "100%", label: "Free forever" },
];

const FAQS = [
  { q: "How long does it take to generate a video?", a: "Most 5-second clips finish in under two minutes. Complex scenes or higher-quality settings can take longer — we'll show you live progress while you wait." },
  { q: "Can I use the videos commercially?", a: "Yes. DGGCOOL is free forever with a commercial license — you can publish your content on YouTube, TikTok, ads, or anywhere else." },
  { q: "What formats do you support?", a: "Videos export as MP4 up to 1080p. Images export as PNG in seven aspect ratios. Voiceovers export as WAV." },
  { q: "Do I need any editing skills?", a: "No. Just describe what you want in plain language. Our prompt enhancer and keywords generator turn even one-sentence ideas into director-grade prompts." },
  { q: "Is it really free?", a: "Yes, forever. No plans, no paywalls, no watermark. Made by creators, for creators." },
];

const SEEDED_PRESETS = SAMPLE_PROMPTS.slice(0, 6).map((p, i) => ({ prompt: p, url: `/generated/showcase/${["neon-dreams","cosmic-voyage","ocean-whisper","urban-pulse","forest-spirit","solar-flare"][i]}.png` }));
const imageCache = new Map<string, string>();
const cacheKey = (p: string, s: string) => `${p.trim().toLowerCase()}::${s}`;

/* Safe JSON fetch — handles non-JSON responses, timeouts, and network errors.
 * Returns { success: false, error } instead of throwing on parse failure. */
async function safeFetchJson(url: string, body: unknown, timeoutMs = 60000): Promise<any> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timer);
    const text = await r.text();
    if (!text || text.length === 0) {
      return { success: false, error: `Server returned empty response (HTTP ${r.status}). The AI engine may be overloaded — try again in a moment.` };
    }
    try {
      return JSON.parse(text);
    } catch {
      // Server returned non-JSON (probably an HTML error page or partial response)
      return { success: false, error: `Server returned an invalid response (HTTP ${r.status}). Try again in a moment.` };
    }
  } catch (e: any) {
    if (e?.name === "AbortError") {
      return { success: false, error: "Request timed out. The AI engine is slow right now — try again." };
    }
    return { success: false, error: e?.message || "Network error." };
  }
}

/* ============================================================ Navbar ============================================================ */
function Navbar({ onLaunch }: { onLaunch: () => void }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => { const f = () => setScrolled(window.scrollY > 24); f(); window.addEventListener("scroll", f, { passive: true }); return () => window.removeEventListener("scroll", f); }, []);
  const links = [{ label: "Features", href: "#features" }, { label: "Studio", href: "#studio" }, { label: "Showcase", href: "#showcase" }, { label: "FAQ", href: "#faq" }];
  return (
    <header className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrolled ? "glass-strong border-b border-white/5" : ""}`}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <a href="#" className="flex items-center gap-2 group">
            <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 via-teal-500 to-blue-500 grid place-items-center glow-sm"><Sparkles className="w-5 h-5 text-white" /></div>
            <span className="text-lg font-bold tracking-tight">DGG<span className="gradient-text">COOL</span></span>
          </a>
          <nav className="hidden md:flex items-center gap-1">
            {links.map(l => <a key={l.href} href={l.href} className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">{l.label}</a>)}
          </nav>
          <div className="hidden md:flex items-center gap-2">
            <Button variant="ghost" size="sm" className="text-muted-foreground">Sign in</Button>
            <Button size="sm" onClick={onLaunch} className="bg-gradient-to-r from-emerald-500 to-blue-600 hover:from-emerald-400 hover:to-blue-500 border-0 text-white">Launch Studio<ArrowRight className="ml-1 w-4 h-4" /></Button>
          </div>
          <button className="md:hidden p-2" onClick={() => setOpen(v => !v)} aria-label="Toggle menu">{open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}</button>
        </div>
        <AnimatePresence>{open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="md:hidden overflow-hidden glass-strong border-t border-white/5">
            <div className="px-2 py-3 flex flex-col gap-1">
              {links.map(l => <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="px-3 py-2 rounded-lg text-sm hover:bg-white/5">{l.label}</a>)}
              <Button size="sm" className="mt-2 bg-gradient-to-r from-emerald-500 to-blue-600 border-0 text-white" onClick={() => { setOpen(false); onLaunch(); }}>Launch Studio</Button>
            </div>
          </motion.div>
        )}</AnimatePresence>
      </div>
    </header>
  );
}

/* ============================================================ Hero ============================================================ */
function Hero({ onLaunch }: { onLaunch: () => void }) {
  return (
    <section className="relative pt-32 pb-24 overflow-hidden">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute top-20 -left-20 w-[28rem] h-[28rem] rounded-full bg-emerald-600/30 blur-3xl animate-blob" />
        <div className="absolute top-10 right-0 w-[24rem] h-[24rem] rounded-full bg-blue-600/30 blur-3xl animate-blob [animation-delay:4s]" />
        <div className="absolute bottom-0 left-1/3 w-[26rem] h-[26rem] rounded-full bg-teal-500/20 blur-3xl animate-blob [animation-delay:8s]" />
        <div className="absolute inset-0 grid-bg opacity-60" />
        <div className="absolute inset-0 noise" />
      </div>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <Badge variant="secondary" className="mb-6 glass border-white/10 text-foreground">
              <span className="relative flex h-2 w-2 mr-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" /></span>
              Free forever — no signup, no paywall
            </Badge>
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.05 }} className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-balance max-w-4xl">
            Turn words into <span className="gradient-text">cinema</span>.<br />In seconds.
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.15 }} className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl text-balance">
            DGGCOOL is the AI creative studio for video, images, and scripts. Describe it. Direct it. Ship it. No editing skills required.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.25 }} className="mt-10 flex flex-col sm:flex-row items-center gap-3">
            <Button size="lg" onClick={onLaunch} className="bg-gradient-to-r from-emerald-500 via-teal-500 to-blue-500 hover:opacity-95 border-0 text-white px-8 py-6 text-base glow"><Wand2 className="mr-2 w-5 h-5" />Start creating — free</Button>
            <a href="#showcase"><Button size="lg" variant="outline" className="glass border-white/10 px-8 py-6 text-base"><Play className="mr-2 w-4 h-4" />Watch showcase</Button></a>
          </motion.div>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.7, delay: 0.4 }} className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5"><div className="flex">{[...Array(5)].map((_,i)=><Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />)}</div><span>4.9/5 from 3,200+ creators</span></div>
            <div className="hidden sm:block w-1 h-1 rounded-full bg-muted-foreground/40" />
            <div className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-400" /><span>No credit card required</span></div>
          </motion.div>
        </div>
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.5 }} className="mt-20 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {STATS.map(s => <div key={s.label} className="glass rounded-2xl p-5 text-center hover:glow-sm transition-shadow"><div className="text-3xl font-bold gradient-text">{s.value}</div><div className="text-sm text-muted-foreground mt-1">{s.label}</div></div>)}
        </motion.div>
      </div>
    </section>
  );
}

/* ============================================================ Logo marquee ============================================================ */
function LogoMarquee() {
  const brands = ["PIXELFORGE","NEONWAVE","STUDIO42","ATLAS FILMS","VANTAGE","LUMA COLLECTIVE","ECHO LABS","NORTH STAR"];
  return (
    <section className="py-10 border-y border-white/5 overflow-hidden">
      <div className="mx-auto max-w-7xl px-4">
        <p className="text-center text-xs uppercase tracking-widest text-muted-foreground mb-6">Trusted by fast-moving creative teams</p>
        <div className="relative overflow-hidden"><div className="flex gap-12 animate-marquee whitespace-nowrap">{[...brands, ...brands].map((b,i)=><span key={i} className="text-lg font-semibold text-muted-foreground/50 tracking-wider">{b}</span>)}</div></div>
      </div>
    </section>
  );
}

/* ============================================================ Features ============================================================ */
function Features() {
  return (
    <section id="features" className="py-24 relative">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto text-center">
          <Badge variant="secondary" className="glass border-white/10 mb-4"><Layers className="w-3 h-3 mr-1.5" />The toolkit</Badge>
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-balance">Everything you need to <span className="gradient-text">make</span> — nothing you don't.</h2>
          <p className="mt-4 text-lg text-muted-foreground">One studio for the entire creative pipeline: ideate, generate, animate, and export.</p>
        </div>
        <div className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f,i) => (
            <motion.div key={f.title} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.5, delay: (i%3)*0.08 }}>
              <Card className="group glass border-white/5 hover:border-white/15 transition-all hover:-translate-y-1 h-full">
                <CardContent className="p-6">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${f.color} grid place-items-center mb-5 shadow-lg`}><f.icon className="w-6 h-6 text-white" /></div>
                  <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================================================ PromptBox ============================================================ */
function PromptBox({ value, onChange, onEnhance, enhancing, placeholder, rows = 4, voiceLang = "fr-FR" }: { value: string; onChange: (v: string) => void; onEnhance: () => void; enhancing: boolean; placeholder: string; rows?: number; voiceLang?: string; }) {
  return (
    <div className="relative">
      <Textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows} className="bg-background/40 border-white/10 focus-visible:ring-emerald-500/40 resize-none pr-44" />
      <div className="absolute top-2 right-2 flex gap-1.5">
        <VoiceInputButton value={value} onChange={onChange} lang={voiceLang} mode="append" size="sm" className="glass border-white/10 hover:border-white/20" />
        <Button type="button" size="sm" variant="secondary" onClick={onEnhance} disabled={enhancing || !value.trim()} className="glass border-white/10 hover:border-white/20">
          {enhancing ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Wand2 className="w-4 h-4 mr-1.5" />}Enhance
        </Button>
      </div>
    </div>
  );
}

function PromptPresets({ onPick }: { onPick: (p: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {SAMPLE_PROMPTS.slice(0,3).map((p,i) => <button key={i} onClick={() => onPick(p)} className="text-xs px-3 py-1.5 rounded-full glass border-white/5 hover:border-white/20 hover:bg-white/5 transition-colors text-muted-foreground text-left max-w-full truncate" title={p}>{p.length > 50 ? p.slice(0,50)+"…" : p}</button>)}
    </div>
  );
}

/* ============================================================ VideoPreview ============================================================ */
function VideoPreview({ status, videoUrl, error, taskId, pollElapsed, onKeepWaiting, onSaveVideo }: { status: VideoStatus; videoUrl: string | null; error: string | null; taskId: string | null; pollElapsed?: number | null; onKeepWaiting?: () => void; onSaveVideo?: (url: string) => void; }) {
  return (
    <div className="relative aspect-video rounded-2xl overflow-hidden glass border-white/10 grid place-items-center">
      {(status === "IDLE" || status === "CREATING" || status === "PROCESSING" || status === "TIMEOUT") && <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/30 via-teal-900/20 to-blue-900/20" />}
      {status === "IDLE" && (
        <div className="text-center px-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/30 to-blue-500/30 grid place-items-center mx-auto mb-4"><Film className="w-8 h-8 text-emerald-300" /></div>
          <p className="text-sm text-muted-foreground">Your generated video will appear here.</p>
        </div>
      )}
      {(status === "CREATING" || status === "PROCESSING") && (
        <div className="text-center px-6">
          <div className="relative w-20 h-20 mx-auto mb-5">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-emerald-500 to-blue-600 opacity-20 animate-ping" />
            <div className="absolute inset-2 rounded-full bg-gradient-to-br from-emerald-500 to-blue-600 opacity-40 animate-pulse" />
            <div className="absolute inset-0 grid place-items-center"><Loader2 className="w-7 h-7 text-emerald-200 animate-spin" /></div>
          </div>
          <p className="text-sm font-medium text-foreground">{status === "CREATING" ? "Submitting to the engine…" : "Rendering your video…"}</p>
          <p className="text-xs text-muted-foreground mt-1">{pollElapsed != null ? `Elapsed: ${pollElapsed}s • Z.AI can take 1–10 min under load.` : "This usually takes 30–90 seconds. Keep this tab open."}</p>
          {taskId && <p className="text-[10px] text-muted-foreground/60 mt-2 font-mono">Task: {taskId.slice(0,18)}…</p>}
        </div>
      )}
      {status === "SUCCESS" && videoUrl && (
        <div className="absolute inset-0 flex flex-col">
          <video src={videoUrl} controls autoPlay loop playsInline className="w-full h-full object-contain bg-black" />
          <div className="absolute top-3 right-3 flex gap-2">
            <Button size="sm" onClick={() => onSaveVideo?.(videoUrl)} className="bg-emerald-600/80 backdrop-blur border border-emerald-400/30 hover:bg-emerald-600 text-white">
              <Save className="w-4 h-4 mr-1.5" />Save
            </Button>
            <a href={videoUrl} target="_blank" rel="noopener noreferrer"><Button size="sm" className="bg-black/60 backdrop-blur border border-white/10 hover:bg-black/80 text-white"><Download className="w-4 h-4 mr-1.5" />Download</Button></a>
          </div>
        </div>
      )}
      {status === "TIMEOUT" && (
        <div className="text-center px-6">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/15 grid place-items-center mx-auto mb-4"><Clock className="w-8 h-8 text-amber-400" /></div>
          <p className="text-sm font-medium text-foreground">Still rendering…</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">{error}</p>
          <p className="text-[11px] text-muted-foreground mt-2">The task is still alive on Z.AI's servers. You can keep waiting, or try again later.</p>
          <div className="flex gap-2 justify-center mt-4">{onKeepWaiting && <Button size="sm" onClick={onKeepWaiting} className="bg-gradient-to-r from-emerald-500 to-blue-600 hover:opacity-95 border-0 text-white"><Loader2 className="w-3.5 h-3.5 mr-1.5" />Keep waiting</Button>}</div>
          {taskId && <p className="text-[10px] text-muted-foreground/60 mt-3 font-mono">Task: {taskId.slice(0,18)}…</p>}
        </div>
      )}
      {status === "FAIL" && (
        <div className="text-center px-6">
          <div className="w-16 h-16 rounded-2xl bg-red-500/15 grid place-items-center mx-auto mb-4"><AlertCircle className="w-8 h-8 text-red-400" /></div>
          <p className="text-sm font-medium text-foreground">Generation failed</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">{error || "Something went wrong. Please try again."}</p>
        </div>
      )}
    </div>
  );
}

/* ============================================================ TextToVideoPanel ============================================================ */
function TextToVideoPanel({ toast }: { toast: ReturnType<typeof useToast>["toast"]; }) {
  const [prompt, setPrompt] = useState("");
  const [enhanced, setEnhanced] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [size, setSize] = useState("1280x720");
  const [duration, setDuration] = useState(5);
  const [sceneCount, setSceneCount] = useState(1);
  const [withAudio, setWithAudio] = useState(false);
  const [quality, setQuality] = useState("speed");
  const [status, setStatus] = useState<VideoStatus>("IDLE");
  const [taskId, setTaskId] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pollElapsed, setPollElapsed] = useState<number | null>(null);
  const [batchProgress, setBatchProgress] = useState<string | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const [narration, setNarration] = useState("");
  const [voice, setVoice] = useState("tongtong");
  const [voiceGen, setVoiceGen] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [muxing, setMuxing] = useState(false);

  const VOICE_OPTS = [
    { value: "tongtong", label: "Tongtong", desc: "Warm (Creole OK)" },
    { value: "jam", label: "Jam", desc: "British English" },
    { value: "xiaochen", label: "Xiaochen", desc: "Professional" },
    { value: "chuichui", label: "Chuichui", desc: "Lively" },
    { value: "kazi", label: "Kazi", desc: "Clear" },
    { value: "douji", label: "Douji", desc: "Natural" },
    { value: "luodo", label: "Luodo", desc: "Expressive" },
  ];

  const handleEnhance = useCallback(async () => {
    if (!prompt.trim()) return;
    setEnhancing(true);
    try { const d = await safeFetchJson("/api/enhance-prompt", { prompt, mode: "video" }); if (d.success) { setPrompt(d.enhanced); setEnhanced(true); toast({ title: "Prompt enhanced" }); } else throw new Error(d.error); }
    catch (e: any) { toast({ title: "Enhancement failed", description: e?.message, variant: "destructive" }); }
    finally { setEnhancing(false); }
  }, [prompt, toast]);

  const startPolling = useCallback((id: string, allTasks: { id: string; url?: string }[] = []) => {
    if (pollRef.current) clearInterval(pollRef.current);
    let attempts = 0; const maxAttempts = 200; const t0 = Date.now();
    pollRef.current = setInterval(async () => {
      attempts++;
      try {
        // Single task mode
        if (allTasks.length <= 1) {
          const d = await safeFetchJson("/api/video-status", { taskId: id }, 15000);
          if (d.taskStatus === "SUCCESS" && d.videoUrl) { setStatus("SUCCESS"); setVideoUrl(d.videoUrl); setPollElapsed(null); if (pollRef.current) clearInterval(pollRef.current); toast({ title: "Video ready" }); }
          else if (d.taskStatus === "FAIL") { setStatus("FAIL"); setError("The generation task failed."); setPollElapsed(null); if (pollRef.current) clearInterval(pollRef.current); }
          else if (attempts >= maxAttempts) { setStatus("TIMEOUT"); setError(`Still rendering after ${Math.round((Date.now()-t0)/1000)}s.`); setPollElapsed(Math.round((Date.now()-t0)/1000)); if (pollRef.current) clearInterval(pollRef.current); }
          else { setStatus("PROCESSING"); setPollElapsed(Math.round((Date.now()-t0)/1000)); }
        } else {
          // Multi-task mode — poll all tasks in parallel
          const results = await Promise.all(allTasks.map(async (t) => {
            if (t.url) return t;
            const d = await safeFetchJson("/api/video-status", { taskId: t.id }, 15000);
            if (d.taskStatus === "SUCCESS" && d.videoUrl) return { id: t.id, url: d.videoUrl };
            return { id: t.id };
          }));
          const done = results.filter(r => r.url);
          const allDone = done.length === allTasks.length;
          if (allDone) {
            if (pollRef.current) clearInterval(pollRef.current);
            setBatchProgress(`Stitching ${done.length} clips...`);
            try {
              const stitchRes = await safeFetchJson("/api/stitch-videos", { videoUrls: done.map(r => r.url!) }, 120000);
              if (stitchRes.success) { setVideoUrl(stitchRes.url); setStatus("SUCCESS"); setPollElapsed(null); setBatchProgress(null); toast({ title: "Video ready", description: `${done.length} scenes stitched` }); }
              else throw new Error(stitchRes.error);
            } catch { setVideoUrl(done[0].url!); setStatus("SUCCESS"); setBatchProgress(null); toast({ title: "First clip ready (stitching failed)" }); }
          } else if (attempts >= maxAttempts) {
            setStatus("TIMEOUT"); setError(`Still rendering after ${Math.round((Date.now()-t0)/1000)}s.`); setPollElapsed(Math.round((Date.now()-t0)/1000)); setBatchProgress(null); if (pollRef.current) clearInterval(pollRef.current);
          } else { setStatus("PROCESSING"); setPollElapsed(Math.round((Date.now()-t0)/1000)); setBatchProgress(`${done.length}/${allTasks.length} clips ready...`); }
        }
      } catch {}
    }, 3000);
  }, [toast]);

  useEffect(() => { return () => { if (pollRef.current) clearInterval(pollRef.current); }; }, []);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) { toast({ title: "Prompt required", variant: "destructive" }); return; }
    setStatus("CREATING"); setVideoUrl(null); setError(null); setTaskId(null); setPollElapsed(null); setBatchProgress(null);
    try {
      if (sceneCount === 1) {
        // Single scene — original flow with auto-retry on 429
        let lastErr: any = null;
        for (let attempt = 1; attempt <= 3; attempt++) {
          setBatchProgress(attempt === 1 ? null : `Retry ${attempt}/3 in 30s...`);
          if (attempt > 1) { await new Promise(r => setTimeout(r, 30000)); }
          const d = await safeFetchJson("/api/generate-video", { prompt, size, duration, fps: 30, quality, with_audio: withAudio }, 120000);
          if (d.success) {
            if (d.directVideoUrl) { setVideoUrl(d.directVideoUrl); setStatus("SUCCESS"); toast({ title: "Video ready", description: `via ${d.provider}` }); return; }
            setTaskId(d.taskId); setStatus("PROCESSING"); toast({ title: "Generation started", description: d.provider ? `via ${d.provider}` : undefined }); startPolling(d.taskId);
            return;
          }
          lastErr = d.error;
          if (!d.error?.toLowerCase().includes("rate") && !d.error?.toLowerCase().includes("429")) break;
          toast({ title: `Attempt ${attempt} rate-limited`, description: attempt < 3 ? "Waiting 30s before retry..." : "All retries exhausted.", variant: "default" });
        }
        throw new Error(lastErr || "Generation failed");
      } else {
        // Multi-scene — submit N clips, then stitch
        setBatchProgress(`Submitting ${sceneCount} scenes...`);
        const tasks: { id: string; url?: string }[] = [];
        for (let i = 0; i < sceneCount; i++) {
          setBatchProgress(`Submitting scene ${i+1}/${sceneCount}...`);
          // Wait 15 seconds between submissions to avoid 429 rate limiting
          if (i > 0) await new Promise(r => setTimeout(r, 15000));
          try {
            const d = await safeFetchJson("/api/generate-video", { prompt, size, duration, fps: 30, quality, with_audio: false }, 120000);
            if (!d.success) throw new Error(d.error);
            if (d.directVideoUrl) { tasks.push({ id: `hf-${i}-${Date.now()}`, url: d.directVideoUrl }); }
            else if (d.taskId) { tasks.push({ id: d.taskId }); }
          } catch { toast({ title: `Scene ${i+1} skipped`, description: "Will continue.", variant: "default" }); }
        }
        if (tasks.length === 0) throw new Error("All scenes failed. Please try again.");
        // If all have URLs (HF), stitch immediately
        if (tasks.every(t => t.url)) {
          setBatchProgress(`Stitching ${tasks.length} clips...`);
          try { const sr = await safeFetchJson("/api/stitch-videos", { videoUrls: tasks.map(t => t.url!) }, 120000); if (sr.success) { setVideoUrl(sr.url); setStatus("SUCCESS"); setBatchProgress(null); toast({ title: "Video ready", description: `${tasks.length} scenes` }); return; } }
          catch { setVideoUrl(tasks[0].url!); setStatus("SUCCESS"); setBatchProgress(null); toast({ title: "First clip ready" }); return; }
        }
        setBatchProgress(`Waiting for ${tasks.length} clips to render...`);
        toast({ title: "Scenes submitted", description: `${tasks.length} clips rendering` });
        startPolling(tasks[0].id, tasks);
      }
    } catch (e: any) { setStatus("FAIL"); setError(e?.message); setBatchProgress(null); toast({ title: "Could not start", description: e?.message, variant: "destructive" }); }
  }, [prompt, size, duration, sceneCount, quality, withAudio, toast, startPolling]);

  const handleReset = () => { setStatus("IDLE"); setVideoUrl(null); setError(null); setTaskId(null); setAudioUrl(null); setPollElapsed(null); setBatchProgress(null); if (pollRef.current) clearInterval(pollRef.current); };
  const handleSaveVideo = useCallback(async (url: string) => {
    try {
      const d = await safeFetchJson("/api/saved-videos", { videoUrl: url, prompt, provider: "zai" });
      if (d.success) toast({ title: "Video saved!", description: "Saved to your collection with prompt." });
      else throw new Error(d.error);
    } catch (e: any) { toast({ title: "Save failed", description: e?.message, variant: "destructive" }); }
  }, [prompt, toast]);

  const handleKeepWaiting = useCallback(() => { if (!taskId) return; setStatus("PROCESSING"); setError(null); startPolling(taskId); }, [taskId, startPolling]);

  const handleGenVoice = useCallback(async () => {
    const text = narration.trim() || prompt.trim();
    if (!text) { toast({ title: "No narration", description: "Write narration or fill the prompt.", variant: "destructive" }); return; }
    setVoiceGen(true); setAudioUrl(null);
    try { const d = await safeFetchJson("/api/generate-voiceover", { text, voice, format: "wav" }); if (!d.success) throw new Error(d.error); setAudioUrl(d.url); toast({ title: "Voiceover ready", description: `${voice} • ${Math.round((d.elapsedMs||0)/100)/10}s` }); }
    catch (e: any) { toast({ title: "Voiceover failed", description: e?.message, variant: "destructive" }); }
    finally { setVoiceGen(false); }
  }, [narration, prompt, voice, toast]);

  const handleMux = useCallback(async () => {
    if (!videoUrl || !audioUrl) return;
    setMuxing(true);
    try { const d = await safeFetchJson("/api/mux-video-audio", { videoUrl, audioUrl, mode: "replace" }); if (!d.success) throw new Error(d.error); setVideoUrl(d.url); toast({ title: "Video + voiceover merged" }); }
    catch (e: any) { toast({ title: "Muxing failed", description: e?.message, variant: "destructive" }); }
    finally { setMuxing(false); }
  }, [videoUrl, audioUrl, toast]);

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="space-y-5">
        <div>
          <Label className="text-sm font-medium mb-2 block">Describe your video</Label>
          <PromptBox value={prompt} onChange={v => { setPrompt(v); setEnhanced(false); }} onEnhance={handleEnhance} enhancing={enhancing} placeholder="A drone shot over a neon-lit cyberpunk city at night…" voiceLang="fr-FR" />
          {enhanced && <p className="mt-2 text-xs text-emerald-400 flex items-center gap-1.5"><CircleCheck className="w-3.5 h-3.5" />Prompt enhanced</p>}
          <PromptPresets onPick={p => setPrompt(p)} />
        </div>
        <KeywordGenerator target="video-prompt" onPrompt={p => { setPrompt(p); setEnhanced(false); }} />
        <div className="grid grid-cols-2 gap-4">
          <div><Label className="text-xs uppercase tracking-wide text-muted-foreground mb-2 block">Resolution</Label>
            <Select value={size} onValueChange={setSize}><SelectTrigger className="bg-background/40 border-white/10"><SelectValue /></SelectTrigger><SelectContent>
              <SelectItem value="1920x1080">1920 × 1080 (16:9)</SelectItem><SelectItem value="1280x720">1280 × 720 (16:9)</SelectItem><SelectItem value="1080x1920">1080 × 1920 (9:16)</SelectItem><SelectItem value="1024x1024">1024 × 1024 (1:1)</SelectItem>
            </SelectContent></Select></div>
          <div><Label className="text-xs uppercase tracking-wide text-muted-foreground mb-2 block">Quality</Label>
            <Select value={quality} onValueChange={setQuality}><SelectTrigger className="bg-background/40 border-white/10"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="speed">Speed (faster)</SelectItem><SelectItem value="quality">Quality (slower)</SelectItem></SelectContent></Select></div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-2"><Label className="text-xs uppercase tracking-wide text-muted-foreground">Duration per scene</Label><span className="text-sm font-medium">{duration}s{sceneCount > 1 && ` × ${sceneCount} = ${duration * sceneCount}s total`}</span></div>
          <Slider value={[duration]} min={5} max={10} step={5} onValueChange={v => setDuration(v[0])} />
          <p className="text-[11px] text-muted-foreground mt-1.5">Each scene is 5s or 10s. {sceneCount > 1 && `Total video: ~${duration * sceneCount}s.`}</p>
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wide text-muted-foreground mb-2 block">Number of scenes</Label>
          <div className="grid grid-cols-5 gap-2">
            {[1,2,3,4,5].map(n => <button key={n} onClick={() => setSceneCount(n)} className={`p-2 rounded-lg border text-center transition-all ${sceneCount === n ? "border-emerald-500/60 bg-emerald-500/10 glow-sm text-foreground" : "border-white/10 bg-background/30 hover:border-white/20 text-muted-foreground"}`}><span className="text-sm font-semibold">{n}</span>{n > 1 && <span className="block text-[10px] text-muted-foreground">{duration * n}s</span>}</button>)}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1.5">{sceneCount === 1 ? "Single clip" : `${sceneCount} clips will be generated and stitched into one ${duration * sceneCount}s video.`}</p>
        </div>
        <div className="flex items-center justify-between p-3 rounded-xl glass border-white/5"><div><Label className="text-sm font-medium">Generate audio</Label><p className="text-xs text-muted-foreground">Add a synthesized audio track.</p></div><Switch checked={withAudio} onCheckedChange={setWithAudio} /></div>

        <div className="p-4 rounded-xl glass border-white/10 space-y-3">
          <div className="flex items-center gap-2"><AudioLines className="w-4 h-4 text-blue-400" /><Label className="text-sm font-semibold">Voiceover (Creole support)</Label></div>
          <p className="text-xs text-muted-foreground">Write narration in <strong className="text-foreground">Creole</strong> or any language. TTS reads it phonetically. <strong className="text-foreground">Tongtong</strong> works well for Creole.</p>
          <div className="relative">
            <Textarea value={narration} onChange={e => setNarration(e.target.value)} placeholder="Ekri istwa ou an Kreyòl… (e.g. 'Yon bèl solèy leve sou lanmè a…')" rows={3} className="bg-background/40 border-white/10 focus-visible:ring-blue-500/40 resize-none text-sm pr-12" />
            <div className="absolute top-2 right-2"><VoiceInputButton value={narration} onChange={setNarration} lang="fr-FR" mode="append" size="sm" className="glass border-white/10 hover:border-white/20" /></div>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground mb-2 block">Voice character</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {VOICE_OPTS.map(v => <button key={v.value} onClick={() => setVoice(v.value)} className={`p-2 rounded-lg border text-left transition-all ${voice === v.value ? "border-blue-500/60 bg-blue-500/10 glow-sm" : "border-white/10 bg-background/30 hover:border-white/20"}`}><div className="text-sm font-semibold">{v.label}</div><div className="text-[10px] text-muted-foreground truncate">{v.desc}</div></button>)}
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={handleGenVoice} disabled={voiceGen || (!narration.trim() && !prompt.trim())} className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:opacity-95 border-0 text-white">{voiceGen ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Generating…</> : <><AudioLines className="w-3.5 h-3.5 mr-1.5" />Generate voiceover</>}</Button>
            {audioUrl && <Button size="sm" variant="outline" onClick={handleMux} disabled={muxing || !videoUrl || status !== "SUCCESS"} className="glass border-white/10">{muxing ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Muxing…</> : <><Film className="w-3.5 h-3.5 mr-1.5" />Merge into video</>}</Button>}
          </div>
          {audioUrl && <div className="p-2.5 rounded-lg bg-background/40 border border-white/5"><div className="flex items-center gap-2 mb-2"><CircleCheck className="w-3.5 h-3.5 text-emerald-400" /><span className="text-xs font-medium">Voiceover ready</span><a href={audioUrl} target="_blank" rel="noopener noreferrer" className="ml-auto"><Button size="sm" variant="ghost" className="h-6 text-xs text-muted-foreground hover:text-foreground px-2"><Download className="w-3 h-3 mr-1" />WAV</Button></a></div><audio src={audioUrl} controls className="w-full h-8" style={{ filter: "invert(0.85) hue-rotate(180deg)" }} /></div>}
        </div>

        <div className="flex gap-2">
          <Button onClick={handleGenerate} disabled={status === "CREATING" || status === "PROCESSING" || status === "TIMEOUT"} className="flex-1 bg-gradient-to-r from-emerald-500 to-blue-600 hover:opacity-95 border-0 text-white h-11">{status === "CREATING" || status === "PROCESSING" ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{batchProgress || "Generating…"}</> : <><Sparkles className="w-4 h-4 mr-2" />{sceneCount > 1 ? `Generate ${sceneCount}-scene video (${duration * sceneCount}s)` : "Generate video"}</>}</Button>
          {(status === "SUCCESS" || status === "FAIL" || status === "TIMEOUT") && <Button variant="outline" onClick={handleReset} className="glass border-white/10"><RefreshCw className="w-4 h-4" /></Button>}
        </div>
      </div>
      <VideoPreview status={status} videoUrl={videoUrl} error={error} taskId={taskId} pollElapsed={pollElapsed} onKeepWaiting={handleKeepWaiting} onSaveVideo={handleSaveVideo} />
    </div>
  );
}

/* ============================================================ ImageToVideoPanel ============================================================ */
function ImageToVideoPanel({ toast }: { toast: ReturnType<typeof useToast>["toast"]; }) {
  const [prompt, setPrompt] = useState("");
  const [enhanced, setEnhanced] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  // Changed from single image to array of images
  const [images, setImages] = useState<{ id: string; url: string; name: string }[]>([]);
  const [size, setSize] = useState("1280x720");
  const [duration, setDuration] = useState(5);
  const [quality, setQuality] = useState("speed");
  const [status, setStatus] = useState<VideoStatus>("IDLE");
  const [taskId, setTaskId] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pollElapsed, setPollElapsed] = useState<number | null>(null);
  const [batchProgress, setBatchProgress] = useState<string | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const handleEnhance = useCallback(async () => {
    if (!prompt.trim()) return;
    setEnhancing(true);
    try { const d = await safeFetchJson("/api/enhance-prompt", { prompt, mode: "video" }); if (d.success) { setPrompt(d.enhanced); setEnhanced(true); toast({ title: "Prompt enhanced" }); } else throw new Error(d.error); }
    catch (e: any) { toast({ title: "Enhancement failed", description: e?.message, variant: "destructive" }); }
    finally { setEnhancing(false); }
  }, [prompt, toast]);

  // Handle multiple files — each becomes a scene
  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const valid: File[] = [];
    for (const f of Array.from(files)) {
      if (!f.type.startsWith("image/")) { toast({ title: "Invalid file", description: `${f.name} is not an image.`, variant: "destructive" }); continue; }
      if (f.size > 8*1024*1024) { toast({ title: "File too large", description: `${f.name} exceeds 8MB.`, variant: "destructive" }); continue; }
      valid.push(f);
    }
    if (valid.length === 0) return;
    const readers = valid.map(f => new Promise<{ id: string; url: string; name: string }>(res => {
      const r = new FileReader();
      r.onload = () => res({ id: uid(), url: r.result as string, name: f.name });
      r.readAsDataURL(f);
    }));
    Promise.all(readers).then(newImages => {
      setImages(prev => [...prev, ...newImages]);
      toast({ title: `${newImages.length} image${newImages.length > 1 ? "s" : ""} added`, description: `${images.length + newImages.length} total scene${images.length + newImages.length > 1 ? "s" : ""}` });
    });
  };

  const removeImage = (id: string) => {
    setImages(prev => prev.filter(img => img.id !== id));
  };

  const moveImage = (id: string, direction: "left" | "right") => {
    setImages(prev => {
      const idx = prev.findIndex(img => img.id === id);
      if (idx === -1) return prev;
      const newIdx = direction === "left" ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const newArr = [...prev];
      [newArr[idx], newArr[newIdx]] = [newArr[newIdx], newArr[idx]];
      return newArr;
    });
  };

  const startPolling = useCallback((id: string, allTasks: { id: string; url?: string }[] = []) => {
    if (pollRef.current) clearInterval(pollRef.current);
    let attempts = 0; const maxAttempts = 200; const t0 = Date.now();
    pollRef.current = setInterval(async () => {
      attempts++;
      try {
        // Poll all tasks in parallel
        const results = await Promise.all(allTasks.map(async (t) => {
          if (t.url) return t; // already done
          const d = await safeFetchJson("/api/video-status", { taskId: t.id }, 15000);
          if (d.taskStatus === "SUCCESS" && d.videoUrl) return { id: t.id, url: d.videoUrl };
          return { id: t.id };
        }));
        const done = results.filter(r => r.url);
        const allDone = done.length === allTasks.length;
        const anyFailed = results.some(r => !r.url); // simplified

        if (allDone) {
          // All clips ready — stitch them together
          if (pollRef.current) clearInterval(pollRef.current);
          setBatchProgress(`Stitching ${done.length} clips together...`);
          try {
            const stitchRes = await safeFetchJson("/api/stitch-videos", { videoUrls: done.map(r => r.url!) }, 120000);
            if (stitchRes.success) {
              setVideoUrl(stitchRes.url);
              setStatus("SUCCESS");
              setPollElapsed(null);
              setBatchProgress(null);
              toast({ title: "Video ready", description: `${done.length} scenes stitched` });
            } else {
              throw new Error(stitchRes.error);
            }
          } catch (e: any) {
            // If stitching fails, show the first clip
            setVideoUrl(done[0].url);
            setStatus("SUCCESS");
            setBatchProgress(null);
            toast({ title: "Clips ready (stitching failed)", description: "Showing first clip. Download others individually.", variant: "default" });
          }
        } else if (attempts >= maxAttempts) {
          setStatus("TIMEOUT");
          setError(`Still rendering after ${Math.round((Date.now()-t0)/1000)}s.`);
          setPollElapsed(Math.round((Date.now()-t0)/1000));
          setBatchProgress(null);
          if (pollRef.current) clearInterval(pollRef.current);
        } else {
          setStatus("PROCESSING");
          setPollElapsed(Math.round((Date.now()-t0)/1000));
          setBatchProgress(`${done.length}/${allTasks.length} clips ready...`);
        }
      } catch {}
    }, 3000);
  }, [toast]);

  useEffect(() => { return () => { if (pollRef.current) clearInterval(pollRef.current); }; }, []);

  const handleGenerate = useCallback(async () => {
    if (images.length === 0) { toast({ title: "At least one image required", variant: "destructive" }); return; }
    if (!prompt.trim()) { toast({ title: "Motion prompt required", variant: "destructive" }); return; }
    setStatus("CREATING"); setVideoUrl(null); setError(null); setTaskId(null); setPollElapsed(null); setBatchProgress(null);

    try {
      // Single image → single video
      if (images.length === 1) {
        const d = await safeFetchJson("/api/generate-video", { prompt, imageUrl: images[0].url, size, duration, fps: 30, quality, with_audio: false }, 120000);
        if (!d.success) throw new Error(d.error);
        // HuggingFace returns video directly (no polling needed)
        if (d.directVideoUrl) {
          setVideoUrl(d.directVideoUrl); setStatus("SUCCESS");
          toast({ title: "Video ready", description: `via ${d.provider}` });
          return;
        }
        setTaskId(d.taskId); setStatus("PROCESSING");
        toast({ title: "Generation started" });
        startPolling(d.taskId, [{ id: d.taskId }]);
      } else {
        // Multiple images → batch of videos, then stitch
        // Resilient: if a scene fails, skip it and retry at the end
        // Add delay between submissions to avoid Z.AI rate limiting (429)
        setBatchProgress(`Submitting ${images.length} scenes...`);
        const tasks: { id: string; url?: string }[] = [];
        const failedScenes: { index: number; image: { id: string; url: string; name: string } }[] = [];
        for (let i = 0; i < images.length; i++) {
          setBatchProgress(`Submitting scene ${i+1}/${images.length}...`);
          // Wait 3 seconds between submissions to avoid 429 rate limiting
          if (i > 0) await new Promise(r => setTimeout(r, 3000));
          try {
            const d = await safeFetchJson("/api/generate-video", { prompt, imageUrl: images[i].url, size, duration, fps: 30, quality, with_audio: false }, 120000);
            if (!d.success) throw new Error(d.error);
            // HF returns direct video (no polling)
            if (d.directVideoUrl) { tasks.push({ id: `hf-${i}-${Date.now()}`, url: d.directVideoUrl }); }
            else if (d.taskId) { tasks.push({ id: d.taskId }); }
          } catch (sceneErr: any) {
            failedScenes.push({ index: i, image: images[i] });
            toast({ title: `Scene ${i+1} rate-limited`, description: "Will retry after other scenes.", variant: "default" });
          }
        }

        // Retry failed scenes with longer delays
        if (failedScenes.length > 0 && tasks.length > 0) {
          setBatchProgress(`Retrying ${failedScenes.length} failed scene(s)...`);
          for (const failed of failedScenes) {
            // Wait 10 seconds before each retry (lets rate limit fully reset)
            await new Promise(r => setTimeout(r, 10000));
            setBatchProgress(`Retrying scene ${failed.index + 1}...`);
            try {
              const d = await safeFetchJson("/api/generate-video", { prompt, imageUrl: failed.image.url, size, duration, fps: 30, quality, with_audio: false }, 120000);
              if (d.success) {
                if (d.directVideoUrl) { tasks.push({ id: `hf-retry-${failed.index}-${Date.now()}`, url: d.directVideoUrl }); toast({ title: `Scene ${failed.index + 1} retry succeeded! (via ${d.provider})` }); }
                else if (d.taskId) { tasks.push({ id: d.taskId }); toast({ title: `Scene ${failed.index + 1} retry succeeded!` }); }
              }
            } catch {
              toast({ title: `Scene ${failed.index + 1} skipped`, description: "Rate-limited. Video will continue without it.", variant: "default" });
            }
          }
        }

        if (tasks.length === 0) {
          throw new Error("All scenes failed. Z.AI is rate-limiting heavily. Please wait 2-3 minutes and try again.");
        }

        // Check if all tasks already have URLs (all from HF — no polling needed)
        const allHaveUrls = tasks.every(t => t.url);
        if (allHaveUrls) {
          // All clips are ready (HF synchronous) — stitch immediately
          setBatchProgress(`Stitching ${tasks.length} clips...`);
          try {
            const stitchRes = await safeFetchJson("/api/stitch-videos", { videoUrls: tasks.map(t => t.url!) }, 120000);
            if (stitchRes.success) {
              setVideoUrl(stitchRes.url); setStatus("SUCCESS"); setBatchProgress(null);
              toast({ title: "Video ready", description: `${tasks.length} scenes stitched` });
            } else { throw new Error(stitchRes.error); }
          } catch {
            // Stitching failed — show first clip
            setVideoUrl(tasks[0].url!); setStatus("SUCCESS"); setBatchProgress(null);
            toast({ title: "First clip ready (stitching failed)" });
          }
          return;
        }

        const skippedCount = images.length - tasks.length;
        if (skippedCount > 0) {
          toast({ title: `${tasks.length}/${images.length} scenes submitted`, description: `${skippedCount} skipped due to rate limiting`, variant: "default" });
        } else {
          toast({ title: "All scenes submitted!", description: `${tasks.length} clips rendering` });
        }
        setStatus("PROCESSING");
        setBatchProgress(`Waiting for ${tasks.length} clips to render...`);
        startPolling(tasks[0].id, tasks);
      }
    } catch (e: any) { setStatus("FAIL"); setError(e?.message); setBatchProgress(null); }
  }, [images, prompt, size, duration, quality, toast, startPolling]);

  const handleReset = () => { setStatus("IDLE"); setVideoUrl(null); setError(null); setTaskId(null); setPollElapsed(null); setBatchProgress(null); if (pollRef.current) clearInterval(pollRef.current); };
  const handleSaveVideo = useCallback(async (url: string) => {
    try {
      const d = await safeFetchJson("/api/saved-videos", { videoUrl: url, prompt, provider: "zai", scenes: images.length });
      if (d.success) toast({ title: "Video saved!", description: "Saved to your collection with prompt." });
      else throw new Error(d.error);
    } catch (e: any) { toast({ title: "Save failed", description: e?.message, variant: "destructive" }); }
  }, [prompt, images.length, toast]);
  const handleKeepWaiting = useCallback(() => { if (!taskId) return; setStatus("PROCESSING"); setError(null); startPolling(taskId); }, [taskId, startPolling]);

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="space-y-5">
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-sm font-medium">Upload scene images ({images.length})</Label>
            {images.length > 0 && <Button size="sm" variant="ghost" onClick={() => setImages([])} className="h-6 text-xs text-muted-foreground hover:text-red-400">Clear all</Button>}
          </div>

          {/* Image gallery — shows uploaded images in order */}
          {images.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-3">
              {images.map((img, i) => (
                <div key={img.id} className="relative group aspect-square rounded-lg overflow-hidden glass border border-white/10">
                  <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
                  <div className="absolute top-1 left-1 text-[10px] bg-black/70 text-white px-1.5 py-0.5 rounded-full">{i+1}</div>
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                    <button onClick={() => moveImage(img.id, "left")} disabled={i === 0} className="w-6 h-6 rounded bg-white/20 hover:bg-white/40 text-white text-xs disabled:opacity-30" title="Move left">←</button>
                    <button onClick={() => moveImage(img.id, "right")} disabled={i === images.length - 1} className="w-6 h-6 rounded bg-white/20 hover:bg-white/40 text-white text-xs disabled:opacity-30" title="Move right">→</button>
                    <button onClick={() => removeImage(img.id)} className="w-6 h-6 rounded bg-red-500/80 hover:bg-red-500 text-white text-xs" title="Remove">✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Upload zone — always visible, allows adding more */}
          <div onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files); }} onClick={() => document.getElementById("iv-input")?.click()} className="cursor-pointer rounded-xl border-2 border-dashed border-white/15 hover:border-emerald-500/50 transition-colors p-5 text-center bg-background/30">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/30 to-blue-500/30 grid place-items-center mx-auto mb-2"><Clapperboard className="w-5 h-5 text-cyan-300" /></div>
            <p className="text-sm font-medium">{images.length > 0 ? "Add more images" : "Drop images here, or click to browse"}</p>
            <p className="text-xs text-muted-foreground mt-1">PNG, JPG, WebP — up to 8MB each. Multiple files OK.</p>
            <input id="iv-input" type="file" accept="image/*" multiple className="hidden" onChange={e => { handleFiles(e.target.files); e.target.value = ""; }} />
          </div>

          {images.length > 1 && (
            <p className="text-[11px] text-emerald-400/80 mt-2 flex items-center gap-1.5">
              <CircleCheck className="w-3 h-3" />
              {images.length} scenes will be generated and stitched into one video
            </p>
          )}
        </div>

        <div>
          <Label className="text-sm font-medium mb-2 block">Describe the motion</Label>
          <PromptBox value={prompt} onChange={v => { setPrompt(v); setEnhanced(false); }} onEnhance={handleEnhance} enhancing={enhancing} placeholder="Gentle parallax zoom, camera pushes in slowly…" rows={3} voiceLang="fr-FR" />
          {enhanced && <p className="mt-2 text-xs text-emerald-400 flex items-center gap-1.5"><CircleCheck className="w-3.5 h-3.5" />Prompt enhanced</p>}
        </div>
        <KeywordGenerator target="video-prompt" onPrompt={p => { setPrompt(p); setEnhanced(false); }} />
        <div className="grid grid-cols-2 gap-4">
          <div><Label className="text-xs uppercase tracking-wide text-muted-foreground mb-2 block">Resolution</Label><Select value={size} onValueChange={setSize}><SelectTrigger className="bg-background/40 border-white/10"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1920x1080">1920 × 1080</SelectItem><SelectItem value="1280x720">1280 × 720</SelectItem><SelectItem value="1080x1920">1080 × 1920</SelectItem><SelectItem value="1024x1024">1024 × 1024</SelectItem></SelectContent></Select></div>
          <div><Label className="text-xs uppercase tracking-wide text-muted-foreground mb-2 block">Quality</Label><Select value={quality} onValueChange={setQuality}><SelectTrigger className="bg-background/40 border-white/10"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="speed">Speed</SelectItem><SelectItem value="quality">Quality</SelectItem></SelectContent></Select></div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-2"><Label className="text-xs uppercase tracking-wide text-muted-foreground">Duration per scene</Label><span className="text-sm font-medium">{duration}s {images.length > 1 && `× ${images.length} = ${duration * images.length}s total`}</span></div>
          <Slider value={[duration]} min={5} max={10} step={5} onValueChange={v => setDuration(v[0])} />
          <p className="text-[11px] text-muted-foreground mt-1.5">Each scene is 5s or 10s. {images.length > 1 && `Total video: ~${duration * images.length}s.`}</p>
        </div>

        {/* Status hints */}
        <div className="space-y-1.5">
          {images.length === 0 && <p className="text-xs text-amber-400 flex items-center gap-1.5"><AlertCircle className="w-3 h-3" />Upload at least one image to enable generation</p>}
          {!prompt.trim() && <p className="text-xs text-amber-400 flex items-center gap-1.5"><AlertCircle className="w-3 h-3" />Write a motion description to enable generation</p>}
          {images.length > 0 && prompt.trim() && <p className="text-xs text-emerald-400 flex items-center gap-1.5"><CircleCheck className="w-3 h-3" />Ready to generate! {images.length > 1 ? `${images.length} scenes will be stitched.` : "1 scene."}</p>}
        </div>

        <div className="flex gap-2">
          <Button onClick={handleGenerate} disabled={status === "CREATING" || status === "PROCESSING" || status === "TIMEOUT"} className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-95 border-0 text-white h-11">
            {status === "CREATING" || status === "PROCESSING" ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{batchProgress || "Generating…"}</> : <><Clapperboard className="w-4 h-4 mr-2" />{images.length > 1 ? `Generate ${images.length}-scene video` : "Animate image"}</>}
          </Button>
          {(status === "SUCCESS" || status === "FAIL" || status === "TIMEOUT") && <Button variant="outline" onClick={handleReset} className="glass border-white/10"><RefreshCw className="w-4 h-4" /></Button>}
        </div>
      </div>
      <VideoPreview status={status} videoUrl={videoUrl} error={error} taskId={taskId} pollElapsed={pollElapsed} onKeepWaiting={handleKeepWaiting} onSaveVideo={handleSaveVideo} />
    </div>
  );
}

/* ============================================================ ImageGenPanel ============================================================ */
function ImageGenPanel({ toast }: { toast: ReturnType<typeof useToast>["toast"]; }) {
  const [prompt, setPrompt] = useState("");
  const [enhanced, setEnhanced] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [size, setSize] = useState("1024x1024");
  const [provider, setProvider] = useState("auto");
  const [status, setStatus] = useState<ImageStatus>("IDLE");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<GeneratedAsset[]>([]);
  const [meta, setMeta] = useState<{ provider: string | null; elapsedMs: number | null }>({ provider: null, elapsedMs: null });

  const handleEnhance = useCallback(async () => {
    if (!prompt.trim()) return;
    setEnhancing(true);
    try { const d = await safeFetchJson("/api/enhance-prompt", { prompt, mode: "image" }); if (d.success) { setPrompt(d.enhanced); setEnhanced(true); toast({ title: "Prompt enhanced" }); } else throw new Error(d.error); }
    catch (e: any) { toast({ title: "Enhancement failed", description: e?.message, variant: "destructive" }); }
    finally { setEnhancing(false); }
  }, [prompt, toast]);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) { toast({ title: "Prompt required", variant: "destructive" }); return; }
    const key = cacheKey(prompt, size);
    const cached = imageCache.get(key);
    if (cached) { setImageUrl(cached); setStatus("SUCCESS"); toast({ title: "Loaded from cache (instant)" }); return; }
    setStatus("GENERATING"); setImageUrl(null); setError(null); setMeta({ provider: null, elapsedMs: null });
    try { const d = await safeFetchJson("/api/generate-image", { prompt, size, provider }); if (!d.success) throw new Error(d.error); setImageUrl(d.url); setStatus("SUCCESS"); setMeta({ provider: d.provider, elapsedMs: d.elapsedMs }); imageCache.set(key, d.url); setHistory(h => [{ id: uid(), url: d.url, prompt, kind: "image" as const, createdAt: Date.now() }, ...h].slice(0, 24)); toast({ title: "Image ready", description: `${d.provider} • ${Math.round((d.elapsedMs||0)/100)/10}s` }); }
    catch (e: any) { setStatus("FAIL"); setError(e?.message); toast({ title: "Generation failed", description: e?.message, variant: "destructive" }); }
  }, [prompt, size, provider, toast]);

  const handleLoadPreset = (preset: { prompt: string; url: string }) => { setPrompt(preset.prompt); setImageUrl(preset.url); setStatus("SUCCESS"); setEnhanced(false); imageCache.set(cacheKey(preset.prompt, size), preset.url); toast({ title: "Preset loaded (instant)" }); };

  const handleUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const valid: File[] = [];
    for (const f of Array.from(files)) {
      if (!f.type.startsWith("image/")) { toast({ title: "Invalid file", description: `${f.name} is not an image.`, variant: "destructive" }); continue; }
      if (f.size > 8*1024*1024) { toast({ title: "File too large", description: `${f.name} exceeds 8MB.`, variant: "destructive" }); continue; }
      valid.push(f);
    }
    if (valid.length === 0) return;
    const readers = valid.map(f => new Promise<GeneratedAsset>(res => { const r = new FileReader(); r.onload = () => res({ id: uid(), url: r.result as string, prompt: f.name, kind: "image" as const, createdAt: Date.now() }); r.readAsDataURL(f); }));
    Promise.all(readers).then(assets => { setHistory(h => [...assets, ...h].slice(0, 24)); if (assets.length > 0) { setImageUrl(assets[0].url); setMeta({ provider: "uploaded" as any, elapsedMs: null }); setStatus("SUCCESS"); } toast({ title: `${assets.length} image${assets.length>1?"s":""} uploaded` }); });
  };

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="space-y-5">
        <div>
          <Label className="text-sm font-medium mb-2 block">Describe your image</Label>
          <PromptBox value={prompt} onChange={v => { setPrompt(v); setEnhanced(false); }} onEnhance={handleEnhance} enhancing={enhancing} placeholder="A surreal portrait of an astronaut made of galaxies…" voiceLang="fr-FR" />
          {enhanced && <p className="mt-2 text-xs text-emerald-400 flex items-center gap-1.5"><CircleCheck className="w-3.5 h-3.5" />Prompt enhanced</p>}
          <PromptPresets onPick={p => setPrompt(p)} />
          <div className="mt-4"><KeywordGenerator target="image-prompt" onPrompt={p => { setPrompt(p); setEnhanced(false); }} /></div>
          <div className="mt-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5"><Zap className="w-3 h-3 text-amber-400" />Instant presets — click to load</p>
            <div className="grid grid-cols-6 gap-1.5">
              {SEEDED_PRESETS.map((p, i) => <button key={i} onClick={() => handleLoadPreset(p)} title={p.prompt} className="aspect-square rounded-md overflow-hidden glass border border-white/10 hover:border-emerald-500/60 hover:scale-105 transition-all"><img src={p.url} alt={p.prompt} className="w-full h-full object-cover" loading="lazy" /></button>)}
            </div>
          </div>
          <div className="mt-4">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground mb-2 block">Or upload your own</Label>
            <div onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); handleUpload(e.dataTransfer.files); }} onClick={() => document.getElementById("img-upload")?.click()} className="cursor-pointer rounded-xl border-2 border-dashed border-white/15 hover:border-blue-500/50 transition-colors p-5 text-center bg-background/30">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500/30 to-cyan-500/30 grid place-items-center mx-auto mb-2"><Upload className="w-5 h-5 text-blue-300" /></div>
              <p className="text-sm font-medium">Drop images here, or click to browse</p>
              <p className="text-xs text-muted-foreground mt-1">PNG, JPG, WebP — up to 8MB each. Multiple OK.</p>
              <input id="img-upload" type="file" accept="image/*" multiple className="hidden" onChange={e => { handleUpload(e.target.files); e.target.value = ""; }} />
            </div>
          </div>
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wide text-muted-foreground mb-2 block">Aspect ratio</Label>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {[["1024x1024","1:1","Square"],["1344x768","16:9","Landscape"],["768x1344","9:16","Portrait"],["1440x720","2:1","Wide"],["720x1440","1:2","Tall"],["1152x864","4:3","Classic"],["864x1152","3:4","Vertical"]].map(([v,l,s]) => <button key={v} onClick={() => setSize(v)} className={`p-2.5 rounded-lg border text-left transition-all ${size === v ? "border-emerald-500/60 bg-emerald-500/10 glow-sm" : "border-white/10 bg-background/30 hover:border-white/20"}`}><div className="text-sm font-semibold">{l}</div><div className="text-[10px] text-muted-foreground">{s}</div></button>)}
          </div>
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wide text-muted-foreground mb-2 block">Engine</Label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[["auto","Auto","Best mix"],["turbo","Turbo","~3s • Free"],["pollinations","Flux","~5s • Free"],["zai","Z.AI","~40s"]].map(([v,l,s]) => <button key={v} onClick={() => setProvider(v)} className={`p-2.5 rounded-lg border text-left transition-all ${provider === v ? "border-blue-500/60 bg-blue-500/10 glow-sm" : "border-white/10 bg-background/30 hover:border-white/20"}`}><div className="text-sm font-semibold">{l}</div><div className="text-[10px] text-muted-foreground">{s}</div></button>)}
          </div>
          <p className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1.5"><Zap className="w-3 h-3 text-amber-400" /><span><strong className="text-foreground">Turbo</strong> and <strong className="text-foreground">Flux</strong> are free, no-API-key providers. <strong className="text-foreground">Auto</strong> tries Turbo → Flux → Z.AI.</span></p>
        </div>
        <Button onClick={handleGenerate} disabled={status === "GENERATING" || !prompt.trim()} className="w-full bg-gradient-to-r from-teal-500 to-emerald-600 hover:opacity-95 border-0 text-white h-11">{status === "GENERATING" ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating…</> : <><ImageIcon className="w-4 h-4 mr-2" />Generate image</>}</Button>
      </div>
      <div className="space-y-4">
        <div className="relative aspect-square rounded-2xl overflow-hidden glass border-white/10 grid place-items-center">
          {status === "IDLE" && <div className="text-center px-6"><div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-500/30 to-emerald-500/30 grid place-items-center mx-auto mb-4"><ImageIcon className="w-8 h-8 text-teal-300" /></div><p className="text-sm text-muted-foreground">Your generated image will appear here.</p></div>}
          {status === "GENERATING" && <div className="absolute inset-0 animate-shimmer" />}
          {status === "SUCCESS" && imageUrl && <div className="absolute inset-0"><img src={imageUrl} alt={prompt} className="w-full h-full object-cover" />
            {meta.provider && <div className="absolute top-3 left-3 flex flex-col gap-1.5"><span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-full bg-black/60 backdrop-blur text-white border border-white/10 flex items-center gap-1.5"><span className={`w-1.5 h-1.5 rounded-full ${meta.provider === "uploaded" ? "bg-blue-400" : "bg-emerald-400"}`} />{meta.provider === "turbo" ? "Turbo" : meta.provider === "pollinations" ? "Flux" : meta.provider === "zai" ? "Z.AI" : meta.provider === "uploaded" ? "Uploaded" : meta.provider}</span>{meta.elapsedMs && <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/60 backdrop-blur text-white/70 border border-white/10">{(meta.elapsedMs/1000).toFixed(1)}s</span>}</div>}
            <a href={imageUrl} target="_blank" rel="noopener noreferrer" className="absolute top-3 right-3"><Button size="sm" className="bg-black/60 backdrop-blur border border-white/10 hover:bg-black/80 text-white"><Download className="w-4 h-4 mr-1.5" />Download</Button></a>
          </div>}
          {status === "FAIL" && <div className="text-center px-6"><div className="w-16 h-16 rounded-2xl bg-red-500/15 grid place-items-center mx-auto mb-4"><AlertCircle className="w-8 h-8 text-red-400" /></div><p className="text-sm font-medium">Generation failed</p><p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">{error}</p>{error?.toLowerCase().includes("rate") && <p className="text-[11px] text-amber-400/80 mt-2">⏳ Auto-recovery in ~30s. Or click retry below.</p>}<Button size="sm" variant="outline" onClick={handleGenerate} className="mt-4 glass border-white/10 hover:border-white/30"><RefreshCw className="w-3.5 h-3.5 mr-1.5" />Retry</Button></div>}
        </div>
        {history.length > 0 && <div><p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Recent — session history</p><div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto custom-scroll p-1">{history.map(h => <button key={h.id} onClick={() => { setImageUrl(h.url); setStatus("SUCCESS"); }} className="aspect-square rounded-lg overflow-hidden glass border-white/10 hover:border-white/30 transition-all"><img src={h.url} alt={h.prompt} className="w-full h-full object-cover" /></button>)}</div></div>}
      </div>
    </div>
  );
}

/* ============================================================ ScriptPanel ============================================================ */
function ScriptPanel({ toast }: { toast: ReturnType<typeof useToast>["toast"]; }) {
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState("inspiring");
  const [length, setLength] = useState("short");
  const [status, setStatus] = useState<ScriptStatus>("IDLE");
  const [scenes, setScenes] = useState<{ scene: string; prompt: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = useCallback(async () => {
    if (!topic.trim()) { toast({ title: "Topic required", variant: "destructive" }); return; }
    setStatus("WRITING"); setScenes([]); setError(null);
    try { const d = await safeFetchJson("/api/script", { topic, tone, length }); if (!d.success) throw new Error(d.error); if (!Array.isArray(d.scenes) || d.scenes.length === 0) throw new Error("No scenes returned."); setScenes(d.scenes); setStatus("SUCCESS"); toast({ title: "Script ready", description: `${d.scenes.length} scenes` }); }
    catch (e: any) { setStatus("FAIL"); setError(e?.message); toast({ title: "Generation failed", description: e?.message, variant: "destructive" }); }
  }, [topic, tone, length, toast]);

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="space-y-5">
        <div>
          <Label className="text-sm font-medium mb-2 block">What's your video about?</Label>
          <div className="relative">
            <Textarea value={topic} onChange={e => setTopic(e.target.value)} placeholder="A 30-second teaser for a sustainable sneaker brand…" rows={5} className="bg-background/40 border-white/10 focus-visible:ring-emerald-500/40 resize-none pr-12" />
            <div className="absolute top-2 right-2"><VoiceInputButton value={topic} onChange={setTopic} lang="fr-FR" mode="append" size="sm" className="glass border-white/10 hover:border-white/20" /></div>
          </div>
        </div>
        <KeywordGenerator target="script" onScenes={(genScenes, genTopic) => { setScenes(genScenes); setTopic(genTopic); setStatus("SUCCESS"); setError(null); }} />
        <div className="grid grid-cols-2 gap-4">
          <div><Label className="text-xs uppercase tracking-wide text-muted-foreground mb-2 block">Tone</Label><Select value={tone} onValueChange={setTone}><SelectTrigger className="bg-background/40 border-white/10"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="inspiring">Inspiring</SelectItem><SelectItem value="playful">Playful</SelectItem><SelectItem value="cinematic">Cinematic</SelectItem><SelectItem value="documentary">Documentary</SelectItem><SelectItem value="hype">Hype</SelectItem><SelectItem value="serene">Serene</SelectItem></SelectContent></Select></div>
          <div><Label className="text-xs uppercase tracking-wide text-muted-foreground mb-2 block">Length</Label><Select value={length} onValueChange={setLength}><SelectTrigger className="bg-background/40 border-white/10"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="short">Short (2-3)</SelectItem><SelectItem value="medium">Medium (3-4)</SelectItem><SelectItem value="long">Long (5-6)</SelectItem></SelectContent></Select></div>
        </div>
        <Button onClick={handleGenerate} disabled={status === "WRITING" || !topic.trim()} className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:opacity-95 border-0 text-white h-11">{status === "WRITING" ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Writing…</> : <><FileText className="w-4 h-4 mr-2" />Generate script</>}</Button>
        {error && <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-300 flex gap-2"><AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /><span>{error}</span></div>}
      </div>
      <div className="space-y-3 max-h-[28rem] overflow-y-auto custom-scroll pr-1">
        {status === "IDLE" && <div className="aspect-video rounded-2xl glass border-white/10 grid place-items-center text-center px-6"><div><div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-500/30 to-teal-500/30 grid place-items-center mx-auto mb-3"><FileText className="w-7 h-7 text-emerald-300" /></div><p className="text-sm text-muted-foreground">Your scene-by-scene script will appear here.</p></div></div>}
        {status === "WRITING" && [0,1,2].map(i => <div key={i} className="p-4 rounded-xl glass border-white/10 space-y-2"><div className="h-4 w-1/3 animate-shimmer rounded" /><div className="h-3 w-full animate-shimmer rounded" /><div className="h-3 w-4/5 animate-shimmer rounded" /></div>)}
        {status === "SUCCESS" && scenes.map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i*0.08 }} className="p-4 rounded-xl glass border-white/10 hover:border-white/20 transition-colors">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 grid place-items-center text-white text-xs font-bold flex-shrink-0">{String(i+1).padStart(2,"0")}</div>
              <div className="flex-1 min-w-0"><h4 className="font-semibold text-sm mb-1">{s.scene}</h4><p className="text-xs text-muted-foreground leading-relaxed">{s.prompt}</p><Button size="sm" variant="ghost" className="mt-2 h-7 text-xs text-muted-foreground hover:text-foreground px-0" onClick={() => { navigator.clipboard?.writeText(s.prompt); toast({ title: "Prompt copied" }); }}>Copy prompt<ChevronRight className="w-3 h-3 ml-1" /></Button></div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ============================================================ CommercialPanel ============================================================ */
function CommercialPanel({ toast }: { toast: ReturnType<typeof useToast>["toast"]; }) {
  const [productName, setProductName] = useState("");
  const [productDesc, setProductDesc] = useState("");
  const [productImage, setProductImage] = useState<string | null>(null);
  const [style, setStyle] = useState("premium");
  const [duration, setDuration] = useState("short");
  const [targetAudience, setTargetAudience] = useState("");
  const [planStatus, setPlanStatus] = useState<"idle" | "planning" | "ready">("idle");
  const [scenes, setScenes] = useState<{ scene: string; motionPrompt: string; narration: string }[]>([]);
  const [videoStatus, setVideoStatus] = useState<VideoStatus>("IDLE");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [batchProgress, setBatchProgress] = useState<string | null>(null);
  const [pollElapsed, setPollElapsed] = useState<number | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [voiceoverUrl, setVoiceoverUrl] = useState<string | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const STYLES = [
    { v: "premium", l: "Premium", d: "Luxury, elegant" },
    { v: "energetic", l: "Energetic", d: "Dynamic, vibrant" },
    { v: "cinematic", l: "Cinematic", d: "Dramatic, film-like" },
    { v: "minimal", l: "Minimal", d: "Clean, Apple-style" },
    { v: "playful", l: "Playful", d: "Fun, colorful" },
  ];

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) { toast({ title: "Invalid file", variant: "destructive" }); return; }
    if (file.size > 8*1024*1024) { toast({ title: "File too large (>8MB)", variant: "destructive" }); return; }
    const r = new FileReader(); r.onload = () => setProductImage(r.result as string); r.readAsDataURL(file);
  };

  const handlePlan = useCallback(async () => {
    if (!productName.trim()) { toast({ title: "Product name required", variant: "destructive" }); return; }
    setPlanStatus("planning"); setScenes([]);
    try {
      const d = await safeFetchJson("/api/generate-commercial", { productName, productDescription: productDesc, style, targetAudience, duration });
      if (!d.success) throw new Error(d.error);
      setScenes(d.scenes);
      setPlanStatus("ready");
      toast({ title: "Commercial plan ready!", description: `${d.scenes.length} scenes generated` });
    } catch (e: any) { setPlanStatus("idle"); toast({ title: "Planning failed", description: e?.message, variant: "destructive" }); }
  }, [productName, productDesc, style, targetAudience, duration, toast]);

  const startPolling = useCallback((allTasks: { id: string; url?: string }[]) => {
    if (pollRef.current) clearInterval(pollRef.current);
    let attempts = 0; const maxAttempts = 200; const t0 = Date.now();
    pollRef.current = setInterval(async () => {
      attempts++;
      try {
        const results = await Promise.all(allTasks.map(async (t) => {
          if (t.url) return t;
          const d = await safeFetchJson("/api/video-status", { taskId: t.id }, 15000);
          if (d.taskStatus === "SUCCESS" && d.videoUrl) return { id: t.id, url: d.videoUrl };
          return { id: t.id };
        }));
        const done = results.filter(r => r.url);
        if (done.length === allTasks.length) {
          if (pollRef.current) clearInterval(pollRef.current);
          setBatchProgress(`Stitching ${done.length} clips...`);
          try {
            const sr = await safeFetchJson("/api/stitch-videos", { videoUrls: done.map(r => r.url!) }, 120000);
            if (sr.success) { setVideoUrl(sr.url); setVideoStatus("SUCCESS"); setBatchProgress(null); setPollElapsed(null); toast({ title: "Commercial ready!", description: `${done.length} scenes` }); }
            else throw new Error(sr.error);
          } catch { setVideoUrl(done[0].url!); setVideoStatus("SUCCESS"); setBatchProgress(null); toast({ title: "First scene ready (stitching failed)" }); }
        } else if (attempts >= maxAttempts) {
          setVideoStatus("TIMEOUT"); setError(`Still rendering after ${Math.round((Date.now()-t0)/1000)}s.`); setBatchProgress(null); if (pollRef.current) clearInterval(pollRef.current);
        } else { setVideoStatus("PROCESSING"); setPollElapsed(Math.round((Date.now()-t0)/1000)); setBatchProgress(`${done.length}/${allTasks.length} clips ready...`); }
      } catch {}
    }, 3000);
  }, [toast]);

  useEffect(() => { return () => { if (pollRef.current) clearInterval(pollRef.current); }; }, []);

  const handleGenerateCommercial = useCallback(async () => {
    if (!productImage) { toast({ title: "Product image required", variant: "destructive" }); return; }
    if (scenes.length === 0) { toast({ title: "Generate a plan first", variant: "destructive" }); return; }
    setVideoStatus("CREATING"); setVideoUrl(null); setError(null); setBatchProgress(null); setPollElapsed(null);
    try {
      const tasks: { id: string; url?: string }[] = [];
      for (let i = 0; i < scenes.length; i++) {
        setBatchProgress(`Generating scene ${i+1}/${scenes.length}: ${scenes[i].scene}...`);
        if (i > 0) await new Promise(r => setTimeout(r, 15000));
        try {
          const d = await safeFetchJson("/api/generate-video", { prompt: scenes[i].motionPrompt, imageUrl: productImage, size: "1280x720", duration: 5, fps: 30, quality: "speed" }, 120000);
          if (!d.success) throw new Error(d.error);
          if (d.directVideoUrl) tasks.push({ id: `hf-${i}`, url: d.directVideoUrl });
          else if (d.taskId) tasks.push({ id: d.taskId });
        } catch { toast({ title: `Scene ${i+1} skipped`, variant: "default" }); }
      }
      if (tasks.length === 0) throw new Error("All scenes failed. Z.AI may be rate-limited. Wait 5 min and try again.");
      if (tasks.every(t => t.url)) {
        setBatchProgress(`Stitching ${tasks.length} clips...`);
        try { const sr = await safeFetchJson("/api/stitch-videos", { videoUrls: tasks.map(t => t.url!) }, 120000); if (sr.success) { setVideoUrl(sr.url); setVideoStatus("SUCCESS"); setBatchProgress(null); toast({ title: "Commercial ready!" }); return; } }
        catch { setVideoUrl(tasks[0].url!); setVideoStatus("SUCCESS"); setBatchProgress(null); toast({ title: "First scene ready" }); return; }
      }
      setBatchProgress(`Waiting for ${tasks.length} clips...`); startPolling(tasks);
    } catch (e: any) { setVideoStatus("FAIL"); setError(e?.message); setBatchProgress(null); }
  }, [productImage, scenes, startPolling, toast]);

  const handleGenerateVoiceover = useCallback(async () => {
    const fullScript = scenes.map(s => s.narration).join(" ");
    if (!fullScript.trim()) { toast({ title: "No narration to speak", variant: "destructive" }); return; }
    setBatchProgress("Generating voiceover...");
    try {
      const d = await safeFetchJson("/api/generate-voiceover", { text: fullScript.slice(0, 1024), voice: "tongtong" });
      if (d.success) { setVoiceoverUrl(d.url); toast({ title: "Voiceover ready!" }); }
      else throw new Error(d.error);
    } catch (e: any) { toast({ title: "Voiceover failed", description: e?.message, variant: "destructive" }); }
    finally { setBatchProgress(null); }
  }, [scenes, toast]);

  const handleSaveVideo = useCallback(async (url: string) => {
    try {
      const d = await safeFetchJson("/api/saved-videos", { videoUrl: url, prompt: `Commercial: ${productName} — ${scenes.map(s => s.scene).join(", ")}`, provider: "zai", scenes: scenes.length });
      if (d.success) toast({ title: "Commercial saved!", description: "Saved to your collection." });
    } catch (e: any) { toast({ title: "Save failed", variant: "destructive" }); }
  }, [productName, scenes, toast]);

  const handleReset = () => { setPlanStatus("idle"); setScenes([]); setVideoStatus("IDLE"); setVideoUrl(null); setError(null); setBatchProgress(null); setVoiceoverUrl(null); if (pollRef.current) clearInterval(pollRef.current); };

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="space-y-5">
        <div className="p-4 rounded-xl bg-gradient-to-br from-amber-500/10 to-emerald-500/10 border border-amber-500/20">
          <div className="flex items-center gap-2 mb-2"><ShoppingBag className="w-5 h-5 text-amber-400" /><h3 className="text-lg font-bold">Product Commercial Maker</h3></div>
          <p className="text-sm text-muted-foreground">Upload your product photo, describe it, and AI generates a multi-scene commercial with professional camera movements and voiceover narration.</p>
        </div>

        {/* Product image upload */}
        <div>
          <Label className="text-sm font-medium mb-2 block">Product photo</Label>
          {productImage ? (
            <div className="relative rounded-xl overflow-hidden glass border-white/10">
              <img src={productImage} alt="product" className="w-full max-h-48 object-contain bg-black/30" />
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between p-2 bg-gradient-to-t from-black/80 to-transparent"><span className="text-xs text-white/80">Product photo</span><Button size="sm" variant="secondary" className="h-7 text-xs glass border-white/10" onClick={() => setProductImage(null)}>Replace</Button></div>
            </div>
          ) : (
            <div onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }} onClick={() => document.getElementById("cm-input")?.click()} className="cursor-pointer rounded-xl border-2 border-dashed border-white/15 hover:border-amber-500/50 transition-colors p-8 text-center bg-background/30">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/30 to-emerald-500/30 grid place-items-center mx-auto mb-3"><ShoppingBag className="w-6 h-6 text-amber-300" /></div>
              <p className="text-sm font-medium">Upload your product photo</p>
              <p className="text-xs text-muted-foreground mt-1">PNG, JPG, WebP — up to 8MB</p>
              <input id="cm-input" type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            </div>
          )}
        </div>

        {/* Product info */}
        <div>
          <Label className="text-sm font-medium mb-2 block">Product name</Label>
          <input value={productName} onChange={e => setProductName(e.target.value)} placeholder="e.g. Premium Watch, Haitian Coffee, Sneaker X" className="w-full bg-background/40 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500/50" />
        </div>
        <div>
          <Label className="text-sm font-medium mb-2 block">Product description (optional)</Label>
          <Textarea value={productDesc} onChange={e => setProductDesc(e.target.value)} placeholder="Handcrafted leather watch with sapphire crystal, water-resistant..." rows={2} className="bg-background/40 border-white/10 resize-none text-sm" />
        </div>

        {/* Style + Duration */}
        <div className="grid grid-cols-2 gap-4">
          <div><Label className="text-xs uppercase tracking-wide text-muted-foreground mb-2 block">Commercial style</Label>
            <select value={style} onChange={e => setStyle(e.target.value)} className="w-full bg-background/40 border border-white/10 rounded-lg px-3 py-2 text-sm">
              {STYLES.map(s => <option key={s.v} value={s.v}>{s.l} — {s.d}</option>)}
            </select></div>
          <div><Label className="text-xs uppercase tracking-wide text-muted-foreground mb-2 block">Length</Label>
            <select value={duration} onChange={e => setDuration(e.target.value)} className="w-full bg-background/40 border border-white/10 rounded-lg px-3 py-2 text-sm">
              <option value="short">Short (3 scenes)</option>
              <option value="medium">Medium (4 scenes)</option>
              <option value="long">Long (5 scenes)</option>
            </select></div>
        </div>

        {/* Plan button */}
        <Button onClick={handlePlan} disabled={planStatus === "planning" || !productName.trim()} className="w-full bg-gradient-to-r from-amber-500 to-emerald-600 hover:opacity-95 border-0 text-white h-11">
          {planStatus === "planning" ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating plan...</> : <><Wand2 className="w-4 h-4 mr-2" />Generate Commercial Plan</>}
        </Button>

        {/* Scene plan */}
        {scenes.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Scene plan ({scenes.length})</Label>
            {scenes.map((s, i) => (
              <div key={i} className="p-3 rounded-lg glass border-white/10">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-6 h-6 rounded bg-gradient-to-br from-amber-500 to-emerald-600 grid place-items-center text-white text-xs font-bold">{i+1}</span>
                  <span className="text-sm font-semibold">{s.scene}</span>
                </div>
                <p className="text-xs text-muted-foreground ml-8 mb-1">{s.motionPrompt}</p>
                <p className="text-xs text-emerald-400/80 ml-8">🎙️ {s.narration}</p>
              </div>
            ))}
          </div>
        )}

        {/* Generate commercial */}
        {planStatus === "ready" && (
          <div className="flex gap-2">
            <Button onClick={handleGenerateCommercial} disabled={videoStatus === "CREATING" || videoStatus === "PROCESSING" || !productImage} className="flex-1 bg-gradient-to-r from-emerald-500 to-blue-600 hover:opacity-95 border-0 text-white h-11">
              {videoStatus === "CREATING" || videoStatus === "PROCESSING" ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{batchProgress || "Generating..."}</> : <><Film className="w-4 h-4 mr-2" />Generate Commercial ({scenes.length} scenes)</>}
            </Button>
            <Button onClick={handleGenerateVoiceover} disabled={videoStatus === "PROCESSING"} variant="outline" className="glass border-white/10"><AudioLines className="w-4 h-4" /></Button>
            {(videoStatus === "SUCCESS" || videoStatus === "FAIL") && <Button variant="outline" onClick={handleReset} className="glass border-white/10"><RefreshCw className="w-4 h-4" /></Button>}
          </div>
        )}
      </div>

      {/* Right: preview */}
      <div className="space-y-4">
        <VideoPreview status={videoStatus} videoUrl={videoUrl} error={error} taskId={taskId} pollElapsed={pollElapsed} onSaveVideo={handleSaveVideo} />
        {voiceoverUrl && (
          <div className="p-3 rounded-lg glass border-white/10">
            <div className="flex items-center gap-2 mb-2"><CircleCheck className="w-4 h-4 text-emerald-400" /><span className="text-sm font-medium">Voiceover ready</span><a href={voiceoverUrl} target="_blank" rel="noopener noreferrer" className="ml-auto"><Button size="sm" variant="ghost" className="h-6 text-xs"><Download className="w-3 h-3 mr-1" />WAV</Button></a></div>
            <audio src={voiceoverUrl} controls className="w-full h-8" style={{ filter: "invert(0.85) hue-rotate(180deg)" }} />
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================ Studio ============================================================ */
function Studio({ studioRef }: { studioRef: React.RefObject<HTMLDivElement | null>; }) {
  const { toast } = useToast();
  const [tab, setTab] = useState("text-to-video");
  const [resetNonce, setResetNonce] = useState(0);
  const handleReset = () => { imageCache.clear(); setResetNonce(n => n+1); toast({ title: "Studio reset", description: "Cache, history, and all inputs cleared." }); };

  return (
    <section id="studio" ref={studioRef} className="py-24 relative scroll-mt-20">
      <div className="absolute inset-0 -z-10 overflow-hidden"><div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60rem] h-[60rem] rounded-full bg-blue-700/10 blur-3xl" /></div>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto text-center mb-12">
          <Badge variant="secondary" className="glass border-white/10 mb-4"><Sparkles className="w-3 h-3 mr-1.5" />Live Studio</Badge>
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight">Try it now. <span className="gradient-text">No signup.</span></h2>
          <p className="mt-4 text-lg text-muted-foreground">Generate a video, an image, or a full script right here. The same engine powers every DGGCOOL export.</p>
        </div>
        <Card className="glass-strong border-white/10 overflow-hidden">
          <CardContent className="p-0">
            <Tabs value={tab} onValueChange={setTab} className="w-full">
              <div className="border-b border-white/5 p-2 sm:p-4 flex flex-wrap items-center gap-1 overflow-x-auto custom-scroll">
                <TabsList className="bg-transparent p-1 h-auto flex flex-wrap gap-1">
                  <TabsTrigger value="text-to-video" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500/20 data-[state=active]:to-blue-500/20 data-[state=active]:text-foreground"><Film className="w-4 h-4 mr-2" />Text → Video</TabsTrigger>
                  <TabsTrigger value="image-to-video" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-500/20 data-[state=active]:to-blue-500/20 data-[state=active]:text-foreground"><Clapperboard className="w-4 h-4 mr-2" />Image → Video</TabsTrigger>
                  <TabsTrigger value="commercial" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500/20 data-[state=active]:to-emerald-500/20 data-[state=active]:text-foreground"><ShoppingBag className="w-4 h-4 mr-2" />Commercial</TabsTrigger>
                  <TabsTrigger value="image-gen" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-500/20 data-[state=active]:to-blue-500/20 data-[state=active]:text-foreground"><ImageIcon className="w-4 h-4 mr-2" />Image</TabsTrigger>
                  <TabsTrigger value="script" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500/20 data-[state=active]:to-teal-500/20 data-[state=active]:text-foreground"><FileText className="w-4 h-4 mr-2" />Script</TabsTrigger>
                </TabsList>
                <Button size="sm" variant="ghost" onClick={handleReset} className="ml-auto text-muted-foreground hover:text-foreground h-8" title="Clear cache, history, and all inputs"><RotateCcw className="w-3.5 h-3.5 mr-1.5" />Reset Studio</Button>
              </div>
              <div className="p-4 sm:p-8">
                <TabsContent value="text-to-video" className="mt-0"><TextToVideoPanel key={`tv-${resetNonce}`} toast={toast} /></TabsContent>
                <TabsContent value="image-to-video" className="mt-0"><ImageToVideoPanel key={`iv-${resetNonce}`} toast={toast} /></TabsContent>
                <TabsContent value="image-gen" className="mt-0"><ImageGenPanel key={`ig-${resetNonce}`} toast={toast} /></TabsContent>
                <TabsContent value="script" className="mt-0"><ScriptPanel key={`sc-${resetNonce}`} toast={toast} /></TabsContent>
                <TabsContent value="commercial" className="mt-0"><CommercialPanel key={`cm-${resetNonce}`} toast={toast} /></TabsContent>
              </div>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

/* ============================================================ SavedVideos ============================================================ */
function SavedVideos() {
  const { toast } = useToast();
  const [videos, setVideos] = useState<{ id: string; filename: string; prompt: string; provider: string; fileSize: number; createdAt: string; scenes?: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/saved-videos");
      const text = await r.text();
      let d: any;
      try { d = JSON.parse(text); } catch { return; }
      if (d.success) setVideos(d.videos || []);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      const r = await fetch(`/api/saved-videos?id=${id}`, { method: "DELETE" });
      const d = await r.json();
      if (d.success) { setVideos(d.remaining ? videos.filter(v => v.id !== id) : []); toast({ title: "Video deleted" }); }
    } catch (e: any) { toast({ title: "Delete failed", variant: "destructive" }); }
  }, [videos, toast]);

  if (loading) return null;
  if (videos.length === 0) return null;

  return (
    <section id="saved" className="py-16 relative">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Badge variant="secondary" className="glass border-white/10 mb-3"><FolderOpen className="w-3 h-3 mr-1.5" />Your saved videos</Badge>
            <h2 className="text-3xl font-bold tracking-tight">Saved Collection <span className="text-muted-foreground text-lg">({videos.length})</span></h2>
          </div>
          <Button size="sm" variant="ghost" onClick={load} className="text-muted-foreground hover:text-foreground"><RefreshCw className="w-3.5 h-3.5 mr-1.5" />Refresh</Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {videos.map(v => (
            <Card key={v.id} className="glass border-white/5 hover:border-white/15 transition-all">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">{new Date(v.createdAt).toLocaleString()}</p>
                    <p className="text-xs text-emerald-400 mt-0.5">{v.provider}{v.scenes ? ` • ${v.scenes} scenes` : ""} • {Math.round(v.fileSize/1024)} KB</p>
                  </div>
                  <button onClick={() => handleDelete(v.id)} className="text-muted-foreground hover:text-red-400 transition-colors p-1" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
                <p className="text-sm text-foreground line-clamp-2 mb-3 min-h-[2.5rem]">{v.prompt}</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setSelectedVideo(`/saved-videos/${v.filename}`)} className="glass border-white/10 flex-1"><Play className="w-3 h-3 mr-1.5" />Play</Button>
                  <a href={`/saved-videos/${v.filename}`} download><Button size="sm" variant="outline" className="glass border-white/10"><Download className="w-3 h-3" /></Button></a>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Video player modal */}
      {selectedVideo && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm grid place-items-center p-4" onClick={() => setSelectedVideo(null)}>
          <div className="relative max-w-4xl w-full" onClick={e => e.stopPropagation()}>
            <video src={selectedVideo} controls autoPlay className="w-full rounded-xl" />
            <Button size="sm" variant="outline" onClick={() => setSelectedVideo(null)} className="absolute -top-12 right-0 glass border-white/10">Close</Button>
          </div>
        </div>
      )}
    </section>
  );
}

/* ============================================================ Showcase ============================================================ */
function Showcase() {
  return (
    <section id="showcase" className="py-24 relative">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto text-center mb-14">
          <Badge variant="secondary" className="glass border-white/10 mb-4"><Sparkles className="w-3 h-3 mr-1.5" />Made with DGGCOOL</Badge>
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight">A gallery of <span className="gradient-text">imagination</span>.</h2>
          <p className="mt-4 text-lg text-muted-foreground">Real videos generated by the DGGCOOL community. Click any tile to remix it in the Studio.</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {SHOWCASE.map((item, i) => (
            <motion.div key={i} initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.5, delay: (i%3)*0.08 }} className={`group relative aspect-square rounded-2xl overflow-hidden bg-gradient-to-br ${item.gradient} cursor-pointer`}>
              <img src={item.img} alt={item.title} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" loading="lazy" />
              <div className="absolute inset-0 grid-bg opacity-20 mix-blend-overlay" />
              <div className="absolute inset-0 noise opacity-30" />
              <div className="absolute inset-0 grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30"><div className="w-14 h-14 rounded-full bg-white/90 grid place-items-center"><Play className="w-6 h-6 text-black ml-0.5" fill="currentColor" /></div></div>
              <div className="absolute top-3 left-3"><span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-full bg-black/40 backdrop-blur text-white border border-white/20">{item.tag}</span></div>
              <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/80 via-black/30 to-transparent"><h3 className="text-white font-semibold text-lg">{item.title}</h3></div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================================================ FreeForever ============================================================ */
function FreeForever({ onLaunch }: { onLaunch: () => void }) {
  const perks = [
    { icon: Film, label: "Unlimited videos" }, { icon: ImageIcon, label: "Unlimited images" }, { icon: FileText, label: "Unlimited scripts" }, { icon: AudioLines, label: "Audio & voiceovers" }, { icon: Wand2, label: "Prompt enhancer" }, { icon: Zap, label: "No watermark, ever" },
  ];
  return (
    <section id="pricing" className="py-24 relative">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="relative rounded-3xl overflow-hidden p-10 sm:p-16">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/30 via-blue-600/20 to-teal-500/30" />
          <div className="absolute inset-0 grid-bg opacity-30" />
          <div className="absolute inset-0 noise opacity-40" />
          <div className="relative text-center">
            <Badge variant="secondary" className="glass border-white/10 mb-5"><Sparkles className="w-3 h-3 mr-1.5" />Free forever</Badge>
            <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-balance">No plans. No paywalls. <br /><span className="gradient-text">Just create.</span></h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-xl mx-auto">DGGCOOL is free for everyone, forever. Every feature, every export, no watermark. Made by creators, for creators.</p>
            <div className="mt-10 grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-2xl mx-auto">
              {perks.map(p => <div key={p.label} className="glass rounded-xl p-4 flex items-center gap-3 text-left"><div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-blue-600 grid place-items-center flex-shrink-0"><p.icon className="w-4 h-4 text-white" /></div><span className="text-sm font-medium">{p.label}</span></div>)}
            </div>
            <Button size="lg" onClick={onLaunch} className="mt-10 bg-gradient-to-r from-emerald-500 via-teal-500 to-blue-500 hover:opacity-95 border-0 text-white px-8 py-6 text-base glow"><Sparkles className="mr-2 w-5 h-5" />Start creating — it's free</Button>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============================================================ FAQ ============================================================ */
function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12"><Badge variant="secondary" className="glass border-white/10 mb-4">FAQ</Badge><h2 className="text-4xl sm:text-5xl font-bold tracking-tight">Questions, answered.</h2></div>
        <div className="space-y-3">
          {FAQS.map((f, i) => (
            <div key={i} className="rounded-xl glass border-white/5 overflow-hidden">
              <button onClick={() => setOpen(open === i ? null : i)} className="w-full text-left p-5 flex items-center justify-between gap-4 hover:bg-white/5 transition-colors"><span className="font-medium">{f.q}</span><ChevronRight className={`w-4 h-4 flex-shrink-0 text-muted-foreground transition-transform ${open === i ? "rotate-90" : ""}`} /></button>
              <AnimatePresence initial={false}>{open === i && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden"><p className="px-5 pb-5 text-sm text-muted-foreground leading-relaxed">{f.a}</p></motion.div>}</AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================================================ FinalCTA ============================================================ */
function FinalCTA({ onLaunch }: { onLaunch: () => void }) {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="relative rounded-3xl overflow-hidden p-10 sm:p-16">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/30 via-blue-600/20 to-teal-500/30" />
          <div className="absolute inset-0 grid-bg opacity-30" />
          <div className="absolute inset-0 noise opacity-40" />
          <div className="relative text-center">
            <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-balance">Your next video is one prompt away.</h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-xl mx-auto">Join 2.4 million creators using DGGCOOL to turn ideas into cinema. No credit card. No learning curve.</p>
            <Button size="lg" onClick={onLaunch} className="mt-8 bg-gradient-to-r from-emerald-500 via-teal-500 to-blue-500 hover:opacity-95 border-0 text-white px-8 py-6 text-base glow"><Sparkles className="mr-2 w-5 h-5" />Open the Studio</Button>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============================================================ Footer ============================================================ */
function Footer() {
  return (
    <footer className="mt-auto border-t border-white/5 py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          <div className="col-span-2">
            <a href="#" className="flex items-center gap-2 mb-3"><div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 via-teal-500 to-blue-500 grid place-items-center"><Sparkles className="w-5 h-5 text-white" /></div><span className="text-lg font-bold">DGG<span className="gradient-text">COOL</span></span></a>
            <p className="text-sm text-muted-foreground max-w-xs">The AI creative studio for video, images, and scripts. Made for makers, marketers, and storytellers.</p>
            <div className="flex gap-3 mt-5">{[Twitter, Github, Youtube].map((Icon, i) => <a key={i} href="#" className="w-9 h-9 rounded-lg glass border-white/5 hover:border-white/20 grid place-items-center text-muted-foreground hover:text-foreground transition-colors"><Icon className="w-4 h-4" /></a>)}</div>
          </div>
          {[{ title: "Product", links: ["Features","Studio","Changelog","Roadmap"] }, { title: "Resources", links: ["Docs","Tutorials","Blog","Community","API"] }, { title: "Company", links: ["About","Careers","Contact","Privacy","Terms"] }].map(col => (
            <div key={col.title}><h4 className="text-sm font-semibold mb-3">{col.title}</h4><ul className="space-y-2">{col.links.map(l => <li key={l}><a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{l}</a></li>)}</ul></div>
          ))}
        </div>
        <div className="mt-10 pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground" suppressHydrationWarning>© {new Date().getFullYear()} DGGCOOL Labs. Free forever.</p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground"><span className="flex items-center gap-1.5"><Globe className="w-3 h-3" />English</span><span className="flex items-center gap-1.5"><Smartphone className="w-3 h-3" />iOS & Android soon</span></div>
        </div>
      </div>
    </footer>
  );
}

/* ============================================================ Page ============================================================ */
export default function Page() {
  const studioRef = useRef<HTMLDivElement | null>(null);
  const scrollToStudio = useCallback(() => { studioRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, []);
  return (
    <main className="min-h-screen flex flex-col bg-background">
      <Navbar onLaunch={scrollToStudio} />
      <Hero onLaunch={scrollToStudio} />
      <LogoMarquee />
      <Features />
      <Studio studioRef={studioRef} />
      <Showcase />
      <SavedVideos />
      <FreeForever onLaunch={scrollToStudio} />
      <FAQ />
      <FinalCTA onLaunch={scrollToStudio} />
      <Footer />
    </main>
  );
}
