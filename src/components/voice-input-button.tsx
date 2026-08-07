"use client";
import { useCallback, useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { useToast } from "@/hooks/use-toast";

interface Props {
  value: string;
  onChange: (text: string) => void;
  lang?: string;
  mode?: "append" | "replace";
  size?: "default" | "sm";
  className?: string;
  label?: string;
}

export function VoiceInputButton({ value, onChange, lang = "en-US", mode = "append", size = "default", className = "", label }: Props) {
  const { toast } = useToast();
  const [, setInterim] = useState("");

  const handleResult = useCallback((finalText: string) => {
    if (mode === "append") {
      const base = value.trim().replace(/\s*\[.*?\]\s*$/, "").trim();
      onChange(base ? `${base} ${finalText}`.trim() : finalText);
      setInterim("");
    } else { onChange(finalText); }
  }, [value, onChange, mode]);

  const { supported, listening, start, stop } = useSpeechRecognition({ lang, onResult: handleResult });

  const handleClick = useCallback(() => {
    if (!supported) { toast({ title: "Voice input not supported", description: "Use Chrome or Edge.", variant: "destructive" }); return; }
    if (listening) { stop(); setInterim(""); }
    else { setInterim(""); start(); toast({ title: "Listening…", description: `Speak now. Click mic to stop. (${lang})` }); }
  }, [supported, listening, start, stop, lang, toast]);

  return (
    <Button type="button" size={size} variant={listening ? "default" : "secondary"} onClick={handleClick}
      className={`${listening ? "bg-red-500 hover:bg-red-600 text-white border-0 animate-pulse-glow" : "glass border-white/10 hover:border-white/30"} ${className}`}
      title={!supported ? "Not supported" : listening ? "Click to stop" : "Click to dictate"}
      aria-label={listening ? "Stop voice input" : "Start voice input"}
      suppressHydrationWarning
    >
      {listening ? <MicOff className={size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4"} /> : <Mic className={size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4"} />}
      {label && <span className="ml-1.5 text-xs">{listening ? "Stop" : label}</span>}
    </Button>
  );
}
