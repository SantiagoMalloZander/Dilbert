"use client";

import { startTransition, useMemo, useState } from "react";
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
  whatsapp: MessageCircleMore,
  whatsapp_personal: PhoneCall,
  gmail: Mail,
  instagram: Send,
  meet: Video,
  zoom: Clapperboard,
  teams: MessagesSquare,
} as const;

type FlashMessage = {
  tone: "success" | "error";
  text: string;
} | null;

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

  const selectedDefinition = useMemo(
    () =>
      selectedChannelType
        ? INTEGRATION_DEFINITIONS.find(
            (channel) => channel.channelType === selectedChannelType
          ) || null
        : null,
    [selectedChannelType]
  );

  function openConnectDialog(channelType: IntegrationChannelType) {
    const definition =
      INTEGRATION_DEFINITIONS.find((channel) => channel.channelType === channelType) || null;

    setSelectedChannelType(channelType);
    setFormValues(
      Object.fromEntries((definition?.fields || []).map((field) => [field.key, ""]))
    );
    setFlashMessage(null);
  }

  async function handleDisconnect(channelType: IntegrationChannelType) {
    setFlashMessage(null);
    setActionKey(`disconnect:${channelType}`);

    try {
      const response = await fetch(INTEGRATIONS_API, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          channelType,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setFlashMessage({
          tone: "error",
          text: data.error || "No pude desconectar el canal.",
        });
        return;
      }

      setFlashMessage({
        tone: "success",
        text: "Canal desconectado.",
      });
      startTransition(() => router.refresh());
    } catch {
      emitGlobalToast({
        tone: "error",
        text: "Falló la conexión de red. Probá de nuevo en unos segundos.",
      });
      setFlashMessage({
        tone: "error",
        text: "No pude desconectar el canal.",
      });
    } finally {
      setActionKey(null);
    }
  }

  async function handleConnectSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedDefinition) {
      return;
    }

    setFlashMessage(null);
    setActionKey(`connect:${selectedDefinition.channelType}`);

    try {
      const response = await fetch(INTEGRATIONS_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(vendorChannels || []).map((channel) => (
            <VendorChannelCard
              key={channel.channelType}
              channel={channel}
              onConnect={openConnectDialog}
              onDisconnect={handleDisconnect}
              actionKey={actionKey}
            />
          ))}
        </div>
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

      <Dialog
        open={Boolean(selectedDefinition)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedChannelType(null);
          }
        }}
      >
        <DialogContent className="max-w-lg rounded-[28px] border border-white/10 bg-card/95 p-0 shadow-panel backdrop-blur">
          {selectedDefinition ? (
            <form onSubmit={handleConnectSubmit}>
              <DialogHeader className="px-6 pt-6">
                <DialogTitle>Conectar {selectedDefinition.name}</DialogTitle>
                <DialogDescription>
                  Este formulario es placeholder. Guardamos la configuración en estado pendiente
                  para implementar la verificación real después.
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
                  Guardar y marcar pendiente
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
