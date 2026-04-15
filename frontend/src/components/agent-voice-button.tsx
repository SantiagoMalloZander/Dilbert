"use client";

import { useRef, useState } from "react";
import { Mic, MicOff, Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

type Stage = "idle" | "recording" | "transcribing" | "done" | "error";

export function AgentVoiceButton() {
  const router = useRouter();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const [stage, setStage] = useState<Stage>("idle");
  const [seconds, setSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [resultText, setResultText] = useState("");
  const [errorText, setErrorText] = useState("");

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "";

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (timerRef.current) clearInterval(timerRef.current);

        const blob = new Blob(chunksRef.current, { type: mimeType || "audio/webm" });
        await processBlob(blob);
      };

      recorder.start(250); // collect chunks every 250ms
      mediaRecorderRef.current = recorder;
      setStage("recording");
      setSeconds(0);

      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      setErrorText("No se pudo acceder al micrófono.");
      setStage("error");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setStage("transcribing");
  }

  async function processBlob(blob: Blob) {
    setStage("transcribing");
    setErrorText("");

    const form = new FormData();
    form.append("file", blob, "grabacion.webm");

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

      const parts: string[] = [];
      if (json.contactCreated) parts.push("Contacto creado");
      else if (json.contactId) parts.push("Contacto actualizado");
      if (json.leadsCreated?.length) parts.push(`${json.leadsCreated.length} lead${json.leadsCreated.length > 1 ? "s" : ""} creado${json.leadsCreated.length > 1 ? "s" : ""}`);
      if (json.leadsUpdated?.length) parts.push(`${json.leadsUpdated.length} lead${json.leadsUpdated.length > 1 ? "s" : ""} actualizado${json.leadsUpdated.length > 1 ? "s" : ""}`);

      setResultText(parts.length ? parts.join(" · ") : "Datos guardados en el CRM");
      setStage("done");
      router.refresh();
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : "Error al procesar");
      setStage("error");
    }
  }

  function reset() {
    setStage("idle");
    setSeconds(0);
    setResultText("");
    setErrorText("");
  }

  const isRecording = stage === "recording";
  const isLoading = stage === "transcribing";

  function formatTime(s: number) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, "0")}`;
  }

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      {/* Big mic button */}
      <button
        onClick={isRecording ? stopRecording : stage === "idle" || stage === "error" || stage === "done" ? startRecording : undefined}
        disabled={isLoading}
        className={cn(
          "relative flex h-24 w-24 items-center justify-center rounded-full transition-all focus:outline-none",
          isRecording
            ? "bg-destructive shadow-[0_0_0_12px_hsl(var(--destructive)/0.15)] hover:bg-destructive/90"
            : isLoading
            ? "bg-muted cursor-not-allowed"
            : stage === "done"
            ? "bg-green-500/20 hover:bg-green-500/30"
            : "bg-primary/10 hover:bg-primary/20 border border-primary/30",
        )}
      >
        {isLoading ? (
          <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
        ) : stage === "done" ? (
          <CheckCircle2 className="h-10 w-10 text-green-400" />
        ) : isRecording ? (
          <MicOff className="h-10 w-10 text-white" />
        ) : (
          <Mic className="h-10 w-10 text-primary" />
        )}

        {/* Pulse ring while recording */}
        {isRecording && (
          <span className="absolute inset-0 animate-ping rounded-full bg-destructive/30" />
        )}
      </button>

      {/* Label */}
      <div className="text-center">
        {stage === "idle" && (
          <p className="text-sm font-medium text-muted-foreground">Tocá para grabar una llamada</p>
        )}
        {isRecording && (
          <p className="text-sm font-semibold text-destructive tabular-nums">
            {formatTime(seconds)} · Tocá para terminar
          </p>
        )}
        {stage === "transcribing" && (
          <p className="text-sm text-muted-foreground">Transcribiendo y cargando al CRM...</p>
        )}
        {stage === "done" && (
          <div className="space-y-1">
            <p className="text-sm font-medium text-green-400">{resultText}</p>
            <button onClick={reset} className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
              Grabar otra llamada
            </button>
          </div>
        )}
        {stage === "error" && (
          <div className="space-y-1">
            <p className="text-sm text-destructive">{errorText}</p>
            <button onClick={reset} className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
              Reintentar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
