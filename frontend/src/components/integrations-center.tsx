"use client";

import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { WhatsAppOnboardingDialog } from "@/components/whatsapp-onboarding-dialog";
import { FathomSetupDialog } from "@/components/fathom-setup-dialog";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  CircleOff,
  Clapperboard,
  Loader2,
  Mail,
  MessageCircleMore,
  MessagesSquare,
  PhoneCall,
  PlugZap,
  Send,
  Unplug,
  Video,
} from "lucide-react";
import type {
  IntegrationChannelType,
  OwnerVendorRecord,
  VendorIntegrationRecord,
} from "@/lib/workspace-integrations";
import { INTEGRATION_DEFINITIONS } from "@/lib/workspace-integrations";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { emitGlobalToast } from "@/lib/global-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

const INTEGRATIONS_API = "/app/api/integrations";
const CHANNEL_ICONS = {
  whatsapp_business: MessageCircleMore,
  whatsapp_personal: PhoneCall,
  gmail: Mail,
  instagram: Send,
  fathom: Video,
  zoom: Clapperboard,
  teams: MessagesSquare,
} as const;

const WEBHOOK_INSTRUCTIONS: Partial<Record<string, string>> = {
  fathom: "https://dilvert.netlify.app/app/api/webhooks/fathom",
};

type FlashMessage = {
  tone: "success" | "error";
  text: string;
} | null;

type WhatsAppQrState = {
  channelType: "whatsapp_business" | "whatsapp_personal";
  step: "loading" | "qr" | "connected" | "error";
  instanceName: string | null;
  qrCode: string | null;
  errorMessage: string | null;
};

