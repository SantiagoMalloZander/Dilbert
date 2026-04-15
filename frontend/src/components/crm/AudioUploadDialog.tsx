"use client";

import { useRef, useState } from "react";
import { Mic, MicOff, Upload, Loader2, CheckCircle2, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { emitGlobalToast } from "@/lib/global-toast";
import { useRouter } from "next/navigation";

type Stage = "idle" | "recording" | "recorded" | "transcribing" | "processing" | "done" | "error";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function AudioUploadDialog({ open, onClose }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const [stage, setStage] = useState<Stage>("idle");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioFileName, setAudioFileName] = useState<string>("");
  const [contactName, setContactName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [transcript, setTranscript] = useState("");
  const [resultSummary, setResultSummary] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  function reset() {
    setStage("idle");
    setAudioBlob(null);
    setAudioFileName("");
    setContactName("");
    setPhoneNumber("");
    setTranscript("");
    setResultSummary("");
    setErrorMessage("");
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    chunksRef.current = [];
  }

  function handleClose() {
    reset();
    onClose();
  }

  // ── File upload ───────────────────────────────────────────────────────────────
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAudioBlob(file);
    setAudioFileName(file.name);
    setStage("recorded");
    // reset input so same file can be re-selected
    e.target.value = "";
  }

  // ── Recording ─────────────────────────────────────────────────────────────────
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        setAudioFileName("grabacion.webm");
        setStage("recorded");
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setStage("recording");
    } catch {
      emitGlobalToast({ text: "No se pudo acceder al micrófono.", tone: "error" });
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
  }

  // ── Submit ────────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!audioBlob) return;

    setStage("transcribing");
    setErrorMessage("");

    const form = new FormData();
    form.append("file", audioBlob, audioFileName || "audio.webm");
    if (contactName.trim()) form.append("contactName", contactName.trim());
    if (phoneNumber.trim()) form.append("phoneNumber", phoneNumber.trim());

    try {
      const res = await fetch("/app/api/agent/transcribe", {
        method: "POST",
        body: form,
      });

      const json = await res.json() as {
        ok?: boolean;
        error?: string;
        transcript?: string;
        status?: string;
        leadsCreated?: string[];
        leadsUpdated?: string[];
        contactCreated?: boolean;
        contactId?: string | null;
      };

      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? "Error desconocido");
      }

      setTranscript(json.transcript ?? "");
      setStage("done");

      // Build human-readable summary
      const parts: string[] = [];
      if (json.contactCreated) parts.push("Contacto creado");
      else if (json.contactId) parts.push("Contacto actualizado");
      if (json.leadsCreated?.length) parts.push(`${json.leadsCreated.length} lead${json.leadsCreated.length > 1 ? "s" : ""} creado${json.leadsCreated.length > 1 ? "s" : ""}`);
      if (json.leadsUpdated?.length) parts.push(`${json.leadsUpdated.length} lead${json.leadsUpdated.length > 1 ? "s" : ""} actualizado${json.leadsUpdated.length > 1 ? "s" : ""}`);
      setResultSummary(parts.length ? parts.join(" · ") : "Datos guardados en el CRM");

      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error inesperado";
      setErrorMessage(msg);
      setStage("error");
    }
  }

  const isLoading = stage === "transcribing" || stage === "processing";

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-4 w-4" />
            Cargar llamada o reunión presencial
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* ── Optional hints ────────────────────────────────────────────── */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Nombre del contacto (opcional)</Label>
              <Input
                placeholder="Juan Pérez"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                disabled={isLoading || stage === "done"}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Teléfono (opcional)</Label>
              <Input
                placeholder="+54 11 1234 5678"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                disabled={isLoading || stage === "done"}
              />
            </div>
          </div>

          {/* ── Audio input area ───────────────────────────────────────────── */}
          {stage === "idle" && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mr-2 h-4 w-4" />
                Subir archivo
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={startRecording}
              >
                <Mic className="mr-2 h-4 w-4" />
                Grabar
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*,.mp3,.wav,.m4a,.ogg,.webm,.flac"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          )}

          {stage === "recording" && (
            <div className="flex items-center justify-between rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-destructive">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive" />
                </span>
                Grabando...
              </div>
              <Button size="sm" variant="destructive" onClick={stopRecording}>
                <MicOff className="mr-2 h-4 w-4" />
                Detener
              </Button>
            </div>
          )}

          {stage === "recorded" && (
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-background/50 px-4 py-3">
              <span className="max-w-[200px] truncate text-sm text-muted-foreground">{audioFileName}</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={reset}
                className="text-muted-foreground hover:text-foreground"
              >
                Cambiar
              </Button>
            </div>
          )}

          {isLoading && (
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-background/50 px-4 py-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {stage === "transcribing" ? "Transcribiendo audio..." : "Procesando en el CRM..."}
            </div>
          )}

          {stage === "done" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-green-400">
                <CheckCircle2 className="h-4 w-4" />
                {resultSummary}
              </div>
              {transcript && (
                <div className="max-h-36 overflow-y-auto rounded-xl border border-white/10 bg-background/50 p-3 text-xs text-muted-foreground">
                  {transcript}
                </div>
              )}
            </div>
          )}

          {stage === "error" && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {errorMessage}
            </div>
          )}

          {/* ── Actions ──────────────────────────────────────────────────────── */}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={handleClose}>
              {stage === "done" ? "Cerrar" : "Cancelar"}
            </Button>
            {stage === "recorded" && (
              <Button onClick={handleSubmit}>
                Procesar
              </Button>
            )}
            {stage === "error" && (
              <Button onClick={() => setStage("recorded")}>
                Reintentar
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
