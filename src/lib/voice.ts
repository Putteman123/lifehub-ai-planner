import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
        results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal?: boolean }>;
      }) => void)
    | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

/** Ord som tystar Andrea direkt medan hon talar. */
const STOP_WORDS = ["tyst", "tysta", "stopp", "stoppa", "sluta", "stop", "vänta", "okej okej"];

function normalize(text: string) {
  return text.toLowerCase().replace(/[.,!?]/g, "").trim();
}

function isStopCommand(text: string) {
  const t = normalize(text);
  if (!t) return false;
  if (t.split(/\s+/).length > 4) return false;
  return STOP_WORDS.some((w) => t === w || t.startsWith(`${w} `) || t.endsWith(` ${w}`));
}

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

/**
 * Handsfree-samtal med Andrea: mikrofonen är igång även medan hon talar.
 * "Tyst"/"stopp" tystar henne direkt, och säger man något annat under
 * uppläsningen avbryts hon och svarar på det nya (barge-in).
 */
export function useVoice(onTranscript: (text: string) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [speaking, setSpeaking] = useState(false);

  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const activeRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const speakingRef = useRef(false);
  const playStartedAtRef = useRef(0);
  const spokenWordsRef = useRef<string[]>([]);
  const cbRef = useRef(onTranscript);
  cbRef.current = onTranscript;

  const silenceRef = useRef<() => void>(() => {});

  useEffect(() => {
    setSupported(!!createRecognition());
    return () => {
      activeRef.current = false;
      recRef.current?.abort();
      audioRef.current?.pause();
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    };
  }, []);

  /** Andreas eget ljud får inte tolkas som att Patrick pratar. */
  const isEcho = useCallback((text: string) => {
    if (!speakingRef.current) return false;
    if (Date.now() - playStartedAtRef.current < 350) return true;
    const words = normalize(text).split(/\s+/).filter(Boolean);
    if (words.length === 0) return true;
    const spoken = spokenWordsRef.current;
    if (spoken.length === 0) return false;
    const hits = words.filter((w) => w.length > 3 && spoken.includes(w)).length;
    return hits / words.length > 0.6;
  }, []);

  const handleSpeech = useCallback(
    (text: string, isFinal: boolean) => {
      const clean = text.trim();
      if (!clean) return;

      if (speakingRef.current) {
        if (isStopCommand(clean)) {
          silenceRef.current();
          return;
        }
        if (isEcho(clean)) return;
        // Barge-in: Patrick pratar över henne – tysta och svara på det nya.
        if (isFinal) {
          silenceRef.current();
          cbRef.current(clean);
        }
        return;
      }

      if (!isFinal) return;
      if (isStopCommand(clean)) return;
      cbRef.current(clean);
    },
    [isEcho],
  );

  const stopListening = useCallback(() => {
    activeRef.current = false;
    recRef.current?.stop();
    setListening(false);
  }, []);

  const startListening = useCallback(() => {
    if (activeRef.current) return;
    const rec = createRecognition();
    if (!rec) return;
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (event) => {
      const results = event.results;
      for (let i = event.resultIndex ?? 0; i < results.length; i++) {
        const res = results[i];
        if (!res) continue;
        const text = res[0]?.transcript ?? "";
        handleSpeech(text, !!res.isFinal);
      }
    };
    rec.onerror = (event) => {
      const fatal = ["not-allowed", "service-not-allowed"];
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
  }, [handleSpeech]);

  const silence = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    speakingRef.current = false;
    spokenWordsRef.current = [];
    setSpeaking(false);
  }, []);
  silenceRef.current = silence;

  const fallbackSpeak = useCallback(
    (text: string) => {
      if (typeof window === "undefined" || !window.speechSynthesis) {
        speakingRef.current = false;
        setSpeaking(false);
        return;
      }
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = "sv-SE";
      utter.rate = 1.03;
      const sv = window.speechSynthesis.getVoices().find((v) => v.lang?.startsWith("sv"));
      if (sv) utter.voice = sv;
      utter.onend = () => {
        speakingRef.current = false;
        setSpeaking(false);
      };
      utter.onerror = () => {
        speakingRef.current = false;
        setSpeaking(false);
      };
      playStartedAtRef.current = Date.now();
      window.speechSynthesis.speak(utter);
    },
    [],
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
      const text = clean.length > 900 ? `${clean.slice(0, 900)}…` : clean;
      spokenWordsRef.current = normalize(text).split(/\s+/).filter(Boolean);
      speakingRef.current = true;
      playStartedAtRef.current = Date.now();
      setSpeaking(true);

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
        if (!speakingRef.current) return; // tystad medan ljudet hämtades
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => {
          URL.revokeObjectURL(url);
          audioRef.current = null;
          speakingRef.current = false;
          spokenWordsRef.current = [];
          setSpeaking(false);
        };
        playStartedAtRef.current = Date.now();
        await audio.play();
      } catch {
        if (speakingRef.current) fallbackSpeak(text);
      }
    },
    [silence, fallbackSpeak],
  );

  return useMemo(
    () => ({
      supported,
      listening,
      startListening,
      stopListening,
      ttsEnabled,
      setTtsEnabled,
      speaking,
      speak,
      stopSpeaking: silence,
    }),
    [
      listening,
      silence,
      speak,
      speaking,
      startListening,
      stopListening,
      supported,
      ttsEnabled,
    ],
  );
}
