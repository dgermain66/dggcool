"use client";
import { useCallback, useEffect, useRef, useState } from "react";

interface SpeechRecognitionLike {
  lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number;
  start: () => void; stop: () => void; abort: () => void;
  onresult: ((e: any) => void) | null; onerror: ((e: any) => void) | null; onend: (() => void) | null; onstart: (() => void) | null;
}

function getCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

interface Options { lang?: string; continuous?: boolean; interimResults?: boolean; onResult?: (t: string) => void; }
interface Return { supported: boolean; listening: boolean; error: string | null; start: () => void; stop: () => void; }

export function useSpeechRecognition({ lang = "en-US", continuous = true, interimResults = true, onResult }: Options = {}): Return {
  const [supported] = useState(() => {
    if (typeof window === "undefined") return false;
    return !!(getCtor());
  });
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const onResultRef = useRef(onResult);
  const accRef = useRef<string>("");

  useEffect(() => { onResultRef.current = onResult; }, [onResult]);

  useEffect(() => {
    const Ctor = getCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = lang; rec.continuous = continuous; rec.interimResults = interimResults; rec.maxAlternatives = 1;
    rec.onstart = () => { setListening(true); setError(null); accRef.current = ""; };
    rec.onresult = (event: any) => {
      let interim = "", final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += t; else interim += t;
      }
      if (final) { accRef.current += final; onResultRef.current?.(accRef.current); }
      else if (interim) onResultRef.current?.(accRef.current + interim);
    };
    rec.onerror = (event: any) => {
      const err = event?.error || "unknown";
      let msg = "Speech recognition error";
      if (err === "not-allowed" || err === "service-not-allowed") msg = "Microphone permission denied.";
      else if (err === "no-speech") msg = "No speech detected.";
      else if (err === "network") msg = "Network error.";
      else if (err === "aborted") return;
      setError(msg); setListening(false);
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    return () => { try { rec.abort(); } catch {} recRef.current = null; };
  }, [lang, continuous, interimResults]);

  const start = useCallback(() => { if (recRef.current) try { recRef.current.start(); } catch {} }, []);
  const stop = useCallback(() => { if (recRef.current) try { recRef.current.stop(); } catch {} }, []);
  return { supported, listening, error, start, stop };
}
