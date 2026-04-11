"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ClipboardCopy,
  ExternalLink,
  KeyRound,
  Loader2,
  Video,
  Webhook,
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

const WEBHOOK_BASE_URL = "https://dilvert.netlify.app/app/api/webhooks/fathom";
const FATHOM_API_URL = "https://fathom.video/settings/api";
const FATHOM_WEBHOOK_URL = "https://fathom.video/settings/webhooks";

type Step = "intro" | "get_key" | "enter_key" | "webhook" | "saving" | "done";

export function FathomSetupDialog({
  open,
  userId,
  onClose,
  onSave,
}: {
  open: boolean;
  userId?: string;
  onClose: () => void;
  onSave: (apiKey: string) => Promise<void>;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("intro");
  const [apiKey, setApiKey] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const webhookUrl = userId
    ? `${WEBHOOK_BASE_URL}?token=${userId}`
    : WEBHOOK_BASE_URL;

  function reset() {
    setStep("intro");
    setApiKey("");
    setCopied(false);
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
    } catch {
      setError("No pude guardar la API Key. Intentá de nuevo.");
      setStep("enter_key");
    }
  }

  async function copyWebhookUrl() {
    await navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const stepNumber = { intro: 0, get_key: 1, enter_key: 2, webhook: 3, saving: 3, done: 4 }[step];
  const totalSteps = 3;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-md rounded-[28px] border border-white/10 bg-card/95 p-0 shadow-panel backdrop-blur">

        {/* Header */}
        <DialogHeader className="px-6 pt-6">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Video className="h-5 w-5" />
          </div>
          <DialogTitle>Conectar Google Meet con Fathom</DialogTitle>

          {/* Progress dots */}
          {step !== "intro" && step !== "done" && step !== "saving" && (
            <div className="mt-3 flex items-center gap-1.5">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${
                    i < stepNumber
                      ? "w-4 bg-primary"
                      : i === stepNumber - 1
                      ? "w-6 bg-primary"
                      : "w-4 bg-white/10"
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
                Fathom graba y transcribe tus reuniones de Google Meet automáticamente. Una vez conectado, cada reunión que tengas va a aparecer como una actividad en tu CRM.
              </p>
              <div className="space-y-3">
                {[
                  { icon: KeyRound, label: "Paso 1 — Copiás tu clave de Fathom" },
                  { icon: Webhook, label: "Paso 2 — La pegás acá" },
                  { icon: CheckCircle2, label: "Paso 3 — Configurás Fathom para que avise a Dilbert" },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-background/50 px-4 py-3 text-sm">
                    <Icon className="h-4 w-4 shrink-0 text-primary" />
                    <span>{label}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                ⏱ Son menos de 5 minutos.
              </p>
            </div>
            <DialogFooter className="rounded-b-[28px] px-6 pb-6">
              <Button className="w-full" onClick={() => setStep("get_key")}>
                Empezar
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </DialogFooter>
          </>
        )}

        {/* STEP 1 — GET KEY */}
        {step === "get_key" && (
          <>
            <div className="space-y-4 px-6 py-4">
              <div className="rounded-2xl border border-white/10 bg-background/50 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Paso 1 de 3</p>
                <p className="mt-1 font-medium">Obtené tu clave de Fathom</p>
              </div>
              <ol className="space-y-3 text-sm text-muted-foreground">
                <li className="flex gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">1</span>
                  Abrí Fathom en tu navegador haciendo click en el botón de abajo.
                </li>
                <li className="flex gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">2</span>
                  Vas a ver una página que dice <strong className="text-foreground">"API Keys"</strong>. Hacé click en <strong className="text-foreground">"New API key"</strong> o <strong className="text-foreground">"Create key"</strong>.
                </li>
                <li className="flex gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">3</span>
                  Ponele cualquier nombre (por ejemplo "Dilbert") y copiá la clave que aparece.
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
                <ChevronLeft className="mr-1 h-4 w-4" />
                Volver
              </Button>
              <Button className="flex-1" onClick={() => setStep("enter_key")}>
                Ya la tengo
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </DialogFooter>
          </>
        )}

        {/* STEP 2 — ENTER KEY */}
        {step === "enter_key" && (
          <>
            <div className="space-y-4 px-6 py-4">
              <div className="rounded-2xl border border-white/10 bg-background/50 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Paso 2 de 3</p>
                <p className="mt-1 font-medium">Pegá tu clave acá</p>
              </div>
              <p className="text-sm text-muted-foreground">
                Copiaste la clave de Fathom en el paso anterior. Ahora pegala en el campo de abajo.
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
                Tu clave queda guardada de forma segura y nunca la vemos nosotros.
              </p>
            </div>
            <DialogFooter className="flex-row gap-2 rounded-b-[28px] px-6 pb-6">
              <Button variant="outline" className="flex-1" onClick={() => setStep("get_key")}>
                <ChevronLeft className="mr-1 h-4 w-4" />
                Volver
              </Button>
              <Button className="flex-1" onClick={() => setStep("webhook")} disabled={!apiKey.trim()}>
                Continuar
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </DialogFooter>
          </>
        )}

        {/* STEP 3 — WEBHOOK */}
        {step === "webhook" && (
          <>
            <div className="space-y-4 px-6 py-4">
              <div className="rounded-2xl border border-white/10 bg-background/50 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Paso 3 de 3</p>
                <p className="mt-1 font-medium">Conectá Fathom con Dilbert</p>
              </div>
              <ol className="space-y-3 text-sm text-muted-foreground">
                <li className="flex gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">1</span>
                  Abrí Fathom en Webhooks haciendo click en el botón de abajo.
                </li>
                <li className="flex gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">2</span>
                  Hacé click en <strong className="text-foreground">"Add webhook"</strong> o <strong className="text-foreground">"New webhook"</strong>.
                </li>
                <li className="flex gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">3</span>
                  Copiá esta URL y pegala en el campo que te pide Fathom:
                </li>
              </ol>
              <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
                <code className="flex-1 break-all text-xs text-primary">{webhookUrl}</code>
                <button
                  onClick={copyWebhookUrl}
                  className="shrink-0 rounded-lg p-1.5 transition-colors hover:bg-white/10"
                  title="Copiar URL"
                >
                  {copied ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <ClipboardCopy className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              </div>
              <a
                href={FATHOM_WEBHOOK_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-background/50 px-4 py-3 text-sm font-medium transition-colors hover:bg-background/80"
              >
                <ExternalLink className="h-4 w-4" />
                Abrir Fathom → Webhooks
              </a>
            </div>
            <DialogFooter className="flex-row gap-2 rounded-b-[28px] px-6 pb-6">
              <Button variant="outline" className="flex-1" onClick={() => setStep("enter_key")}>
                <ChevronLeft className="mr-1 h-4 w-4" />
                Volver
              </Button>
              <Button className="flex-1" onClick={handleSave}>
                Listo, conectar
                <CheckCircle2 className="ml-2 h-4 w-4" />
              </Button>
            </DialogFooter>
          </>
        )}

        {/* SAVING */}
        {step === "saving" && (
          <div className="flex flex-col items-center gap-4 px-6 py-10">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Guardando configuración...</p>
          </div>
        )}

        {/* DONE */}
        {step === "done" && (
          <>
            <div className="flex flex-col items-center gap-4 px-6 py-8">
              <CheckCircle2 className="h-14 w-14 text-emerald-400" />
              <div className="text-center">
                <p className="text-lg font-semibold">¡Google Meet conectado!</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  A partir de ahora, cada reunión que tengas en Google Meet va a aparecer automáticamente en tu CRM con el resumen y los próximos pasos.
                </p>
              </div>
            </div>
            <DialogFooter className="rounded-b-[28px] px-6 pb-6">
              <Button className="w-full" onClick={handleClose}>
                Ir al CRM
              </Button>
            </DialogFooter>
          </>
        )}

      </DialogContent>
    </Dialog>
  );
}