function getInitials(name: string, email: string) {
  const source = name || email;
  return source
    .split(" ")
    .map((segment) => segment[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatDate(dateString: string) {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(dateString));
}

function getStatusBadge(status: VendorIntegrationRecord["status"] | "pending" | "connected") {
  switch (status) {
    case "connected":
      return {
        label: "Conectado",
        className: "border-emerald-500/20 bg-emerald-500/10 text-emerald-200",
      };
    case "pending":
      return {
        label: "Conectado (pendiente)",
        className: "border-amber-500/20 bg-amber-500/10 text-amber-200",
      };
    default:
      return {
        label: "Desconectado",
        className: "border-white/10 bg-white/5 text-muted-foreground",
      };
  }
}

function VendorChannelCard({
  channel,
  onConnect,
  onDisconnect,
  actionKey,
}: {
  channel: VendorIntegrationRecord;
  onConnect: (channelType: IntegrationChannelType) => void;
  onDisconnect: (channelType: IntegrationChannelType) => void;
  actionKey: string | null;
}) {
  const Icon = CHANNEL_ICONS[channel.channelType] ?? PlugZap;
  const badge = getStatusBadge(channel.status);
  const isDisconnecting = actionKey === `disconnect:${channel.channelType}`;

  return (
    <Card className="bg-card/90">
      <CardHeader>
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/12 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <Badge className={badge.className}>{badge.label}</Badge>
        </div>
        <CardTitle className="text-lg">{channel.name}</CardTitle>
        <CardDescription>{channel.subtitle}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {channel.connectedAt
            ? `Última actualización: ${formatDate(channel.connectedAt)}`
            : "Todavía no configuraste este canal."}
        </p>

        {channel.status === "disconnected" ? (
          <Button onClick={() => onConnect(channel.channelType)}>
            <PlugZap className="mr-2 h-4 w-4" />
            Conectar
          </Button>
        ) : (
          <Button
            variant="outline"
            onClick={() => onDisconnect(channel.channelType)}
            disabled={isDisconnecting}
          >
            {isDisconnecting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Unplug className="mr-2 h-4 w-4" />
            )}
            Desconectar
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function OwnerVendorCard({ vendor }: { vendor: OwnerVendorRecord }) {
  return (
    <Card className="bg-card/90">
      <CardHeader>
        <div className="flex items-center gap-3">
          <Avatar className="h-11 w-11 border border-white/10">
            {vendor.avatarUrl ? (
              <AvatarImage src={vendor.avatarUrl} alt={vendor.name || vendor.email} />
            ) : null}
            <AvatarFallback>{getInitials(vendor.name, vendor.email)}</AvatarFallback>
          </Avatar>
          <div>
            <CardTitle className="text-lg">{vendor.name}</CardTitle>
            <CardDescription>{vendor.email}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {vendor.channels.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {vendor.channels.map((channel) => {
              const badge = getStatusBadge(channel.status);
              return (
                <div
                  key={`${vendor.id}:${channel.channelType}`}
                  className="rounded-2xl border border-white/10 bg-background/50 px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{channel.name}</span>
                    <Badge className={badge.className}>{badge.label}</Badge>
                  </div>
                  {channel.connectedAt ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDate(channel.connectedAt)}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-2xl border border-dashed border-white/10 bg-background/40 px-4 py-5 text-sm text-muted-foreground">
            <CircleOff className="h-4 w-4" />
            Este vendedor todavía no conectó canales.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function WhatsAppQrDialog({
  state,
  onClose,
  onConnected,
}: {
  state: WhatsAppQrState | null;
  onClose: () => void;
  onConnected: () => void;
}) {
  const router = useRouter();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (state?.step !== "qr" || !state.instanceName) return;

    intervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(
          `/app/api/integrations/whatsapp/status?instance=${state.instanceName}&channelType=${state.channelType}`
        );
        if (!res.ok) return;
        const { status } = await res.json();
        if (status === "connected") {
          if (intervalRef.current) clearInterval(intervalRef.current);
          onConnected();
          startTransition(() => router.refresh());
        }
      } catch {
        // ignore network errors during polling
      }
    }, 3000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [state?.step, state?.instanceName, state?.channelType, onConnected, router]);

  const qrSrc =
    state?.qrCode
      ? state.qrCode.startsWith("data:")
        ? state.qrCode
        : `data:image/png;base64,${state.qrCode}`
      : null;

  const title =
    state?.channelType === "whatsapp_business"
      ? "Conectar WhatsApp Business"
      : "Conectar WhatsApp Personal";

  return (
    <Dialog open={Boolean(state)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-sm rounded-[28px] border border-white/10 bg-card/95 p-0 shadow-panel backdrop-blur">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {state?.step === "loading" && "Generando código QR..."}
            {state?.step === "qr" && "Escaneá este código con tu WhatsApp para conectarlo."}
            {state?.step === "connected" && "¡WhatsApp conectado exitosamente!"}
            {state?.step === "error" && (state.errorMessage || "Ocurrió un error.")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 px-6 py-6">
          {state?.step === "loading" && (
            <div className="flex h-48 w-48 items-center justify-center">
              <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
            </div>
          )}

          {state?.step === "qr" && qrSrc && (
            <>
              <img
                src={qrSrc}
                alt="WhatsApp QR Code"
                className="h-56 w-56 rounded-2xl border border-white/10"
              />
              <div className="space-y-1 text-center">
                <p className="text-sm font-medium">Abrí WhatsApp en tu celular</p>
                <p className="text-xs text-muted-foreground">
                  Menú → Dispositivos vinculados → Vincular un dispositivo
                </p>
                <p className="text-xs text-muted-foreground">
                  El QR expira en ~60 segundos
                </p>
              </div>
            </>
          )}

          {state?.step === "connected" && (
            <div className="flex h-48 w-48 flex-col items-center justify-center gap-3">
              <CheckCircle2 className="h-16 w-16 text-emerald-400" />
              <p className="text-sm font-medium text-emerald-300">¡Conectado!</p>
            </div>
          )}

          {state?.step === "error" && (
            <div className="flex h-48 w-48 items-center justify-center">
              <p className="text-center text-sm text-destructive">
                {state.errorMessage || "No se pudo conectar. Intentá de nuevo."}
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="rounded-b-[28px] px-6 pb-6">
          <Button variant="outline" onClick={onClose}>
            {state?.step === "connected" ? "Cerrar" : "Cancelar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function IntegrationsCenter({
  role,
  vendorChannels,
  ownerVendors,
}: {
  role: "owner" | "vendor";
  vendorChannels?: VendorIntegrationRecord[];
  ownerVendors?: OwnerVendorRecord[];
}) {
  const router = useRouter();
  const [flashMessage, setFlashMessage] = useState<FlashMessage>(null);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [selectedChannelType, setSelectedChannelType] =
    useState<IntegrationChannelType | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [whatsappQr, setWhatsappQr] = useState<WhatsAppQrState | null>(null);
  const [onboardingInstance, setOnboardingInstance] = useState<string | null>(null);
  const [fathomOpen, setFathomOpen] = useState(false);

  const selectedDefinition = useMemo(
    () =>
      selectedChannelType
        ? INTEGRATION_DEFINITIONS.find(
            (channel) => channel.channelType === selectedChannelType
          ) || null
        : null,
    [selectedChannelType]
  );

  async function startWhatsAppQrFlow(
    channelType: "whatsapp_business" | "whatsapp_personal"
  ) {
    setWhatsappQr({
      channelType,
      step: "loading",
      instanceName: null,
      qrCode: null,
      errorMessage: null,
    });

    try {
      // Step 1: Create instance (fast, returns instanceName immediately)
      const connectResponse = await fetch("/app/api/integrations/whatsapp/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelType }),
      });

      if (!connectResponse.ok) {
        const data = await connectResponse.json();
        setWhatsappQr((prev) =>
          prev
            ? { ...prev, step: "error", errorMessage: data.error || "No pude crear la instancia." }
            : null
        );
        return;
      }

      const { instanceName } = await connectResponse.json();

      // Step 2: Poll for QR code (instance needs ~3-5s to initialize)
      let qrCode: string | null = null;
      for (let attempt = 0; attempt < 10; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        try {
          const qrResponse = await fetch(
            `/app/api/integrations/whatsapp/qr?instance=${encodeURIComponent(instanceName)}`
          );
          if (qrResponse.ok) {
            const data = await qrResponse.json();
            if (data.qrCode) {
              qrCode = data.qrCode;
              break;
            }
          }
        } catch {
          // retry
        }
      }

      if (!qrCode) {
        setWhatsappQr((prev) =>
          prev
            ? { ...prev, step: "error", errorMessage: "No pude obtener el QR. Intentá de nuevo." }
            : null
        );
        return;
      }

      setWhatsappQr((prev) =>
        prev ? { ...prev, step: "qr", instanceName, qrCode } : null
      );
    } catch {
      setWhatsappQr((prev) =>
        prev
          ? { ...prev, step: "error", errorMessage: "Error de red. Intentá de nuevo." }
          : null
      );
    }
  }

  function openConnectDialog(channelType: IntegrationChannelType) {
    if (channelType === "whatsapp_business" || channelType === "whatsapp_personal") {
      startWhatsAppQrFlow(channelType);
      return;
    }

    if (channelType === "fathom") {
      setFathomOpen(true);
      return;
    }

    const definition =
      INTEGRATION_DEFINITIONS.find((channel) => channel.channelType === channelType) || null;
    setSelectedChannelType(channelType);
    setFormValues(
      Object.fromEntries((definition?.fields || []).map((field) => [field.key, ""]))
    );
    setFlashMessage(null);
  }

  async function handleFathomSave(apiKey: string) {
    const response = await fetch(INTEGRATIONS_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channelType: "fathom",
        credentials: { fathomApiKey: apiKey },
      }),
    });
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Error al guardar.");
    }
  }

  async function handleDisconnect(channelType: IntegrationChannelType) {
    setFlashMessage(null);
    setActionKey(`disconnect:${channelType}`);

    try {
      const response = await fetch(INTEGRATIONS_API, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelType }),
      });
      const data = await response.json();

      if (!response.ok) {
        setFlashMessage({
          tone: "error",
          text: data.error || "No pude desconectar el canal.",
        });
        return;
      }

      setFlashMessage({ tone: "success", text: "Canal desconectado." });
      startTransition(() => router.refresh());
    } catch {
      emitGlobalToast({
        tone: "error",
        text: "Falló la conexión de red. Probá de nuevo en unos segundos.",
      });
      setFlashMessage({ tone: "error", text: "No pude desconectar el canal." });
    } finally {
      setActionKey(null);
    }
  }

  async function handleConnectSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedDefinition) return;

    setFlashMessage(null);
    setActionKey(`connect:${selectedDefinition.channelType}`);

    try {
      const response = await fetch(INTEGRATIONS_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelType: selectedDefinition.channelType,
          credentials: formValues,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setFlashMessage({
          tone: "error",
          text: data.error || "No pude guardar la configuración del canal.",
        });
        return;
      }

      setSelectedChannelType(null);
      setFlashMessage({
        tone: "success",
        text: `${selectedDefinition.name} quedó conectado en estado pendiente.`,
      });
      startTransition(() => router.refresh());
    } catch {
      emitGlobalToast({
        tone: "error",
        text: "Falló la conexión de red. Probá de nuevo en unos segundos.",
      });
      setFlashMessage({
        tone: "error",
        text: "No pude guardar la configuración del canal.",
      });
    } finally {
      setActionKey(null);
    }
  }

  return (
    <div className="space-y-6">
      {flashMessage ? (
        <div
          className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm ${
            flashMessage.tone === "success"
              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
              : "border-destructive/20 bg-destructive/10 text-destructive"
          }`}
        >
          <CheckCircle2 className="h-4 w-4" />
          {flashMessage.text}
        </div>
      ) : null}

      {role === "vendor" ? (
        <>
          {!vendorChannels || vendorChannels.length === 0 ? (
            <Card className="bg-card/90">
              <CardContent className="flex items-center gap-3 px-4 py-10 text-sm text-muted-foreground">
                <CircleOff className="h-4 w-4" />
                No hay canales disponibles para conectar.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {vendorChannels.map((channel) => (
                <VendorChannelCard
                  key={channel.channelType}
                  channel={channel}
                  onConnect={openConnectDialog}
                  onDisconnect={handleDisconnect}
                  actionKey={actionKey}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="space-y-4">
          {(ownerVendors || []).length > 0 ? (
            (ownerVendors || []).map((vendor) => (
              <OwnerVendorCard key={vendor.id} vendor={vendor} />
            ))
          ) : (
            <Card className="bg-card/90">
              <CardContent className="flex items-center gap-3 px-4 py-10 text-sm text-muted-foreground">
                <CircleOff className="h-4 w-4" />
                Tu empresa todavía no tiene vendedores activos para mostrar.
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* WhatsApp QR Dialog */}
      <WhatsAppQrDialog
        state={whatsappQr}
        onClose={() => setWhatsappQr(null)}
        onConnected={() => {
          const instanceName = whatsappQr?.instanceName;
          setWhatsappQr((prev) => (prev ? { ...prev, step: "connected" } : null));
          // After 1.5s close QR dialog and open onboarding
          setTimeout(() => {
            setWhatsappQr(null);
            if (instanceName) setOnboardingInstance(instanceName);
          }, 1500);
        }}
      />

      <WhatsAppOnboardingDialog
        instanceName={onboardingInstance || ""}
        open={Boolean(onboardingInstance)}
        onClose={() => {
          setOnboardingInstance(null);
          startTransition(() => router.refresh());
        }}
      />

      {/* Fathom setup wizard */}
      <FathomSetupDialog
        open={fathomOpen}
        onClose={() => setFathomOpen(false)}
        onSave={handleFathomSave}
      />

      {/* Generic form dialog (for non-WhatsApp channels) */}
      <Dialog
        open={Boolean(selectedDefinition)}
        onOpenChange={(open) => {
          if (!open) setSelectedChannelType(null);
        }}
      >
        <DialogContent className="max-w-lg rounded-[28px] border border-white/10 bg-card/95 p-0 shadow-panel backdrop-blur">
          {selectedDefinition ? (
            <form onSubmit={handleConnectSubmit}>
              <DialogHeader className="px-6 pt-6">
                <DialogTitle>Conectar {selectedDefinition.name}</DialogTitle>
                <DialogDescription>
                  Completá los datos para conectar este canal.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 px-6 py-4">
                {selectedDefinition.fields.map((field) => (
                  <div key={field.key} className="space-y-2">
                    <Label htmlFor={field.key}>{field.label}</Label>
                    <Input
                      id={field.key}
                      value={formValues[field.key] || ""}
                      onChange={(event) =>
                        setFormValues((current) => ({
                          ...current,
                          [field.key]: event.target.value,
                        }))
                      }
                      placeholder={field.placeholder}
                    />
                  </div>
                ))}
                {WEBHOOK_INSTRUCTIONS[selectedDefinition.channelType] ? (
                  <div className="rounded-2xl border border-white/10 bg-background/50 px-4 py-3 text-xs text-muted-foreground">
                    <p className="mb-1 font-medium text-foreground">Paso 2 — Configurá el webhook en Fathom</p>
                    <p className="mb-2">Settings → Webhooks → Add webhook → pegá esta URL:</p>
                    <code className="block break-all rounded bg-black/20 px-2 py-1 font-mono text-primary">
                      {WEBHOOK_INSTRUCTIONS[selectedDefinition.channelType]}
                    </code>
                  </div>
                ) : null}
              </div>

              <DialogFooter className="rounded-b-[28px]">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedChannelType(null)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={actionKey === `connect:${selectedDefinition.channelType}`}
                >
                  {actionKey === `connect:${selectedDefinition.channelType}` ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Guardar
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
