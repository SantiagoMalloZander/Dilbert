"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, Loader2, MapPin, Search } from "lucide-react";
import { listLinkableProperties } from "@/modules/agency/properties/actions";
import {
  OPERATION_LABELS,
  PROPERTY_TYPE_LABELS,
  STATUS_LABELS,
  type PropertyRecord,
} from "@/modules/agency/properties/types";
import { useBlueRate } from "@/lib/use-blue-rate";
import { usdEquivalent } from "@/lib/money-format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const STATUS_TONE: Record<string, string> = {
  disponible: "border-emerald-400/40 bg-emerald-500/10 text-emerald-700",
  reservada:  "border-amber-400/40 bg-amber-500/10 text-amber-700",
  vendida:    "border-blue-400/40 bg-blue-500/10 text-blue-700",
  alquilada:  "border-blue-400/40 bg-blue-500/10 text-blue-700",
  pausada:    "border-zinc-400/40 bg-zinc-500/10 text-zinc-700",
};

function money(value: number | null, currency: string | null) {
  if (value == null) return "—";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: currency || "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

export function PropertyPickerDialog({
  open,
  onOpenChange,
  onPick,
  disabled,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (property: PropertyRecord) => void;
  disabled?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<PropertyRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const blueRate = useBlueRate();

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    listLinkableProperties().then((res) => {
      if (cancelled) return;
      if (res.error || !res.data) {
        setError(res.error ?? "No se pudo cargar el catálogo.");
        setList([]);
      } else {
        setList(res.data);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((p) => {
      const hay = [
        p.title, p.internalCode, p.zone, p.city, p.address,
        PROPERTY_TYPE_LABELS[p.propertyType], OPERATION_LABELS[p.operationType],
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [list, search]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>Vincular propiedad del catálogo</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscá por título, código, zona o ciudad…"
              className="pl-9"
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Cargando catálogo…
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-700">
              {error}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
              <Building2 className="h-7 w-7" />
              {list.length === 0
                ? "Todavía no hay propiedades cargadas en el catálogo."
                : "No hay propiedades que coincidan con la búsqueda."}
            </div>
          ) : (
            <div className="-mx-2 max-h-[55vh] space-y-2 overflow-y-auto px-2 pb-1">
              {filtered.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => onPick(p)}
                  className="flex w-full items-start gap-3 rounded-2xl border border-[#2A1A0A]/15 bg-[#F5F0E8] p-3 text-left transition-all hover:border-[#D4420A]/30 disabled:opacity-50"
                >
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-xs font-semibold text-primary">
                    {p.title.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate font-medium">{p.title}</p>
                      <div className="shrink-0 text-right">
                        <p className="font-semibold">{money(p.price, p.currency)}</p>
                        {usdEquivalent(p.price, p.currency, blueRate) ? (
                          <p className="text-[10px] text-muted-foreground">≈ {usdEquivalent(p.price, p.currency, blueRate)}</p>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <Badge className={STATUS_TONE[p.status] ?? STATUS_TONE.pausada}>
                        {STATUS_LABELS[p.status] ?? p.status}
                      </Badge>
                      <Badge className="border-[#2A1A0A]/15 bg-card text-foreground">
                        {PROPERTY_TYPE_LABELS[p.propertyType] ?? p.propertyType}
                      </Badge>
                      <Badge className="border-[#2A1A0A]/15 bg-card text-foreground">
                        {OPERATION_LABELS[p.operationType] ?? p.operationType}
                      </Badge>
                    </div>
                    {(p.address || p.zone || p.city) ? (
                      <p className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        <span className="truncate">
                          {[p.address, p.zone, p.city].filter(Boolean).join(" · ")}
                        </span>
                      </p>
                    ) : null}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-[#2A1A0A]/15 bg-[#F5F0E8]">
            Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
