"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Copy, Check, AlertCircle } from "lucide-react";
import {
  createEvolutionInstance,
  getInstanceQrCode,
  getInstanceStatus,
  deleteEvolutionInstance,
} from "@/lib/evolution-api";
import type { EvolutionInstanceStatus } from "@/lib/evolution-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type WhatsAppVariant = "personal" | "business";

interface WhatsAppConnectFlowProps {
  variant: WhatsAppVariant;
  phoneNumber?: string;
  onSuccess: (credentials: Record<string, string>) => void;
  onCancel: () => void;
}

export function WhatsAppConnectFlow({
  variant,
  phoneNumber,
  onSuccess,
  onCancel,
}: WhatsAppConnectFlowProps) {
  const [instanceName, setInstanceName] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [instanceStatus, setInstanceStatus] = useState<EvolutionInstanceStatus>("disconnected");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [businessPhone, setBusinessPhone] = useState(phoneNumber || "");
  const [copiedToClipboard, setCopiedToClipboard] = useState(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize instance for personal WhatsApp
  useEffect(() => {
    if (variant !== "personal") return;

    const initializeInstance = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/whatsapp`;
        const { instanceName: name } = await createEvolutionInstance({
          phoneNumber: "auto",
          isBusinessAccount: false,
          webhookUrl,
        });

        setInstanceName(name);

        // Get initial QR code
        const qr = await getInstanceQrCode(name);
        setQrCode(qr);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Falló al crear la instancia de WhatsApp."
        );
        setIsLoading(false);
      }
    };

    initializeInstance();

    // Cleanup on unmount
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      if (instanceName) {
        deleteEvolutionInstance(instanceName).catch(console.error);
      }
    };
  }, [variant]);

  // Poll for connection status
  useEffect(() => {
    if (variant !== "personal" || !instanceName) return;

    const pollStatus = async () => {
      try {
        const status = await getInstanceStatus(instanceName);
        setInstanceStatus(status);

        if (status === "connected") {
          // Success! Store the instance name as credential
          onSuccess({
            instanceName,
            phoneNumber: businessPhone || "auto",
          });
        }
      } catch (err) {
        console.error("Failed to poll instance status:", err);
      }
    };

    // Start polling immediately
    pollStatus();

    // Poll every 3 seconds
    pollIntervalRef.current = setInterval(pollStatus, 3000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [instanceName, variant, businessPhone, onSuccess]);

  const handleBusinessConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessPhone.trim()) {
      setError("Por favor ingresa un número de teléfono.");
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/whatsapp`;
      const { instanceName: name } = await createEvolutionInstance({
        phoneNumber: businessPhone,
        isBusinessAccount: true,
        webhookUrl,
      });

      // For business accounts, we don't need to poll for QR - we just store the instance
      onSuccess({
        instanceName: name,
        phoneNumber: businessPhone,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Falló al crear la instancia de WhatsApp Business."
      );
      setIsLoading(false);
    }
  };

  const copyQrToClipboard = async () => {
    if (!qrCode) return;
    try {
      await navigator.clipboard.writeText(qrCode);
      setCopiedToClipboard(true);
      setTimeout(() => setCopiedToClipboard(false), 2000);
    } catch (err) {
      console.error("Failed to copy to clipboard:", err);
    }
  };

  if (variant === "personal") {
    return (
      <Card className="bg-card/90">
        <CardHeader>
          <CardTitle className="text-lg">Conectar WhatsApp Personal</CardTitle>
          <CardDescription>Escanea el código QR con tu WhatsApp</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? (
            <div className="flex items-start gap-3 rounded-2xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
              <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <div>{error}</div>
            </div>
          ) : null}

          {isLoading && !qrCode ? (
            <div className="flex h-64 items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Generando código QR...</p>
              </div>
            </div>
          ) : qrCode ? (
            <div className="space-y-4">
              <div className="flex justify-center">
                <img
                  src={`data:image/png;base64,${qrCode}`}
                  alt="WhatsApp QR Code"
                  className="h-64 w-64 border-2 border-white/10 rounded-lg"
                />
              </div>
              <div className="rounded-2xl border border-white/10 bg-background/50 p-4">
                <p className="text-sm text-muted-foreground mb-2">
                  Estado: <span className="font-medium">{instanceStatus}</span>
                </p>
                {instanceStatus === "connected" ? (
                  <p className="text-sm text-emerald-200">✓ ¡Conectado exitosamente!</p>
                ) : instanceStatus === "connecting" ? (
                  <p className="text-sm text-amber-200">Conectando...</p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Abre WhatsApp → Ajustes → Dispositivos vinculados → Escanea este código
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyQrToClipboard}
                  disabled={copiedToClipboard}
                >
                  {copiedToClipboard ? (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="mr-2 h-4 w-4" />
                      Copiar código
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : null}

          {!isLoading && !error ? (
            <Button variant="outline" className="w-full" onClick={onCancel}>
              Cancelar
            </Button>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  // Business variant
  return (
    <Card className="bg-card/90">
      <CardHeader>
        <CardTitle className="text-lg">Conectar WhatsApp Business</CardTitle>
        <CardDescription>Ingresa los detalles de tu cuenta comercial</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleBusinessConnect} className="space-y-4">
          {error ? (
            <div className="flex items-start gap-3 rounded-2xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
              <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <div>{error}</div>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="businessPhone">Número de teléfono comercial</Label>
            <Input
              id="businessPhone"
              type="tel"
              placeholder="+54 11 XXXX XXXX"
              value={businessPhone}
              onChange={(e) => setBusinessPhone(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isLoading}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading} className="flex-1">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Conectando...
                </>
              ) : (
                "Conectar"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
