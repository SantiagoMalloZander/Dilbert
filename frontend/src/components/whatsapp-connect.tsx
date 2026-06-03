"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Power, QrCode, RefreshCw, Smartphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { emitGlobalToast } from "@/lib/global-toast";
import {
  connectWhatsApp,
  disconnectWhatsApp,
  getWhatsAppStatus,
} from "@/modules/whatsapp/actions";
import type { WhatsAppConnection } from "@/modules/whatsapp/queries";

type View = "disconnected" | "qr" | "connected";

function formatPhone(phone: string | null) {
  if (!phone) return "";
  return `+${phone}`;
}

export function WhatsAppConnect({ initial }: { initial: WhatsAppConnection | null }) {
  const router = useRouter();
  const [view, setView] = useState<View>(
    initial?.status === "connected" ? "connected" : "disconnected"
  );
  const [qr, setQr] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(initial?.phone ?? null);
  const [busy, setBusy] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const startPolling = useCallback(() => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const { state, phone: connectedPhone } = await getWhatsAppStatus();
        if (state === "open") {
          stopPolling();
          setPhone(connectedPhone);
          setQr(null);
          setView("connected");
          emitGlobalToast({ tone: "success", text: "WhatsApp conectado. Ya leo tus conversaciones." });
          router.refresh();
        }
      } catch {
        // transient; keep polling
      }
    }, 3000);
  }, [router, stopPolling]);

  async function handleConnect() {
    setBusy(true);
    try {
      const payload = await connectWhatsApp();
      setQr(payload.base64);
      setView("qr");
      startPolling();
    } catch {
      emitGlobalToast({ tone: "error", text: "No pude generar el QR. Probá de nuevo en unos segundos." });
    } finally {
      setBusy(false);
    }
  }

  async function handleDisconnect() {
    if (!window.confirm("Vas a desconectar tu WhatsApp. Dilbert deja de leer tus conversaciones.")) {
      return;
    }
    setBusy(true);
    stopPolling();
    try {
      await disconnectWhatsApp();
      setView("disconnected");
      setQr(null);
      setPhone(null);
      router.refresh();
    } catch {
      emitGlobalToast({ tone: "error", text: "No pude desconectar. Probá de nuevo." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="bg-card/90">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-[#25D366]/10 p-3 text-[#1faa52]">
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Tu WhatsApp</h2>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                Conectá tu WhatsApp y Dilbert lee tus conversaciones con clientes para
                armar y actualizar las fichas solo. Sirve para WhatsApp normal y Business.
              </p>
            </div>
          </div>
          {view === "connected" ? (
            <Badge className="border-emerald-400/40 bg-emerald-500/10 text-emerald-700">
              <CheckCircle2 className="mr-1 h-3 w-3" />
              Conectado
            </Badge>
          ) : (
            <Badge variant="secondary">Desconectado</Badge>
          )}
        </div>

        {view === "connected" && (
          <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-white/10 bg-background/60 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm">
              <p className="font-medium text-foreground">
                Línea conectada {phone ? formatPhone(phone) : ""}
              </p>
              <p className="text-xs text-muted-foreground">
                Las conversaciones nuevas se procesan automáticamente.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={handleDisconnect} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Power className="mr-2 h-4 w-4" />}
              Desconectar
            </Button>
          </div>
        )}

        {view === "qr" && (
          <div className="mt-5 flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-background/60 p-5">
            {qr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qr} alt="Código QR de WhatsApp" className="h-56 w-56 rounded-xl bg-white p-2" />
            ) : (
              <div className="flex h-56 w-56 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}
            <ol className="w-full max-w-sm space-y-1 text-xs text-muted-foreground">
              <li>1. Abrí WhatsApp en tu teléfono.</li>
              <li>2. Andá a Ajustes → Dispositivos vinculados → Vincular dispositivo.</li>
              <li>3. Escaneá este código. Esperá unos segundos.</li>
            </ol>
            <Button variant="ghost" size="sm" onClick={handleConnect} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Generar un QR nuevo
            </Button>
          </div>
        )}

        {view === "disconnected" && (
          <div className="mt-5">
            <Button onClick={handleConnect} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <QrCode className="mr-2 h-4 w-4" />}
              Conectar WhatsApp
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
