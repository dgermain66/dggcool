"use client";
import { useCallback, useState } from "react";
import { Sparkles, Loader2, Wand2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

type Target = "video-prompt" | "image-prompt" | "script";

interface Props {
  target: Target;
  onPrompt?: (p: string) => void;
  onScenes?: (scenes: { scene: string; prompt: string }[], topic: string) => void;
  compact?: boolean;
}

const STYLES = ["cinematic","documentary","fantasy","realistic","anime","vaporwave","minimalist","vibrant"];
const TONES = ["inspiring","playful","cinematic","documentary","hype","serene"];
const LENGTHS = [["short","Short (2-3 scenes)"],["medium","Medium (3-4 scenes)"],["long","Long (5-6 scenes)"]] as const;

const TARGET_LABELS: Record<Target, string> = {
  "video-prompt": "Generate a video prompt from 3 keywords",
  "image-prompt": "Generate an image prompt from 3 keywords",
  script: "Generate a full script from 3 keywords",
};

export function KeywordGenerator({ target, onPrompt, onScenes, compact = false }: Props) {
  const { toast } = useToast();
  const [kw1, setKw1] = useState(""); const [kw2, setKw2] = useState(""); const [kw3, setKw3] = useState("");
  const [style, setStyle] = useState("cinematic"); const [tone, setTone] = useState("cinematic"); const [length, setLength] = useState("short");
  const [loading, setLoading] = useState(false); const [expanded, setExpanded] = useState(false);

  const handleGenerate = useCallback(async () => {
    const kws = [kw1, kw2, kw3].map(s => s.trim()).filter(Boolean);
    if (kws.length === 0) { toast({ title: "Need at least one keyword", description: "Fill in 1-3 keywords.", variant: "destructive" }); return; }
    setLoading(true);
    try {
      const payload: Record<string, unknown> = { keywords: kws.join(", "), target };
      if (target === "script") { payload.tone = tone; payload.length = length; } else { payload.style = style; }
      const res = await fetch("/api/generate-from-keywords", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const text = await res.text();
      let data: any;
      try { data = JSON.parse(text); } catch { throw new Error("Server returned an invalid response. Try again."); }
      if (!data.success) throw new Error(data.error);
      if (target === "script") {
        if (!Array.isArray(data.scenes) || data.scenes.length === 0) throw new Error("No scenes returned.");
        onScenes?.(data.scenes, data.topic || kws.join(", "));
        toast({ title: "Script generated", description: `${data.scenes.length} scenes • ${Math.round((data.elapsedMs||0)/100)/10}s` });
      } else {
        if (!data.content) throw new Error("No content returned.");
        onPrompt?.(data.content);
        toast({ title: "Prompt generated", description: `${target === "video-prompt" ? "Video" : "Image"} • ${style} • ${Math.round((data.elapsedMs||0)/100)/10}s` });
      }
    } catch (e: any) {
      toast({ title: "Generation failed", description: e?.message, variant: "destructive" });
    } finally { setLoading(false); }
  }, [kw1, kw2, kw3, target, style, tone, length, onPrompt, onScenes, toast]);

  const isScript = target === "script";

  return (
    <div className="rounded-xl glass border-white/10 overflow-hidden">
      <button type="button" onClick={() => setExpanded(v => !v)} className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors text-left">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-blue-600 grid place-items-center"><Wand2 className="w-3.5 h-3.5 text-white" /></div>
          <div>
            <div className="text-sm font-semibold">{isScript ? "Keywords → Script" : "Keywords → Prompt"}</div>
            {!compact && <div className="text-[11px] text-muted-foreground">{TARGET_LABELS[target]}</div>}
          </div>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {expanded && (
        <div className="px-3 pb-3 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {[1,2,3].map(n => (
              <div key={n}>
                <Label className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1 block">Keyword {n}</Label>
                <Input value={n===1?kw1:n===2?kw2:kw3} onChange={e => (n===1?setKw1:n===2?setKw2:setKw3)(e.target.value)} placeholder={n===1?"e.g. beach":n===2?"e.g. sunset":"e.g. romantic"} className="bg-background/40 border-white/10 h-9 text-sm" />
              </div>
            ))}
          </div>
          {isScript ? (
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1 block">Tone</Label>
                <Select value={tone} onValueChange={setTone}><SelectTrigger className="bg-background/40 border-white/10 h-9 text-sm"><SelectValue /></SelectTrigger><SelectContent>{TONES.map(t => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</SelectItem>)}</SelectContent></Select></div>
              <div><Label className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1 block">Length</Label>
                <Select value={length} onValueChange={setLength}><SelectTrigger className="bg-background/40 border-white/10 h-9 text-sm"><SelectValue /></SelectTrigger><SelectContent>{LENGTHS.map(([v,l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select></div>
            </div>
          ) : (
            <div><Label className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1 block">Style</Label>
              <Select value={style} onValueChange={setStyle}><SelectTrigger className="bg-background/40 border-white/10 h-9 text-sm"><SelectValue /></SelectTrigger><SelectContent>{STYLES.map(s => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</SelectItem>)}</SelectContent></Select></div>
          )}
          <Button onClick={handleGenerate} disabled={loading || (!kw1.trim() && !kw2.trim() && !kw3.trim())} className="w-full bg-gradient-to-r from-emerald-500 to-blue-600 hover:opacity-95 border-0 text-white h-9">
            {loading ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Generating…</> : <><Sparkles className="w-3.5 h-3.5 mr-1.5" />{isScript ? "Generate script" : "Generate prompt"}</>}
          </Button>
          {!compact && <p className="text-[11px] text-muted-foreground">✨ The AI expands your keywords into a full {isScript ? "scene-by-scene script" : "director-grade prompt"}. You can still edit the result.</p>}
        </div>
      )}
    </div>
  );
}
