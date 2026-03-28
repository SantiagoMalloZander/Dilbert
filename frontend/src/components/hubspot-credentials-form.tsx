"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function HubSpotCredentialsForm({ isConfigured }: { isConfigured: boolean }) {
  const [showToken, setShowToken] = useState(false);
  const [saved, setSaved] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ synced?: number; errors?: string[] } | null>(null);

  function handleSave(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/hubspot/sync", { method: "POST" });
      const data = await res.json();
      setSyncResult(data);
    } catch {
      setSyncResult({ errors: ["Error de conexión al servidor"] });
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className={isConfigured ? "border-green-200 dark:border-green-900" : ""}>
        <CardHeader>
          <CardTitle className="text-base">Credenciales de conexión</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="hs-token">
                Private App Token
              </label>
              <div className="relative">
                <input
                  id="hs-token"
                  type={showToken ? "text" : "password"}
                  defaultValue={isConfigured ? "pat-na1-••••••••-••••-••••-••••-••••••••••••" : ""}
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
                HubSpot → Settings → Integrations → Private Apps
              </p>
            </div>

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
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="hs-pipeline">
                Pipeline ID{" "}
                <span className="text-muted-foreground font-normal">(opcional)</span>
              </label>
              <input
                id="hs-pipeline"
                type="text"
                defaultValue={isConfigured ? "default" : ""}
                placeholder="default"
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="flex items-center gap-3 pt-1">
              <Button type="submit" size="sm" variant="outline">
                {saved ? "✓ Guardado" : "Actualizar credenciales"}
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

      {/* Sync card */}
      {isConfigured && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sincronizar leads → HubSpot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Manda todos los leads del CRM a HubSpot como Contactos + Deals. Si ya existen, los actualiza.
            </p>

            <Button onClick={handleSync} disabled={syncing} className="w-full sm:w-auto">
              {syncing ? "Sincronizando..." : "🔄 Sincronizar ahora"}
            </Button>

            {syncResult && (
              <div className={`rounded-lg border p-4 text-sm ${syncResult.errors?.length ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50"}`}>
                {syncResult.synced !== undefined && (
                  <p className="font-medium text-green-700">
                    ✓ {syncResult.synced} lead{syncResult.synced !== 1 ? "s" : ""} sincronizado{syncResult.synced !== 1 ? "s" : ""} en HubSpot
                  </p>
                )}
                {syncResult.errors && syncResult.errors.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {syncResult.errors.map((err, i) => (
                      <p key={i} className="text-red-600 text-xs">{err}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
