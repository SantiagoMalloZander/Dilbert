"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Download,
  Globe,
  Loader2,
  Mail,
  MapPin,
  Plus,
  Search,
  Send,
  Square,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { emitGlobalToast } from "@/lib/global-toast";
import { DEFAULT_BODY, DEFAULT_SUBJECT, renderTemplate } from "@/lib/prospecting/template";
import { PROSPECT_REGIONS, PROSPECT_TOWNS } from "@/lib/prospecting/towns";
import type { ProspectRecord, ProspectStatus } from "@/modules/prospecting/queries";

const API = "/app/api/admin/prospecting";
const TEMPLATE_STORAGE_KEY = "dilvert-prospecting-template";
const ENRICH_BATCH = 4;

type PanelConfig = {
  googleEnabled: boolean;
  mailerEnabled: boolean;
  sender: { email: string | null; name: string };
  dailyLimit: number;
  sentToday: number;
};

const STATUS_LABELS: Record<ProspectStatus, string> = {
  new: "Nuevo",
  sent: "Enviado",
  replied: "Respondió",
  bounced: "Rebotó",
  unsubscribed: "Baja",
  discarded: "Descartado",
};

const STATUS_VARIANT: Record<ProspectStatus, "default" | "secondary" | "outline" | "destructive"> = {
  new: "outline",
  sent: "secondary",
  replied: "default",
  bounced: "destructive",
  unsubscribed: "destructive",
  discarded: "outline",
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || "Error inesperado.") as Error & { data?: unknown };
    error.data = data;
    throw error;
  }
  return data as T;
}

function toCsv(prospects: ProspectRecord[]) {
  const header = ["nombre", "localidad", "region", "email", "otros_emails", "telefono", "web", "direccion", "estado"];
  const escape = (value: string | null | undefined) => `"${(value ?? "").replace(/"/g, '""')}"`;
  const rows = prospects.map((p) =>
    [p.name, p.town, p.region, p.email, p.emails.filter((e) => e !== p.email).join(" "), p.phone, p.website, p.address, STATUS_LABELS[p.status]]
      .map(escape)
      .join(",")
  );
  return [header.join(","), ...rows].join("\n");
}

