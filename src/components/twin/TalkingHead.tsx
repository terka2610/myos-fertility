import { useEffect, useState } from "react";
import { Volume2 } from "lucide-react";

/** Static doctor portrait (no lip-sync). Shows a soft "speaking" indicator while audio plays. */
export function TalkingHead({ src, levelRef }: { src: string; mouthX?: number; mouthY?: number; levelRef: React.MutableRefObject<number>; size?: number }) {
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => {
    const id = setInterval(() => setSpeaking(levelRef.current > 0.02), 200);
    return () => clearInterval(id);
  }, [levelRef]);
  return (
    <div className={`relative overflow-hidden rounded-[1.75rem] bg-secondary shadow-lg ring-4 transition ${speaking ? "ring-primary/40" : "ring-transparent"}`}>
      <img src={src} alt="Doctor portrait" className="aspect-[4/5] w-full object-cover" />
      {speaking && <span className="absolute bottom-3 left-3 flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs text-primary-foreground"><Volume2 className="h-3 w-3" />Speaking</span>}
    </div>
  );
}

/** Play base64 mp3 and feed volume into levelRef via a Web Audio analyser. */
export async function playWithLevel(b64: string, levelRef: React.MutableRefObject<number>) {
  const audio = new Audio(`data:audio/mpeg;base64,${b64}`);
  const ac = new AudioContext();
  const an = ac.createAnalyser(); an.fftSize = 512;
  ac.createMediaElementSource(audio).connect(an); an.connect(ac.destination);
  const buf = new Uint8Array(an.fftSize);
  let raf = 0;
  const tick = () => { an.getByteTimeDomainData(buf); let sum = 0; for (const v of buf) sum += ((v - 128) / 128) ** 2; levelRef.current = Math.min(1, Math.sqrt(sum / buf.length) * 6); raf = requestAnimationFrame(tick); };
  tick();
  await audio.play();
  await new Promise<void>((r) => { audio.onended = () => r(); audio.onerror = () => r(); });
  cancelAnimationFrame(raf); levelRef.current = 0; ac.close();
}

/** Browser voice fallback; no audio stream is available, so the mouth follows word boundaries with a synthetic envelope. */
export function speakBrowser(text: string, levelRef: React.MutableRefObject<number>, female = true, lang = "en-US") {
  return new Promise<void>((resolve) => {
    if (!("speechSynthesis" in window)) return resolve();
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    const voices = speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith(lang.slice(0, 2).toLowerCase()));
    u.voice = voices.find((v) => (female ? /female|samantha|victoria|zira|karen/i : /male|daniel|alex|david/i).test(v.name)) || voices[0] || null;
    let speaking = true; let raf = 0;
    const tick = (t: number) => { if (!speaking) return; levelRef.current = 0.25 + 0.55 * Math.abs(Math.sin(t / 90)) * (0.6 + 0.4 * Math.sin(t / 310)); raf = requestAnimationFrame(tick); };
    u.onstart = () => { raf = requestAnimationFrame(tick); };
    u.onend = u.onerror = () => { speaking = false; cancelAnimationFrame(raf); levelRef.current = 0; resolve(); };
    speechSynthesis.speak(u);
  });
}
