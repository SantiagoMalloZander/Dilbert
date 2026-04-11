"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, MessageCircleMore, User, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

type Step =
  | "ask_personal"       // ¿Tenés contactos personales?
  | "ask_classify"       // ¿Querés que los identifiquemos automáticamente?
  | "manual_exclude"     // Ingresar números a excluir
  | "classifying"        // AI clasificando...
  | "review_personal"    // Revisar qué detectó como personal
  | "importing"          // Importando contactos...
  | "done";              // Listo

type PersonalContact = { jid: string; name: string };

export function WhatsAppOnboardingDialog({
  instanceName,
  open,
  onClose,
}: {
  instanceName: string;
  open: boolean;
  onClose: () => void;
}) {
  const [step, setStep] = useState<Step>("ask_personal");
  const [excludeInput, setExcludeInput] = useState("");
  const [excludedPhones, setExcludedPhones] = useState<string[]>([]);
  const [personalContacts, setPersonalContacts] = useState<PersonalContact[]>([]);
  const [removedJids, setRemovedJids] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<{ imported: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function addExcludePhone() {
    const cleaned = excludeInput.replace(/\D/g, "");
    if (cleaned && !excludedPhones.includes(cleaned)) {
      setExcludedPhones((prev) => [...prev, cleaned]);
    }
    setExcludeInput("");
  }

  async function runImport(mode: "auto" | "ai_classify" | "manual_exclude") {
    setError(null);
    if (mode === "ai_classify") setStep("classifying");
    else setStep("importing");

    try {
      const res = await fetch("/app/api/integrations/whatsapp/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instanceName,
          mode,
          excludedPhones: mode === "manual_exclude" ? excludedPhones : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Error al importar.");
        setStep("ask_personal");
        return;
      }

      if (mode === "ai_classify" && data.personalContacts?.length > 0) {
        setPersonalContacts(data.personalContacts);
        setStep("review_personal");
        return;
      }

      setResult({ imported: data.imported, total: data.total });
      setStep("done");
    } catch {
      setError("Error de red. Intentá de nuevo.");
      setStep("ask_personal");
    }
  }

  async function confirmPersonalReview() {
    // Re-import excluding the ones the vendor confirmed as personal
    const confirmed = personalContacts
      .filter((c) => !removedJids.has(c.jid))
      .map((c) => c.jid.replace("@s.whatsapp.net", "").replace("@c.us", ""));

    setStep("importing");
    setError(null);

    try {
      const res = await fetch("/app/api/integrations/whatsapp/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instanceName,
          mode: "manual_exclude",
          excludedPhones: confirmed,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error al importar.");
        setStep("review_personal");
        return;
      }

      setResult({ imported: data.imported, total: data.total });
      setStep("done");
    } catch {
      setError("Error de red.");
      setStep("review_personal");
    }
  }

  function togglePersonal(jid: string) {
    setRemovedJids((prev) => {
      const next = new Set(prev);
      if (next.has(jid)) next.delete(jid);
      else next.add(jid);
      return next;
    });
  }

  const title = {
    ask_personal: "Configurar contactos",
    ask_classify: "Identificar contactos personales",
    manual_exclude: "Excluir contactos personales",
    classifying: "Analizando conversaciones...",
    review_personal: "Revisar detección",
    importing: "Importando contactos...",
    done: "¡Listo!",
  }[step];

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md rounded-[28px] border border-white/10 bg-card/95 p-0 shadow-panel backdrop-blur">
        <DialogHeader className="px-6 pt-6">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <MessageCircleMore className="h-5 w-5" />
          </div>
          <DialogTitle>{title}</DialogTitle>
          {error ? (
            <DialogDescription className="text-destructive">{error}</DialogDescription>
          ) : null}
        </DialogHeader>

        {/* STEP: ask_personal */}
        {step === "ask_personal" && (
          <>
            <div className="px-6 py-4">
              <p className="text-sm text-muted-foreground">
                Vamos a importar tus últimos 50 contactos de WhatsApp al CRM.
                <br /><br />
                ¿Tenés contactos <strong>personales</strong> (amigos, familia) en tu teléfono que no querés incluir?
              </p>
            </div>
            <DialogFooter className="flex-col gap-2 rounded-b-[28px] px-6 pb-6">
              <Button onClick={() => setStep("ask_classify")} className="w-full">
                <User className="mr-2 h-4 w-4" />
                Sí, tengo contactos personales
              </Button>
              <Button variant="outline" className="w-full" onClick={() => runImport("auto")}>
                <Users className="mr-2 h-4 w-4" />
                No, importar todos
              </Button>
            </DialogFooter>
          </>
        )}

        {/* STEP: ask_classify */}
        {step === "ask_classify" && (
          <>
            <div className="px-6 py-4">
              <p className="text-sm text-muted-foreground">
                ¿Querés que Dilbert los identifique <strong>automáticamente</strong> leyendo los primeros mensajes de cada chat?
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Solo lee texto para clasificar — nunca guarda el contenido de las conversaciones.
              </p>
            </div>
            <DialogFooter className="flex-col gap-2 rounded-b-[28px] px-6 pb-6">
              <Button onClick={() => runImport("ai_classify")} className="w-full">
                Sí, identificalos automáticamente
              </Button>
              <Button variant="outline" className="w-full" onClick={() => setStep("manual_exclude")}>
                No, los cargo yo manualmente
              </Button>
            </DialogFooter>
          </>
        )}

        {/* STEP: manual_exclude */}
        {step === "manual_exclude" && (
          <>
            <div className="space-y-4 px-6 py-4">
              <p className="text-sm text-muted-foreground">
                Ingresá los números que <strong>no</strong> querés importar al CRM.
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="+54 11 XXXX XXXX"
                  value={excludeInput}
                  onChange={(e) => setExcludeInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addExcludePhone(); } }}
                />
                <Button type="button" variant="outline" onClick={addExcludePhone}>
                  Agregar
                </Button>
              </div>
              {excludedPhones.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {excludedPhones.map((p) => (
                    <Badge
                      key={p}
                      className="cursor-pointer border-white/10 bg-background/50"
                      onClick={() => setExcludedPhones((prev) => prev.filter((x) => x !== p))}
                    >
                      +{p} <X className="ml-1 h-3 w-3" />
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <DialogFooter className="flex-col gap-2 rounded-b-[28px] px-6 pb-6">
              <Button className="w-full" onClick={() => runImport("manual_exclude")}>
                Importar el resto
              </Button>
              <Button variant="outline" className="w-full" onClick={() => setStep("ask_classify")}>
                Volver
              </Button>
            </DialogFooter>
          </>
        )}

        {/* STEP: classifying / importing */}
        {(step === "classifying" || step === "importing") && (
          <div className="flex flex-col items-center gap-4 px-6 py-10">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              {step === "classifying"
                ? "Dilbert está leyendo tus conversaciones para identificar contactos personales..."
                : "Importando contactos al CRM..."}
            </p>
          </div>
        )}

        {/* STEP: review_personal */}
        {step === "review_personal" && (
          <>
            <div className="space-y-3 px-6 py-4">
              <p className="text-sm text-muted-foreground">
                Detectamos estos contactos como <strong>personales</strong>. Destildá los que sí querés incluir en el CRM.
              </p>
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {personalContacts.map((c) => {
                  const isExcluded = !removedJids.has(c.jid);
                  return (
                    <div
                      key={c.jid}
                      className={`flex cursor-pointer items-center justify-between rounded-2xl border px-4 py-3 text-sm transition-colors ${
                        isExcluded
                          ? "border-white/10 bg-background/50"
                          : "border-primary/20 bg-primary/5"
                      }`}
                      onClick={() => togglePersonal(c.jid)}
                    >
                      <span className="font-medium">{c.name}</span>
                      <Badge className={isExcluded ? "border-white/10 bg-white/5 text-muted-foreground" : "border-primary/20 bg-primary/10 text-primary"}>
                        {isExcluded ? "Excluir" : "Incluir"}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>
            <DialogFooter className="rounded-b-[28px] px-6 pb-6">
              <Button className="w-full" onClick={confirmPersonalReview}>
                Confirmar e importar
              </Button>
            </DialogFooter>
          </>
        )}

        {/* STEP: done */}
        {step === "done" && result && (
          <>
            <div className="flex flex-col items-center gap-4 px-6 py-8">
              <CheckCircle2 className="h-14 w-14 text-emerald-400" />
              <div className="text-center">
                <p className="text-lg font-semibold">
                  {result.imported} contactos importados
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  De {result.total} chats de WhatsApp. Los nuevos mensajes se irán cargando solos.
                </p>
              </div>
            </div>
            <DialogFooter className="rounded-b-[28px] px-6 pb-6">
              <Button className="w-full" onClick={onClose}>
                Ir al CRM
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
