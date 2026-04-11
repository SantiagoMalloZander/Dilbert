"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ExternalLink,
  KeyRound,
  Loader2,
  Video,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const FATHOM_API_URL = "https://fathom.video/settings/api";

type Step = "intro" | "get_key" | "enter_key" | "saving" | "done";

export function FathomSetupDialog({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (apiKey: string) => Promise<void>;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("intro");
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setStep("intro");
    setApiKey("");
    setError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSave() {
    if (!apiKey.trim()) {
      setError("Pegá tu API Key de Fathom antes de continuar.");
      return;
    }
    setError(null);
    setStep("saving");
    try {
      await onSave(apiKey.trim());
      setStep("done");
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pude conectar Fathom. Verificá tu API Key.");
      setStep("enter_key");
    }
  }

  const stepNumber = { intro: 0, get_key: 1, enter_key: 2, saving: 2, done: 3 }[step];
  const totalSteps = 2;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-md rounded-[28px] border border-white/10 bg-card/95 p-0 shadow-panel backdrop-blur">

        {/* Header */}
        <DialogHeader className="px-6 pt-6">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Video className="h-5 w-5" />
          </div>
          <DialogTitle>Conectar videollamadas con Fathom</DialogTitle>

          {step !== "intro" && step !== "done" && step !== "saving" && (
            <div className="mt-3 flex items-center gap-1.5">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${
                    i < stepNumber ? "w-4 bg-primary" : i === stepNumber - 1 ? "w-6 bg-primary" : "w-4 bg-white/10"
                  }`}
                />
              ))}
            </div>
          )}
        </DialogHeader>

        {/* INTRO */}
        {step === "intro" && (
          <>
            <div className="space-y-4 px-6 py-4">
              <p className="text-sm text-muted-foreground">
                Fathom graba y transcribe tus reuniones de Google Meet, Zoom y Teams automáticamente. Una vez conectado, cada reunión aparece en el CRM con resumen e IA.
              </p>
              <div className="space-y-3">
                {[
                  { icon: KeyRound, label: "Paso 1 — Copiás tu API Key de Fathom" },
                  { icon: Zap, label: "Paso 2 — La pegás acá y Dilbert se conecta solo" },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-background/50 px-4 py-3 text-sm">
                    <Icon className="h-4 w-4 shrink-0 text-primary" />
                    <span>{label}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">⏱ Son menos de 2 minutos.</p>
            </div>
            <DialogFooter className="rounded-b-[28px] px-6 pb-6">
              <Button className="w-full" onClick={() => setStep("get_key")}>
                Empezar <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </DialogFooter>
          </>
        )}

        {/* STEP 1 — GET KEY */}
        {step === "get_key" && (
          <>
            <div className="space-y-4 px-6 py-4">
              <div className="rounded-2xl border border-white/10 bg-background/50 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Paso 1 de 2</p>
                <p className="mt-1 font-medium">Obtené tu API Key de Fathom</p>
              </div>
              <ol className="space-y-3 text-sm text-muted-foreground">
                <li className="flex gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">1</span>
                  Hacé click en el botón de abajo para abrir Fathom.
                </li>
                <li className="flex gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">2</span>
                  Buscá la sección <strong className="text-foreground">"API Keys"</strong> y hacé click en <strong className="text-foreground">"New API key"</strong>.
                </li>
                <li className="flex gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">3</span>
                  Ponele cualquier nombre (ej: "Dilbert") y copiá la clave.
                </li>
              </ol>
              <a
                href={FATHOM_API_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-background/50 px-4 py-3 text-sm font-medium transition-colors hover:bg-background/80"
              >
                <ExternalLink className="h-4 w-4" />
                Abrir Fathom → API Keys
              </a>
            </div>
            <DialogFooter className="flex-row gap-2 rounded-b-[28px] px-6 pb-6">
              <Button variant="outline" className="flex-1" onClick={() => setStep("intro")}>
                <ChevronLeft className="mr-1 h-4 w-4" /> Volver
              </Button>
              <Button className="flex-1" onClick={() => setStep("enter_key")}>
                Ya la tengo <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </DialogFooter>
          </>
        )}

        {/* STEP 2 — ENTER KEY */}
        {step === "enter_key" && (
          <>
            <div className="space-y-4 px-6 py-4">
              <div className="rounded-2xl border border-white/10 bg-background/50 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Paso 2 de 2</p>
                <p className="mt-1 font-medium">Pegá tu API Key acá</p>
              </div>
              <p className="text-sm text-muted-foreground">
                Dilbert va a crear la conexión automáticamente. No necesitás configurar nada más en Fathom.
              </p>
              <div className="space-y-2">
                <Label htmlFor="fathom-key">API Key de Fathom</Label>
                <Input
                  id="fathom-key"
                  value={apiKey}
                  onChange={(e) => { setApiKey(e.target.value); setError(null); }}
                  placeholder="fathom_..."
                  autoFocus
                />
                {error && <p className="text-xs text-destructive">{error}</p>}
              </div>
              <p className="text-xs text-muted-foreground">
                Tu clave queda guardada de forma segura.
              </p>
            </div>
            <DialogFooter className="flex-row gap-2 rounded-b-[28px] px-6 pb-6">
              <Button variant="outline" className="flex-1" onClick={() => setStep("get_key")}>
                <ChevronLeft className="mr-1 h-4 w-4" /> Volver
              </Button>
              <Button className="flex-1" onClick={handleSave} disabled={!apiKey.trim()}>
                Conectar <CheckCircle2 className="ml-2 h-4 w-4" />
              </Button>
            </DialogFooter>
          </>
        )}

        {/* SAVING */}
        {step === "saving" && (
          <div className="flex flex-col items-center gap-4 px-6 py-10">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Conectando con Fathom...</p>
          </div>
        )}

        {/* DONE */}
        {step === "done" && (
          <>
            <div className="flex flex-col items-center gap-4 px-6 py-8">
              <CheckCircle2 className="h-14 w-14 text-emerald-400" />
              <div className="text-center">
                <p className="text-lg font-semibold">¡Conectado!</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  A partir de ahora, cada reunión grabada por Fathom (Meet, Zoom, Teams) va a aparecer automáticamente en tu CRM.
                </p>
              </div>
            </div>
            <DialogFooter className="rounded-b-[28px] px-6 pb-6">
              <Button className="w-full" onClick={handleClose}>Ir al CRM</Button>
            </DialogFooter>
          </>
        )}

      </DialogContent>
    </Dialog>
  );
}
