"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Bot,
  Check,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Phone,
  Power,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { emitGlobalToast } from "@/lib/global-toast";
import { saveBotConfig, disconnectBot } from "@/modules/agency/bot/actions";
import type { BotConfig } from "@/modules/agency/bot/queries";

const VIDEO_URL = "https://www.youtube.com/watch?v=c9zeoBjBjXg";
const YCLOUD_URL = "https://www.ycloud.com/";

const STEPS = [
  {
    title: "Conseguí un número nuevo y dedicado",
    body: "Tiene que ser un número de teléfono nuevo, exclusivo para el bot. No puede estar usado en WhatsApp normal ni en WhatsApp Business, ni en ningún otro lado. Si el número ya tiene WhatsApp, primero hay que borrar esa cuenta.",
  },
  {
    title: "Creá tu cuenta en YCloud y conectá el WhatsApp",
    body: "Entrá a YCloud, creá una cuenta y agregá un canal de WhatsApp con tu número nuevo. YCloud te va a guiar para conectar el número a la API de WhatsApp.",
  },
  {
    title: "Verificá el número en Meta",
    body: "Desde YCloud vas a pedir el código de verificación: te llega por SMS o llamada a ese número. Lo cargás y Meta valida la línea. Cuando el número queda en verde / verificado, está listo.",
  },
  {
    title: "Cargá los datos acá",
    body: "Copiá de YCloud tu API Key y el número de WhatsApp ya verificado, y pegalos abajo. Con eso queda conectado.",
  },
];

export function BotPlaceholder({ config }: { config: BotConfig }) {
  const router = useRouter();
  const [apiKey, setApiKey] = useState("");
  const [phone, setPhone] = useState(config.phoneNumber || "");
  const [busy, setBusy] = useState<"save" | "off" | null>(null);

  async function save() {
    if (!apiKey.trim() || phone.replace(/\D/g, "").length < 8) {
      emitGlobalToast({ tone: "error", text: "Completá la API Key y el número de WhatsApp." });
      return;
    }
    setBusy("save");
    try {
      const result = await saveBotConfig({ apiKey, phoneNumber: phone });
      if (!result.ok) {
        const messages = {
          invalid_key: "La API Key no es válida. Copiala de nuevo desde YCloud.",
          phone_not_found:
            "Ese número no figura en tu cuenta de YCloud. Revisá que sea el número del canal de WhatsApp.",
          webhook_failed:
            "Validé tu cuenta pero no pude activar la recepción de mensajes. Probá de nuevo en unos segundos.",
          unknown: "No pude conectar con YCloud. Probá de nuevo en unos segundos.",
        } as const;
        emitGlobalToast({ tone: "error", text: messages[result.error] });
        return;
      }
      setApiKey("");
      emitGlobalToast({
        tone: "success",
        text: "¡Listo! El bot quedó conectado: las conversaciones van a entrar solas al CRM.",
      });
      router.refresh();
    } catch {
      emitGlobalToast({ tone: "error", text: "No pude guardar los datos. Revisá e intentá de nuevo." });
    } finally {
      setBusy(null);
    }
  }

  async function turnOff() {
    if (!window.confirm("Vas a desconectar el bot de WhatsApp. ¿Seguro?")) return;
    setBusy("off");
    try {
      await disconnectBot();
      setPhone("");
      emitGlobalToast({ tone: "success", text: "Bot desconectado." });
      router.refresh();
    } catch {
      emitGlobalToast({ tone: "error", text: "No pude desconectar. Probá de nuevo." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <Card className="bg-card/90">
        <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-primary/10 p-3 text-primary">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Bot de WhatsApp</h2>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                Conectá un número de WhatsApp para que el bot atienda y clasifique los
                contactos que entran. Se conecta a través de <strong>YCloud</strong>.
              </p>
            </div>
          </div>
          {config.configured ? (
            <Badge className="border-emerald-400/40 bg-emerald-500/10 text-emerald-700">
              <CheckCircle2 className="mr-1 h-3 w-3" />
              Conectado
            </Badge>
          ) : (
            <Badge variant="secondary">Sin conectar</Badge>
          )}
        </CardContent>
      </Card>

      {/* Connected state */}
      {config.configured ? (
        <Card className="bg-card/90">
          <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3 text-sm">
              <Phone className="h-4 w-4 text-emerald-600" />
              <div>
                <p className="font-medium text-foreground">
                  Número conectado {config.phoneNumber ? `+${config.phoneNumber.replace(/^\+/, "")}` : ""}
                </p>
                <p className="text-xs text-muted-foreground">El bot ya puede recibir conversaciones.</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={turnOff} disabled={busy !== null}>
              {busy === "off" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Power className="mr-2 h-4 w-4" />}
              Desconectar
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {/* Number warning */}
      <Card className="border-amber-400/40 bg-amber-50">
        <CardContent className="flex items-start gap-3 pt-6">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div className="text-sm">
            <p className="font-semibold text-amber-800">Usá un número nuevo y exclusivo</p>
            <p className="mt-1 text-amber-800/80">
              El número del bot tiene que ser <strong>nuevo y dedicado solo a esto</strong>. No puede
              estar usado en WhatsApp normal ni en WhatsApp Business, ni en tu teléfono personal.
              Si ese número ya tiene WhatsApp, no va a poder conectarse.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Tutorial steps */}
      <Card className="bg-card/90">
        <CardContent className="space-y-4 pt-6">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold text-foreground">Cómo conectarlo, paso a paso</h3>
            <a
              href={VIDEO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              Ver el video <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>

          <ol className="space-y-3">
            {STEPS.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-medium text-foreground">{step.title}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>

          <a
            href={YCLOUD_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            Abrir YCloud <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </CardContent>
      </Card>

      {/* Load data form */}
      <Card className="bg-card/90">
        <CardContent className="space-y-4 pt-6">
          <div>
            <h3 className="font-semibold text-foreground">Cargá los datos de YCloud</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Cuando el número ya esté verificado en Meta, pegá acá tu API Key y el número.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ycloud-key">API Key de YCloud</Label>
              <Input
                id="ycloud-key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={config.configured ? "•••••••• (ya cargada — pegá una nueva para cambiar)" : "Pegá tu API Key"}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ycloud-phone">Número de WhatsApp</Label>
              <Input
                id="ycloud-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Ej: +54 9 11 2345 6789"
              />
            </div>
          </div>

          <Button onClick={save} disabled={busy !== null}>
            {busy === "save" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
            {config.configured ? "Guardar cambios" : "Conectar bot"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