export function ProspectingPanel() {
  const [prospects, setProspects] = useState<ProspectRecord[]>([]);
  const [config, setConfig] = useState<PanelConfig | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Buscador
  const [selectedTowns, setSelectedTowns] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("inmobiliaria");
  const [useGoogle, setUseGoogle] = useState(true);
  const [useOsm, setUseOsm] = useState(true);
  const [searchLog, setSearchLog] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichProgress, setEnrichProgress] = useState<{ done: number; total: number } | null>(null);

  // Prospectos
  const [statusFilter, setStatusFilter] = useState<ProspectStatus | "all">("all");
  const [townFilter, setTownFilter] = useState<string>("all");
  const [onlyWithEmail, setOnlyWithEmail] = useState(false);
  const [textFilter, setTextFilter] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [emailDrafts, setEmailDrafts] = useState<Record<string, string>>({});
  const [manualForm, setManualForm] = useState({ name: "", email: "", town: "", phone: "", website: "" });
  const [isManualOpen, setIsManualOpen] = useState(false);

  // Campaña
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [body, setBody] = useState(DEFAULT_BODY);
  const [delaySeconds, setDelaySeconds] = useState("45");
  const [campaignTowns, setCampaignTowns] = useState<string>("all");
  const [isSending, setIsSending] = useState(false);
  const [sendLog, setSendLog] = useState<string[]>([]);
  const stopRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const data = await api<{ prospects: ProspectRecord[]; config: PanelConfig }>("");
      setProspects(data.prospects);
      setConfig(data.config);
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "No pude cargar los prospectos.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const saved = window.localStorage.getItem(TEMPLATE_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as { subject?: string; body?: string };
        if (parsed.subject) setSubject(parsed.subject);
        if (parsed.body) setBody(parsed.body);
      } catch {
        // plantilla guardada corrupta: usamos la default
      }
    }
  }, [load]);

  useEffect(() => {
    window.localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify({ subject, body }));
  }, [subject, body]);

  function upsertLocal(updated: ProspectRecord[]) {
    const byId = new Map(updated.map((p) => [p.id, p]));
    setProspects((current) => current.map((p) => byId.get(p.id) ?? p));
  }

  // ---------- Buscador ----------

  function toggleTown(name: string) {
    setSelectedTowns((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function toggleRegion(region: string) {
    const towns = PROSPECT_TOWNS.filter((t) => t.region === region).map((t) => t.name);
    const allSelected = towns.every((t) => selectedTowns.has(t));
    setSelectedTowns((current) => {
      const next = new Set(current);
      towns.forEach((t) => (allSelected ? next.delete(t) : next.add(t)));
      return next;
    });
  }

  async function runSearch() {
    const towns = PROSPECT_TOWNS.filter((t) => selectedTowns.has(t.name));
    if (towns.length === 0) {
      emitGlobalToast({ tone: "error", text: "Elegí al menos una localidad." });
      return;
    }

    setIsSearching(true);
    setSearchLog([]);
    let totalInserted = 0;

    for (const town of towns) {
      try {
        const result = await api<{ found: number; inserted: number }>("/search", {
          method: "POST",
          body: JSON.stringify({ town: town.name, query, useGoogle: useGoogle && config?.googleEnabled, useOsm }),
        });
        totalInserted += result.inserted;
        setSearchLog((log) => [...log, `✓ ${town.name}: ${result.found} encontradas, ${result.inserted} nuevas`]);
      } catch (error) {
        setSearchLog((log) => [...log, `✗ ${town.name}: ${error instanceof Error ? error.message : "error"}`]);
      }
    }

    setIsSearching(false);
    emitGlobalToast({ tone: "success", text: `Búsqueda terminada: ${totalInserted} inmobiliarias nuevas.` });
    await load();
  }

  const pendingEnrich = useMemo(
    () => prospects.filter((p) => p.website && !p.enriched_at && !p.email),
    [prospects]
  );

  async function runEnrich() {
    const queue = [...pendingEnrich];
    if (queue.length === 0) return;
    setIsEnriching(true);
    setEnrichProgress({ done: 0, total: queue.length });

    for (let i = 0; i < queue.length; i += ENRICH_BATCH) {
      const batch = queue.slice(i, i + ENRICH_BATCH);
      try {
        const result = await api<{ prospects: ProspectRecord[] }>("/enrich", {
          method: "POST",
          body: JSON.stringify({ ids: batch.map((p) => p.id) }),
        });
        upsertLocal(result.prospects);
      } catch {
        // seguimos con el próximo lote
      }
      setEnrichProgress({ done: Math.min(i + ENRICH_BATCH, queue.length), total: queue.length });
    }

    setIsEnriching(false);
    emitGlobalToast({ tone: "success", text: "Terminé de rastrear las webs." });
  }

  // ---------- Prospectos ----------

  const towns = useMemo(
    () => [...new Set(prospects.map((p) => p.town).filter(Boolean) as string[])].sort(),
    [prospects]
  );

  const filtered = useMemo(() => {
    const text = textFilter.trim().toLowerCase();
    return prospects.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (townFilter !== "all" && p.town !== townFilter) return false;
      if (onlyWithEmail && !p.email) return false;
      if (text && !`${p.name} ${p.email ?? ""} ${p.address ?? ""}`.toLowerCase().includes(text)) return false;
      return true;
    });
  }, [prospects, statusFilter, townFilter, onlyWithEmail, textFilter]);

  const stats = useMemo(
    () => ({
      total: prospects.length,
      withEmail: prospects.filter((p) => p.email).length,
      sent: prospects.filter((p) => p.status === "sent").length,
      replied: prospects.filter((p) => p.status === "replied").length,
    }),
    [prospects]
  );

  async function patchProspect(id: string, patch: { email?: string | null; status?: ProspectStatus }) {
    try {
      const result = await api<{ prospect: ProspectRecord }>(`/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      upsertLocal([result.prospect]);
    } catch (error) {
      emitGlobalToast({ tone: "error", text: error instanceof Error ? error.message : "No pude guardar." });
    }
  }

  async function saveEmailDraft(prospect: ProspectRecord) {
    const draft = emailDrafts[prospect.id];
    if (draft === undefined || draft.trim() === (prospect.email ?? "")) return;
    await patchProspect(prospect.id, { email: draft.trim() || null });
    setEmailDrafts(({ [prospect.id]: _removed, ...rest }) => rest);
  }

  async function deleteSelected() {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`¿Borrar ${selectedIds.size} prospectos?`)) return;
    try {
      await api("", { method: "DELETE", body: JSON.stringify({ ids: [...selectedIds] }) });
      setProspects((current) => current.filter((p) => !selectedIds.has(p.id)));
      setSelectedIds(new Set());
    } catch (error) {
      emitGlobalToast({ tone: "error", text: error instanceof Error ? error.message : "No pude borrar." });
    }
  }

  async function createManual(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const result = await api<{ prospect: ProspectRecord }>("", {
        method: "POST",
        body: JSON.stringify(manualForm),
      });
      setProspects((current) => [result.prospect, ...current]);
      setManualForm({ name: "", email: "", town: "", phone: "", website: "" });
      setIsManualOpen(false);
    } catch (error) {
      emitGlobalToast({ tone: "error", text: error instanceof Error ? error.message : "No pude guardar." });
    }
  }

  function exportCsv() {
    const blob = new Blob([`﻿${toCsv(filtered)}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `inmobiliarias-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  // ---------- Campaña ----------

  const recipients = useMemo(
    () =>
      prospects.filter(
        (p) => p.email && p.status === "new" && (campaignTowns === "all" || p.region === campaignTowns || p.town === campaignTowns)
      ),
    [prospects, campaignTowns]
  );

  const preview = useMemo(() => {
    const sample = recipients[0];
    const vars = { nombre: sample?.name ?? "Inmobiliaria Ejemplo", ciudad: sample?.town ?? "Pinamar" };
    return { subject: renderTemplate(subject, vars), body: renderTemplate(body, vars) };
  }, [recipients, subject, body]);

  async function sendTest() {
    try {
      await api("/send", { method: "POST", body: JSON.stringify({ test: true, subject, body }) });
      emitGlobalToast({ tone: "success", text: "Mandé la prueba a tu casilla." });
    } catch (error) {
      emitGlobalToast({ tone: "error", text: error instanceof Error ? error.message : "Falló la prueba." });
    }
  }

  async function runCampaign() {
    const queue = [...recipients];
    if (queue.length === 0) return;
    if (!window.confirm(`Vas a mandar el mail a ${queue.length} inmobiliarias (de a una, con pausa). ¿Arranco?`)) return;

    const delayMs = Math.max(5, Number(delaySeconds) || 45) * 1000;
    stopRef.current = false;
    setIsSending(true);
    setSendLog([]);
    let sent = 0;

    for (const [index, prospect] of queue.entries()) {
      if (stopRef.current) break;
      try {
        const result = await api<{ status: string; reason?: string; prospect?: ProspectRecord }>("/send", {
          method: "POST",
          body: JSON.stringify({ id: prospect.id, subject, body }),
        });
        if (result.prospect) upsertLocal([result.prospect]);
        if (result.status === "sent") {
          sent += 1;
          setConfig((c) => (c ? { ...c, sentToday: c.sentToday + 1 } : c));
          setSendLog((log) => [...log, `✓ ${prospect.name} <${prospect.email}>`]);
        } else {
          setSendLog((log) => [...log, `– ${prospect.name}: salteado (${result.reason})`]);
          continue; // sin pausa si no se mandó nada
        }
      } catch (error) {
        const data = (error as Error & { data?: { limitReached?: boolean } }).data;
        setSendLog((log) => [...log, `✗ ${prospect.name}: ${error instanceof Error ? error.message : "error"}`]);
        if (data?.limitReached) break;
      }

      if (index < queue.length - 1 && !stopRef.current) {
        // pausa con algo de variación para que no parezca un robot
        await sleep(delayMs * (0.75 + Math.random() * 0.5));
      }
    }

    setIsSending(false);
    emitGlobalToast({ tone: "success", text: `Campaña frenada/terminada: ${sent} mails enviados.` });
  }

  // ---------- Render ----------

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Cargando prospección…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <Link href="/app/admin" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> Volver al panel
          </Link>
          <h2 className="text-3xl font-semibold tracking-tight">Prospección de inmobiliarias</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Buscá inmobiliarias de Provincia de Buenos Aires (sin CABA ni Campana), sacá sus emails de la web y mandales la campaña.
          </p>
        </div>
      </div>

      {loadError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{loadError}</div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ["Inmobiliarias", stats.total],
          ["Con email", stats.withEmail],
          ["Contactadas", stats.sent],
          ["Respondieron", stats.replied],
          ["Enviados hoy", config ? `${config.sentToday}/${config.dailyLimit}` : "—"],
        ].map(([label, value]) => (
          <Card key={label} className="bg-card/90">
            <CardHeader className="pb-3">
              <CardDescription>{label}</CardDescription>
              <CardTitle>{value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="search" className="w-full">
        <TabsList variant="line" className="mb-4">
          <TabsTrigger value="search">Buscador</TabsTrigger>
          <TabsTrigger value="prospects">Inmobiliarias ({prospects.length})</TabsTrigger>
          <TabsTrigger value="campaign">Campaña de mails</TabsTrigger>
        </TabsList>

        {/* ---------------- BUSCADOR ---------------- */}
        <TabsContent value="search" className="space-y-4">
          {!config?.googleEnabled ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
              Google Places no está configurado (falta <code>GOOGLE_PLACES_API_KEY</code>). Por ahora solo se busca en
              OpenStreetMap, que tiene muchas menos inmobiliarias.
            </div>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">1. Elegí dónde buscar</CardTitle>
              <CardDescription className="flex flex-wrap items-center gap-3">
                {selectedTowns.size} de {PROSPECT_TOWNS.length} localidades seleccionadas
                <Button
                  size="xs"
                  variant="secondary"
                  onClick={() =>
                    setSelectedTowns(
                      selectedTowns.size === PROSPECT_TOWNS.length ? new Set() : new Set(PROSPECT_TOWNS.map((t) => t.name))
                    )
                  }
                >
                  {selectedTowns.size === PROSPECT_TOWNS.length ? "Quitar todas" : "Seleccionar todas"}
                </Button>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {PROSPECT_REGIONS.map((region) => {
                const regionTowns = PROSPECT_TOWNS.filter((t) => t.region === region);
                const allSelected = regionTowns.every((t) => selectedTowns.has(t.name));
                return (
                  <div key={region} className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-semibold">
                      <Checkbox checked={allSelected} onCheckedChange={() => toggleRegion(region)} />
                      {region}
                    </label>
                    <div className="flex flex-wrap gap-2 pl-6">
                      {regionTowns.map((town) => (
                        <button
                          key={town.name}
                          type="button"
                          onClick={() => toggleTown(town.name)}
                          className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                            selectedTowns.has(town.name)
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border hover:bg-muted"
                          }`}
                        >
                          {town.name}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}

              <div className="grid gap-4 border-t pt-4 md:grid-cols-[1fr_auto_auto] md:items-end">
                <div className="space-y-1.5">
                  <Label htmlFor="query">Qué buscar</Label>
                  <Input id="query" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="inmobiliaria" />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={useGoogle && Boolean(config?.googleEnabled)} disabled={!config?.googleEnabled} onCheckedChange={setUseGoogle} />
                  Google Maps
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={useOsm} onCheckedChange={setUseOsm} />
                  OpenStreetMap
                </label>
              </div>

              <Button onClick={runSearch} disabled={isSearching || selectedTowns.size === 0}>
                {isSearching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                Buscar inmobiliarias
              </Button>

              {searchLog.length > 0 ? (
                <div className="max-h-56 overflow-y-auto rounded-lg bg-muted/50 p-3 font-mono text-xs">
                  {searchLog.map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">2. Sacar emails de sus webs</CardTitle>
              <CardDescription>
                Google no da el email: entro a la web de cada inmobiliaria (home y página de contacto) y lo busco.{" "}
                {pendingEnrich.length} webs pendientes de rastrear.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button onClick={runEnrich} disabled={isEnriching || pendingEnrich.length === 0} variant="secondary">
                {isEnriching ? <Loader2 className="size-4 animate-spin" /> : <Globe className="size-4" />}
                Buscar emails en {pendingEnrich.length} webs
              </Button>
              {enrichProgress ? (
                <p className="text-sm text-muted-foreground">
                  {enrichProgress.done}/{enrichProgress.total} webs revisadas
                </p>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------------- PROSPECTOS ---------------- */}
        <TabsContent value="prospects" className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {(["all", "new", "sent", "replied", "unsubscribed", "discarded"] as const).map((status) => (
              <Button
                key={status}
                size="sm"
                variant={statusFilter === status ? "default" : "secondary"}
                onClick={() => setStatusFilter(status)}
              >
                {status === "all" ? "Todos" : STATUS_LABELS[status]}
              </Button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Input className="max-w-xs" placeholder="Buscar por nombre o email…" value={textFilter} onChange={(e) => setTextFilter(e.target.value)} />
            <div className="flex flex-wrap gap-1">
              <Button size="xs" variant={townFilter === "all" ? "default" : "secondary"} onClick={() => setTownFilter("all")}>
                Todas las localidades
              </Button>
              {towns.map((town) => (
                <Button key={town} size="xs" variant={townFilter === town ? "default" : "secondary"} onClick={() => setTownFilter(town)}>
                  {town}
                </Button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={onlyWithEmail} onCheckedChange={setOnlyWithEmail} /> Solo con email
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setIsManualOpen((v) => !v)}>
              <Plus className="size-4" /> Agregar a mano
            </Button>
            <Button size="sm" variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
              <Download className="size-4" /> Exportar CSV ({filtered.length})
            </Button>
            <Button size="sm" variant="destructive" onClick={deleteSelected} disabled={selectedIds.size === 0}>
              <Trash2 className="size-4" /> Borrar ({selectedIds.size})
            </Button>
          </div>

          {isManualOpen ? (
            <Card>
              <CardContent className="pt-6">
                <form onSubmit={createManual} className="grid gap-3 md:grid-cols-5 md:items-end">
                  {(
                    [
                      ["name", "Nombre"],
                      ["email", "Email"],
                      ["town", "Localidad"],
                      ["phone", "Teléfono"],
                      ["website", "Web"],
                    ] as const
                  ).map(([field, label]) => (
                    <div key={field} className="space-y-1.5">
                      <Label htmlFor={`manual-${field}`}>{label}</Label>
                      <Input
                        id={`manual-${field}`}
                        value={manualForm[field]}
                        onChange={(e) => setManualForm((f) => ({ ...f, [field]: e.target.value }))}
                      />
                    </div>
                  ))}
                  <Button type="submit" className="md:col-span-5 md:w-fit">Guardar</Button>
                </form>
              </CardContent>
            </Card>
          ) : null}

          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-3">
                    <Checkbox
                      checked={filtered.length > 0 && filtered.every((p) => selectedIds.has(p.id))}
                      onCheckedChange={(checked) => setSelectedIds(checked ? new Set(filtered.map((p) => p.id)) : new Set())}
                    />
                  </th>
                  <th className="p-3">Inmobiliaria</th>
                  <th className="p-3">Localidad</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Contacto</th>
                  <th className="p-3">Estado</th>
                  <th className="p-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 500).map((prospect) => (
                  <tr key={prospect.id} className="border-t align-top">
                    <td className="p-3">
                      <Checkbox
                        checked={selectedIds.has(prospect.id)}
                        onCheckedChange={(checked) =>
                          setSelectedIds((current) => {
                            const next = new Set(current);
                            if (checked) next.add(prospect.id);
                            else next.delete(prospect.id);
                            return next;
                          })
                        }
                      />
                    </td>
                    <td className="p-3">
                      <div className="font-medium">{prospect.name}</div>
                      {prospect.address ? <div className="text-xs text-muted-foreground">{prospect.address}</div> : null}
                    </td>
                    <td className="p-3 whitespace-nowrap">{prospect.town ?? "—"}</td>
                    <td className="p-3 min-w-56">
                      <Input
                        className="h-8"
                        placeholder={prospect.enriched_at ? "No encontré email" : "sin email"}
                        value={emailDrafts[prospect.id] ?? prospect.email ?? ""}
                        onChange={(e) => setEmailDrafts((d) => ({ ...d, [prospect.id]: e.target.value }))}
                        onBlur={() => void saveEmailDraft(prospect)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                        }}
                      />
                      {prospect.emails.length > 1 ? (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {prospect.emails
                            .filter((e) => e !== prospect.email)
                            .map((email) => (
                              <button
                                key={email}
                                type="button"
                                className="text-xs text-muted-foreground underline"
                                onClick={() => void patchProspect(prospect.id, { email })}
                              >
                                {email}
                              </button>
                            ))}
                        </div>
                      ) : null}
                    </td>
                    <td className="p-3 text-xs">
                      {prospect.phone ? <div>{prospect.phone}</div> : null}
                      {prospect.website ? (
                        <a href={prospect.website} target="_blank" rel="noreferrer" className="block max-w-48 truncate text-primary underline">
                          {prospect.website.replace(/^https?:\/\/(www\.)?/, "")}
                        </a>
                      ) : null}
                      {prospect.maps_url ? (
                        <a href={prospect.maps_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-muted-foreground underline">
                          <MapPin className="size-3" /> mapa
                        </a>
                      ) : null}
                    </td>
                    <td className="p-3">
                      <Badge variant={STATUS_VARIANT[prospect.status]}>{STATUS_LABELS[prospect.status]}</Badge>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {prospect.status !== "replied" ? (
                          <Button size="xs" variant="secondary" onClick={() => void patchProspect(prospect.id, { status: "replied" })}>
                            Respondió
                          </Button>
                        ) : null}
                        {prospect.status !== "discarded" ? (
                          <Button size="xs" variant="secondary" onClick={() => void patchProspect(prospect.id, { status: "discarded" })}>
                            Descartar
                          </Button>
                        ) : null}
                        {prospect.status !== "new" ? (
                          <Button size="xs" variant="secondary" onClick={() => void patchProspect(prospect.id, { status: "new" })}>
                            Reabrir
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">No hay inmobiliarias con estos filtros. Usá el buscador.</p>
            ) : null}
            {filtered.length > 500 ? (
              <p className="p-3 text-center text-xs text-muted-foreground">Mostrando 500 de {filtered.length}. Filtrá para ver el resto.</p>
            ) : null}
          </div>
        </TabsContent>

        {/* ---------------- CAMPAÑA ---------------- */}
        <TabsContent value="campaign" className="space-y-4">
          {!config?.mailerEnabled ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
              Falta configurar el envío: cargá <code>OUTREACH_SMTP_USER</code> y <code>OUTREACH_SMTP_PASS</code> (contraseña de
              aplicación de Gmail) en Netlify.
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Sale desde <strong>{config.sender.name} &lt;{config.sender.email}&gt;</strong>. Límite: {config.dailyLimit} por día
              (hoy van {config.sentToday}).
            </p>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Mail</CardTitle>
                <CardDescription>
                  Variables: <code>{"{{nombre}}"}</code> (inmobiliaria) y <code>{"{{ciudad}}"}</code>. El link de baja se agrega solo al pie.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="subject">Asunto</Label>
                  <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="body">Cuerpo</Label>
                  <Textarea id="body" rows={16} value={body} onChange={(e) => setBody(e.target.value)} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={sendTest} disabled={!config?.mailerEnabled}>
                    <Mail className="size-4" /> Mandarme una prueba
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setSubject(DEFAULT_SUBJECT);
                      setBody(DEFAULT_BODY);
                    }}
                  >
                    Restaurar plantilla
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Vista previa</CardTitle>
                <CardDescription>Así le llega a {recipients[0]?.name ?? "una inmobiliaria"}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border bg-muted/30 p-4 text-sm">
                  <p className="mb-3 font-semibold">{preview.subject}</p>
                  <p className="whitespace-pre-wrap">{preview.body}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Enviar</CardTitle>
              <CardDescription>
                Solo van a inmobiliarias en estado &quot;Nuevo&quot; con email. Nunca se manda dos veces a la misma dirección.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Destinatarios</Label>
                <div className="flex flex-wrap gap-1">
                  {["all", ...PROSPECT_REGIONS].map((value) => (
                    <Button key={value} size="xs" variant={campaignTowns === value ? "default" : "secondary"} onClick={() => setCampaignTowns(value)}>
                      {value === "all" ? "Todas" : value}
                    </Button>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">{recipients.length} inmobiliarias listas para recibir el mail.</p>
              </div>

              <div className="max-w-xs space-y-1.5">
                <Label htmlFor="delay">Pausa entre mails (segundos)</Label>
                <Input id="delay" type="number" min={5} value={delaySeconds} onChange={(e) => setDelaySeconds(e.target.value)} />
              </div>

              <div className="flex gap-2">
                {isSending ? (
                  <Button variant="destructive" onClick={() => (stopRef.current = true)}>
                    <Square className="size-4" /> Frenar
                  </Button>
                ) : (
                  <Button onClick={runCampaign} disabled={!config?.mailerEnabled || recipients.length === 0}>
                    <Send className="size-4" /> Mandar a {recipients.length} inmobiliarias
                  </Button>
                )}
              </div>
              {isSending ? (
                <p className="text-xs text-muted-foreground">Dejá esta pestaña abierta mientras se envía.</p>
              ) : null}

              {sendLog.length > 0 ? (
                <div className="max-h-64 overflow-y-auto rounded-lg bg-muted/50 p-3 font-mono text-xs">
                  {sendLog.map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
