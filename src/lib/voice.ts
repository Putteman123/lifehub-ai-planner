import { useCallback, useEffect, useRef, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult:
    | ((event: {
        resultIndex: number;
        results: ArrayLike<ArrayLike<{ transcript: string }>>;
      }) => void)
    | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

const STOP_WORDS = ["tyst", "stopp", "sluta", "stop", "tysta"];

function createRecognition(): SpeechRecognitionLike | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = "sv-SE";
  return rec;
}

/** Röstsamtal med Andrea: kontinuerlig diktering (sv-SE) + uppläsning med AI-röst. */
export function useVoice(onTranscript: (text: string) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [speaking, setSpeaking] = useState(false);

  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const activeRef = useRef(false);
  const stopListenerRef = useRef<SpeechRecognitionLike | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cbRef = useRef(onTranscript);
  cbRef.current = onTranscript;

  useEffect(() => {
    setSupported(!!createRecognition());
    return () => {
      activeRef.current = false;
      recRef.current?.abort();
      stopListenerRef.current?.abort();
      audioRef.current?.pause();
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    };
  }, []);

  const stopListening = useCallback(() => {
    activeRef.current = false;
    recRef.current?.stop();
    setListening(false);
  }, []);

  const startListening = useCallback(() => {
    const rec = createRecognition();
    if (!rec) return;
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (event) => {
      const results = event.results;
      const last = results[results.length - 1];
      const text = (last?.[0]?.transcript ?? "").trim();
      if (text) cbRef.current(text);
    };
    rec.onerror = (event) => {
      const fatal = ["not-allowed", "service-not-allowed", "network"];
      if (event?.error && fatal.includes(event.error)) {
        activeRef.current = false;
        setListening(false);
      }
    };
    rec.onend = () => {
      if (activeRef.current) {
        try {
          rec.start();
        } catch {
          /* redan igång */
        }
      } else {
        setListening(false);
      }
    };
    recRef.current = rec;
    activeRef.current = true;
    try {
      rec.start();
      setListening(true);
    } catch {
      activeRef.current = false;
      setListening(false);
    }
  }, []);

  /** Lyssnar efter "tyst"/"stopp" medan Andrea talar. */
  const stopStopWordListener = useCallback(() => {
    stopListenerRef.current?.stop();
    stopListenerRef.current = null;
  }, []);

  const silence = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    stopStopWordListener();
    setSpeaking(false);
  }, [stopStopWordListener]);

  const startStopWordListener = useCallback(() => {
    if (stopListenerRef.current) return;
    const rec = createRecognition();
    if (!rec) return;
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (event) => {
      const results = event.results;
      for (let i = event.resultIndex ?? 0; i < results.length; i++) {
        const t = (results[i]?.[0]?.transcript ?? "").toLowerCase().trim();
        if (STOP_WORDS.some((w) => t.includes(w))) {
          silence();
          break;
        }
      }
    };
    rec.onerror = () => {
      stopListenerRef.current = null;
    };
    rec.onend = () => {
      stopListenerRef.current = null;
    };
    stopListenerRef.current = rec;
    try {
      rec.start();
    } catch {
      stopListenerRef.current = null;
    }
  }, [silence]);

  const fallbackSpeak = useCallback(
    (text: string) => {
      if (typeof window === "undefined" || !window.speechSynthesis) {
        setSpeaking(false);
        return;
      }
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = "sv-SE";
      utter.rate = 1.03;
      const sv = window.speechSynthesis.getVoices().find((v) => v.lang?.startsWith("sv"));
      if (sv) utter.voice = sv;
      utter.onend = () => {
        stopStopWordListener();
        setSpeaking(false);
      };
      utter.onerror = () => {
        stopStopWordListener();
        setSpeaking(false);
      };
      window.speechSynthesis.speak(utter);
    },
    [stopStopWordListener],
  );

  const speak = useCallback(
    async (raw: string) => {
      const clean = raw
        .replace(/[#*_`~>[\]()]/g, "")
        .replace(/\n{2,}/g, ". ")
        .replace(/\s+/g, " ")
        .trim();
      if (!clean) return;

      silence();
      const text = clean.length > 800 ? `${clean.slice(0, 800)}…` : clean;
      setSpeaking(true);
      startStopWordListener();

      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        const resp = await fetch("/api/tts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ text }),
        });
        if (!resp.ok) throw new Error("tts");
        const blob = await resp.blob();
        if (blob.size < 500) throw new Error("tts-empty");
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => {
          URL.revokeObjectURL(url);
          audioRef.current = null;
          stopStopWordListener();
          setSpeaking(false);
        };
        await audio.play();
      } catch {
        // Fallback: webbläsarens uppläsning
        fallbackSpeak(text);
      }
    },
    [silence, startStopWordListener, stopStopWordListener, fallbackSpeak],
  );

  const stopSpeaking = silence;

  return {
    supported,
    listening,
    startListening,
    stopListening,
    ttsEnabled,
    setTtsEnabled,
    speaking,
    speak,
    stopSpeaking,
  };
}
