import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createTwin, createVoice } from "@/lib/twin/twin.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Textarea } from "@/components/ui/textarea";
import tessa from "@/assets/dr-tessa-coat.jpg.asset.json";
import { canContinueSetup } from "@/lib/twin/setup";

export const Route = createFileRoute("/_authenticated/twin/doctor")({
  head: () => ({ meta: [{ title: "Create a doctor twin — MYOS" }, { name: "description", content: "Set up a doctor's AI twin from identity, photo, voice and protocols." }, { property: "og:title", content: "Create a MYOS doctor twin" }, { property: "og:description", content: "Four steps to a doctor's AI twin." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: DoctorSetup,
});

const STEPS = ["Your profile", "Headshots", "Voice", "Knowledge base", "Preview"];
const TITLES = ["Create your digital twin.", "Give your digital twin a face.", "Make your digital twin sound like you.", "Teach your digital twin your expertise.", "Preview your digital twin."];
const SCRIPT = "Hello, I'm your fertility specialist. Many of my patients have questions between appointments, about injections, scans, egg retrieval and recovery. I want you to feel informed and supported at every step. If anything feels urgent, please contact the clinic straight away. Today I'd like to explain how treatment usually unfolds, what you might feel, and when to call us.";

async function resizePhoto(file: File): Promise<string> {
  const img = await createImageBitmap(file);
  const s = Math.min(1, 640 / Math.max(img.width, img.height));
  const c = document.createElement("canvas"); c.width = img.width * s; c.height = img.height * s;
  const context = c.getContext("2d");
  if (!context) throw new Error("Could not prepare the photo.");
  context.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.85);
}

async function readDoc(file: File): Promise<{ name: string; pages: string[]; file: File }> {
  if (/\.pdf$/i.test(file.name) || file.type === "application/pdf") {
    const pdfjs = await import("pdfjs-dist");
    const worker = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
    pdfjs.GlobalWorkerOptions.workerSrc = worker;
    const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    const pages: string[] = [];
    for (let i = 1; i <= Math.min(pdf.numPages, 200); i++) {
      const tc = await (await pdf.getPage(i)).getTextContent();
      pages.push(tc.items.map((it) => ("str" in it ? it.str + (it.hasEOL ? "\n" : " ") : "")).join("").slice(0, 60000));
    }
    return { name: file.name, pages, file };
  }
  const text = await file.text();
  const pages = text.split(/\f|\n(?=#{1,3} )/).map((p) => p.slice(0, 60000)).slice(0, 200);
  return { name: file.name, pages, file };
}

const toB64 = (blob: Blob) => new Promise<string>((r) => { const fr = new FileReader(); fr.onload = () => r(String(fr.result).split(",")[1] ?? ""); fr.readAsDataURL(blob); });

function DoctorSetup() {
  const nav = useNavigate(); const qc = useQueryClient(); const { user } = useAuth();
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [bio, setBio] = useState("");
  const [step, setStep] = useState(0);
  const [id, setId] = useState({ name: "", clinic: "", specialty: "Reproductive endocrinology", languages: "English", is_female: false, treats_pcos: false, treats_endo: false, supports_queer_trans: false, supports_single_women: false });
  const [photos, setPhotos] = useState<string[]>([tessa.url]);
  const [voice, setVoice] = useState<Blob | null>(null);
  const [recording, setRecording] = useState<MediaRecorder | null>(null);
  const [docs, setDocs] = useState<{ name: string; pages: string[]; file: File }[]>([]);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState("");
  const parts = useRef<Blob[]>([]);

  const record = async () => {
    if (recording) { recording.stop(); return; }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mr = new MediaRecorder(stream); parts.current = [];
    mr.ondataavailable = (e) => parts.current.push(e.data);
    mr.onstop = () => { setVoice(new Blob(parts.current, { type: mr.mimeType })); stream.getTracks().forEach((t) => t.stop()); setRecording(null); };
    mr.start(); setRecording(mr);
  };

  const canNext = canContinueSetup(step, id.name, !!busy || !!recording);

  const create = async () => {
    if (!consent) { toast.error("Consent is required before the twin can be created."); return; }
    if (!user) { toast.error("Please sign in to save your twin."); return; }
    try {
      setBusy("Saving your files…");
      const folder = `${user.id}/${crypto.randomUUID()}`;
      const put = async (name: string, body: Blob) => {
        const path = `${folder}/${name.replace(/[^\w.\-]+/g, "_")}`;
        const { error } = await supabase.storage.from("twin-media").upload(path, body, { contentType: body.type || undefined });
        if (error) throw new Error(`Upload failed for ${name}: ${error.message}`);
        return path;
      };
      for (const [i, f] of photoFiles.entries()) await put(`headshot-${i + 1}-${f.name}`, f);
      if (voice) await put(`voice-sample.${(voice.type.split("/")[1] || "webm").split(";")[0]}`, voice);
      const stored = await Promise.all(docs.map(async (d) => ({ name: d.name, pages: d.pages, storage_path: await put(`doc-${d.name}`, d.file) })));
      setBusy("Reading your documents…");
      const r = await createTwin({ data: { ...id, bio, consent: true, photos, mouth_x: 0.5, mouth_y: 0.72, documents: stored } });
      if (voice) {
        setBusy("Creating voice…");
        try { const v = await createVoice({ data: { doctorId: r.id, audio: await toB64(voice), mime: voice.type || "audio/webm" } }); toast.success(v.provider === "elevenlabs" ? "Voice cloned." : "No voice provider key set — the browser voice will be used."); }
        catch (e) { toast.error(`Voice not created: ${(e as Error).message}. The browser voice will be used.`); }
      }
      toast.success(`Draft saved with ${r.chunks} passages. Preview it, then send it for review.`);
      qc.invalidateQueries({ queryKey: ["twin"] }); nav({ to: "/twin/provider" });
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(""); }
  };

  const Yn = ({ k, label }: { k: keyof typeof id; label: string }) => (
    <label className="flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-2.5 text-sm">{label}
      <span className="flex gap-1">{[true, false].map((v) => <button key={String(v)} type="button" onClick={() => setId({ ...id, [k]: v })} className={`rounded-full px-3 py-1 text-xs ${id[k] === v ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>{v ? "Yes" : "No"}</button>)}</span>
    </label>
  );

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-5xl">{TITLES[step]}</h1>
      <ol className="mt-6 grid grid-cols-5 gap-2">{STEPS.map((s, i) => (
        <li key={s} className="text-xs"><div className={`h-1.5 rounded-full ${i <= step ? "bg-primary" : "bg-secondary"}`} /><p className={`mt-1.5 ${i === step ? "font-medium" : "text-muted-foreground"}`}>{i + 1}. {s}</p></li>
      ))}</ol>

      <div className="mt-8 space-y-4">
        {step === 0 && <>
          <Input placeholder="Name (without 'Dr')" value={id.name} onChange={(e) => setId({ ...id, name: e.target.value })} />
          <Input placeholder="Clinic" value={id.clinic} onChange={(e) => setId({ ...id, clinic: e.target.value })} />
          <Input placeholder="Specialty" value={id.specialty} onChange={(e) => setId({ ...id, specialty: e.target.value })} />
          <Input placeholder="Languages, comma separated" value={id.languages} onChange={(e) => setId({ ...id, languages: e.target.value })} />
          <Textarea placeholder="Short introduction patients will see" value={bio} onChange={(e) => setBio(e.target.value)} />
          <p className="pt-2 text-sm font-medium">Shown to patients</p>
          <Yn k="is_female" label="I am a female doctor" />
          <Yn k="treats_pcos" label="Treats PCOS" />
          <Yn k="treats_endo" label="Treats endometriosis" />
          <Yn k="supports_queer_trans" label="Has supported queer or trans patients" />
          <Yn k="supports_single_women" label="Has supported single women" />
        </>}

        {step === 1 && <>
          <Input aria-label="Upload headshots" type="file" accept="image/*" multiple onChange={async (e) => { const fs = Array.from(e.target.files ?? []).slice(0, 3); setPhotoFiles(fs); setPhotos(fs.length ? await Promise.all(fs.map(resizePhoto)) : [tessa.url]); }} />
          {photos[0] === tessa.url && <p className="text-sm text-muted-foreground">Dr Tessa Juras · Demo photo</p>}
          {photos[0] && <div className="inline-block">
            <img src={photos[0]} alt="Headshot preview" className="max-h-96 rounded-2xl" />
          </div>}
          <div className="flex gap-2">{photos.slice(1).map((p, i) => <img key={i} src={p} alt="" className="h-20 rounded-xl" />)}</div>
        </>}

        {step === 2 && <>
          <p className="text-sm text-muted-foreground">Record 1 to 2 minutes in a quiet room. Read this aloud:</p>
          <blockquote className="rounded-2xl bg-card p-4 font-display text-lg italic">{SCRIPT}</blockquote>
          <Input type="file" accept="audio/*" onChange={(e) => setVoice(e.target.files?.[0] ?? null)} />
          <Button type="button" variant={recording ? "destructive" : "outline"} className="rounded-full" onClick={record}>{recording ? "Stop recording" : "Record sample"}</Button>
          {voice && <audio controls src={URL.createObjectURL(voice)} className="w-full" />}
        </>}

        {step === 3 && <>
          <Input type="file" accept=".pdf,.txt,.md,application/pdf,text/plain" multiple onChange={async (e) => {
            setBusy("Reading documents…");
            try { setDocs(await Promise.all(Array.from(e.target.files ?? []).map(readDoc))); } catch (err) { toast.error(`Could not read a document: ${(err as Error).message}`); } finally { setBusy(""); }
          }} />
          <ul className="text-sm text-muted-foreground">{docs.map((d) => <li key={d.name}>{d.name} — {d.pages.length} page(s), {d.pages.join("").length.toLocaleString()} characters</li>)}</ul>
        </>}

        {step === 4 && <div className="space-y-5">
          <div className="flex gap-5 rounded-[1.75rem] bg-card p-5">
            {photos[0] && <img src={photos[0]} alt="" className="h-32 w-28 rounded-2xl object-cover" />}
            <div><p className="text-xs text-muted-foreground">What patients will see</p><h2 className="text-3xl">Dr {id.name || "—"}</h2><p className="text-sm text-muted-foreground">{id.specialty} · {id.clinic}</p><p className="mt-2 text-sm">{bio}</p><p className="mt-1 text-xs text-muted-foreground">Speaks {id.languages}</p></div>
          </div>
          <ul className="space-y-1 text-sm"><li>Headshots: {photos[0] === tessa.url ? "Dr Tessa's demo photo" : photos.length}</li><li>Voice sample: {voice ? "recorded" : "none (browser voice)"}</li><li>Documents: {docs.length ? docs.map((d) => d.name).join(", ") : "None added"}</li></ul>
          {voice && <audio controls src={URL.createObjectURL(voice)} className="w-full" />}
          <label className="flex items-start gap-3 rounded-2xl bg-pink-soft p-4 text-sm"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1" />I consent to my face, voice and documents being used for this AI twin, and I own or have permission to use these photos.</label>
          <p className="text-xs text-muted-foreground">Saving creates a draft. You can test it, then send it for review. Patients only see it after an admin approves it.</p>
        </div>}
      </div>

      <div className="mt-8 flex justify-between">
        <Button variant="ghost" disabled={step === 0 || !!busy} onClick={() => setStep(step - 1)}>Back</Button>
        {step < 4 ? <div className="flex gap-2">
          {step >= 1 && <Button variant="ghost" disabled={!canNext} onClick={() => setStep(step + 1)}>{step === 1 && photos[0] === tessa.url ? "Use demo photo" : "Skip for now"}</Button>}
          <Button className="rounded-full" disabled={!canNext} onClick={() => setStep(step + 1)}>Next</Button>
        </div>
          : <Button className="rounded-full" disabled={!consent || !!busy} onClick={create}>{busy || "Save draft"}</Button>}
      </div>
    </div>
  );
}
