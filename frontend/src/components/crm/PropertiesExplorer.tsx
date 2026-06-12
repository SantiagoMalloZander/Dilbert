"use client";

import { useMemo, useState } from "react";
import { Building2, ExternalLink, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  OPERATION_LABELS,
  PROPERTY_TYPE_LABELS,
  type PropertyRecord,
} from "@/modules/agency/properties/types";

function formatPrice(value: number | null, currency: string | null) {
  if (value == null) return "Consultar";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

const ALL = "todos";

export function PropertiesExplorer({ properties }: { properties: PropertyRecord[] }) {
  const [query, setQuery] = useState("");
  const [operation, setOperation] = useState<string>(ALL);
  const [type, setType] = useState<string>(ALL);
  const [zone, setZone] = useState<string>(ALL);
  const [rooms, setRooms] = useState<string>(ALL);
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [aptaCredito, setAptaCredito] = useState(false);
  const [conCochera, setConCochera] = useState(false);

  const zones = useMemo(
    () => [...new Set(properties.map((p) => p.zone).filter(Boolean))].sort() as string[],
    [properties]
  );
  const types = useMemo(
    () => [...new Set(properties.map((p) => p.propertyType).filter(Boolean))],
    [properties]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const min = priceMin ? Number(priceMin) : null;
    const max = priceMax ? Number(priceMax) : null;
    return properties.filter((p) => {
      if (operation !== ALL && p.operationType !== operation) return false;
      if (type !== ALL && p.propertyType !== type) return false;
      if (zone !== ALL && p.zone !== zone) return false;
      if (rooms !== ALL && (p.rooms ?? 0) < Number(rooms)) return false;
      if (aptaCredito && !p.mortgageEligible) return false;
      if (conCochera && !p.hasGarage) return false;
      if (min != null && (p.price ?? 0) < min) return false;
      if (max != null && (p.price ?? Infinity) > max) return false;
      if (q) {
        const hay = `${p.title} ${p.zone ?? ""} ${p.city ?? ""} ${p.address ?? ""} ${p.internalCode ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [properties, query, operation, type, zone, rooms, priceMin, priceMax, aptaCredito, conCochera]);

  const hasFilters =
    query || operation !== ALL || type !== ALL || zone !== ALL || rooms !== ALL || priceMin || priceMax || aptaCredito || conCochera;

  function clearAll() {
    setQuery(""); setOperation(ALL); setType(ALL); setZone(ALL); setRooms(ALL);
    setPriceMin(""); setPriceMax(""); setAptaCredito(false); setConCochera(false);
  }

  const selectClass =
    "h-9 rounded-md border border-input bg-card px-2 text-sm text-foreground outline-none focus-visible:border-ring";

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Propiedades</h1>
          <p className="text-sm text-muted-foreground">Tu catálogo. Filtralo para encontrar lo que busca cada cliente.</p>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="space-y-3 pt-5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por título, zona, dirección o código…"
              className="pl-9"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select className={selectClass} value={operation} onChange={(e) => setOperation(e.target.value)}>
              <option value={ALL}>Operación</option>
              {Object.entries(OPERATION_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>

            <select className={selectClass} value={type} onChange={(e) => setType(e.target.value)}>
              <option value={ALL}>Tipo</option>
              {types.map((t) => (
                <option key={t} value={t}>{PROPERTY_TYPE_LABELS[t] || t}</option>
              ))}
            </select>

            <select className={selectClass} value={zone} onChange={(e) => setZone(e.target.value)}>
              <option value={ALL}>Zona</option>
              {zones.map((z) => (
                <option key={z} value={z}>{z}</option>
              ))}
            </select>

            <select className={selectClass} value={rooms} onChange={(e) => setRooms(e.target.value)}>
              <option value={ALL}>Ambientes</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={String(n)}>{n}+ amb.</option>
              ))}
            </select>

            <Input
              type="number"
              value={priceMin}
              onChange={(e) => setPriceMin(e.target.value)}
              placeholder="Precio mín."
              className="h-9 w-32"
            />
            <Input
              type="number"
              value={priceMax}
              onChange={(e) => setPriceMax(e.target.value)}
              placeholder="Precio máx."
              className="h-9 w-32"
            />

            <button
              type="button"
              onClick={() => setAptaCredito((v) => !v)}
              className={`h-9 rounded-md border px-3 text-sm font-medium transition-colors ${aptaCredito ? "border-primary bg-primary/10 text-primary" : "border-input text-muted-foreground hover:bg-muted"}`}
            >
              Apta crédito
            </button>
            <button
              type="button"
              onClick={() => setConCochera((v) => !v)}
              className={`h-9 rounded-md border px-3 text-sm font-medium transition-colors ${conCochera ? "border-primary bg-primary/10 text-primary" : "border-input text-muted-foreground hover:bg-muted"}`}
            >
              Con cochera
            </button>

            {hasFilters ? (
              <Button variant="ghost" size="sm" onClick={clearAll}>
                <X className="mr-1 h-4 w-4" /> Limpiar
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        {filtered.length} {filtered.length === 1 ? "propiedad" : "propiedades"}
      </p>

      {/* Grid */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No hay propiedades que coincidan con el filtro.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <Card key={p.id}>
              <CardContent className="space-y-3 pt-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Building2 className="h-4 w-4 text-primary" />
                    {OPERATION_LABELS[p.operationType] || p.operationType} · {PROPERTY_TYPE_LABELS[p.propertyType] || p.propertyType}
                  </div>
                  {p.mortgageEligible ? (
                    <Badge className="bg-emerald-500/10 text-emerald-700 border-transparent">Apta crédito</Badge>
                  ) : null}
                </div>

                <div>
                  <p className="font-semibold leading-snug text-foreground line-clamp-2">{p.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {[p.zone, p.city].filter(Boolean).join(" · ") || "Sin zona"}
                  </p>
                </div>

                <p className="text-lg font-semibold text-foreground">{formatPrice(p.price, p.currency)}</p>

                <div className="flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                  {p.rooms ? <span className="rounded bg-muted px-2 py-0.5">{p.rooms} amb.</span> : null}
                  {p.bedrooms ? <span className="rounded bg-muted px-2 py-0.5">{p.bedrooms} dorm.</span> : null}
                  {p.surfaceTotal ? <span className="rounded bg-muted px-2 py-0.5">{p.surfaceTotal} m²</span> : null}
                  {p.hasGarage ? <span className="rounded bg-muted px-2 py-0.5">Cochera</span> : null}
                </div>

                {p.listingUrl ? (
                  <a
                    href={p.listingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    Ver publicación <ExternalLink className="h-3 w-3" />
                  </a>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
