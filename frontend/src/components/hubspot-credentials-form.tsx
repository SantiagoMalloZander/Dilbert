"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function HubSpotCredentialsForm({ isConfigured }: { isConfigured: boolean }) {
  const [showToken, setShowToken] = useState(false);
  const [saved, setSaved] = useState(false);

  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // In production this would POST to an API route that stores the key server-side
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <Card className={isConfigured ? "border-green-200 dark:border-green-900" : ""}>
      <CardHeader>
        <CardTitle className="text-base">Credenciales de conexión</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-4">
          {/* Private App Token */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="hs-token">
              Private App Token
            </label>
            <div className="relative">
              <input
                id="hs-token"
                type={showToken ? "text" : "password"}
                defaultValue={isConfigured ? "••••••••-••••-••••-••••-••••••••••••" : ""}
                placeholder="pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                className="w-full rounded-lg border bg-background px-3 py-2 pr-20 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
              >
                {showToken ? "Ocultar" : "Mostrar"}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Generalo en HubSpot → Settings → Integrations → Private Apps → Create a private app
            </p>
          </div>

          {/* Portal ID */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="hs-portal">
              Portal ID
            </label>
            <input
              id="hs-portal"
              type="text"
              defaultValue={isConfigured ? "51270113" : ""}
              placeholder="12345678"
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="text-xs text-muted-foreground">
              Lo encontrás en la URL de tu HubSpot: app.hubspot.com/contacts/
              <span className="font-semibold">PORTAL_ID</span>
            </p>
          </div>

          {/* Pipeline ID (optional) */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="hs-pipeline">
              Pipeline ID{" "}
              <span className="text-muted-foreground font-normal">(opcional)</span>
            </label>
            <input
              id="hs-pipeline"
              type="text"
              placeholder="default"
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="text-xs text-muted-foreground">
              Si tenés múltiples pipelines en HubSpot, elegí a cuál van los deals de Dilbert.
              Dejá vacío para usar el default.
            </p>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <Button type="submit" size="sm">
              {saved ? "✓ Guardado" : isConfigured ? "Actualizar credenciales" : "Guardar y conectar"}
            </Button>
            {isConfigured && (
              <span className="flex items-center gap-1.5 text-sm text-green-600">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                Conexión activa
              </span>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
