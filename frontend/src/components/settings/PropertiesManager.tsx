"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Building2, Loader2, MapPin, Pencil, Plus, Tag, Trash2,
} from "lucide-react";
import {
  createProperty, deleteProperty, updateProperty,
} from "@/modules/agency/properties/actions";
import {
  AMENITY_LABELS, COMMON_AMENITIES, OPERATION_LABELS, OPERATION_TYPES,
  PROPERTY_STATUSES, PROPERTY_TYPES, PROPERTY_TYPE_LABELS, STATUS_LABELS,
  type PropertyFormInput, type PropertyRecord,
} from "@/modules/agency/properties/types";
import { emitGlobalToast } from "@/lib/global-toast";
import { useBlueRate } from "@/lib/use-blue-rate";
import { usdEquivalent } from "@/lib/money-format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

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

const EMPTY_FORM: PropertyFormInput = {
  title: "",
  internalCode: "",
  listingUrl: "",
  propertyType: "depto",
  operationType: "venta",
  status: "disponible",
  address: "",
  zone: "",
  city: "",
  province: "",
  floor: "",
  apartment: "",
  rooms: null,
  bedrooms: null,
  bathrooms: null,
  surfaceTotal: null,
  surfaceCovered: null,
  yearBuilt: null,
  price: null,
  currency: "USD",
  expenses: null,
  expensesCurrency: "ARS",
  hasGarage: null,
  garageCount: null,
  mortgageEligible: null,
  amenities: [],
  description: "",
};

function toForm(p: PropertyRecord): PropertyFormInput {
  return {
    title: p.title,
    internalCode: p.internalCode ?? "",
    listingUrl: p.listingUrl ?? "",
    propertyType: p.propertyType,
    operationType: p.operationType,
    status: p.status,
    address: p.address ?? "",
    zone: p.zone ?? "",
    city: p.city ?? "",
    province: p.province ?? "",
    floor: p.floor ?? "",
    apartment: p.apartment ?? "",
    rooms: p.rooms,
    bedrooms: p.bedrooms,
    bathrooms: p.bathrooms,
    surfaceTotal: p.surfaceTotal,
    surfaceCovered: p.surfaceCovered,
    yearBuilt: p.yearBuilt,
    price: p.price,
    currency: p.currency ?? "USD",
    expenses: p.expenses,
    expensesCurrency: p.expensesCurrency ?? "ARS",
    hasGarage: p.hasGarage,
    garageCount: p.garageCount,
    mortgageEligible: p.mortgageEligible,
    amenities: p.amenities,
    description: p.description ?? "",
  };
}

function NumberInput({
  id, value, onChange, placeholder,
}: { id: string; value: number | null | undefined; onChange: (n: number | null) => void; placeholder?: string }) {
  return (
    <Input
      id={id}
      type="number"
      inputMode="numeric"
      value={value ?? ""}
      onChange={(e) => {
        const v = e.target.value;
        onChange(v === "" ? null : Number(v));
      }}
      placeholder={placeholder}
    />
  );
}

function ChipSelect<T extends string>({
  options, value, onChange, label, getLabel,
}: {
  options: readonly T[]; value: T; onChange: (v: T) => void; label: string; getLabel: (v: T) => string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
              value === opt
                ? "border-primary/40 bg-primary/15 text-foreground"
                : "border-border bg-muted text-muted-foreground hover:border-[#D4420A]/30"
            )}
          >
            {getLabel(opt)}
          </button>
        ))}
      </div>
    </div>
  );
}

export function PropertiesManager({ initialProperties }: { initialProperties: PropertyRecord[] }) {
  const [list, setList] = useState<PropertyRecord[]>(initialProperties);
  const [isPending, startTransition] = useTransition();
  const blueRate = useBlueRate();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PropertyRecord | null>(null);
  const [form, setForm] = useState<PropertyFormInput>(EMPTY_FORM);

  const [filterStatus, setFilterStatus] = useState<string>("all");

  const filtered = useMemo(() => {
    if (filterStatus === "all") return list;
    return list.filter((p) => p.status === filterStatus);
  }, [list, filterStatus]);

  const counts = useMemo(() => {
    const byStatus = new Map<string, number>();
    for (const p of list) byStatus.set(p.status, (byStatus.get(p.status) ?? 0) + 1);
    return {
      total: list.length,
      disponible: byStatus.get("disponible") ?? 0,
      reservada: byStatus.get("reservada") ?? 0,
      vendida: byStatus.get("vendida") ?? 0,
      alquilada: byStatus.get("alquilada") ?? 0,
    };
  }, [list]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  }
  function openEdit(p: PropertyRecord) {
    setEditing(p);
    setForm(toForm(p));
    setOpen(true);
  }
  function patchForm<K extends keyof PropertyFormInput>(key: K, value: PropertyFormInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }
  function toggleAmenity(a: string) {
    setForm((prev) => {
      const current = prev.amenities ?? [];
      const next = current.includes(a) ? current.filter((x) => x !== a) : [...current, a];
      return { ...prev, amenities: next };
    });
  }

  function save() {
    if (!form.title.trim()) {
      emitGlobalToast({ tone: "error", text: "Poné un título para la propiedad." });
      return;
    }
    startTransition(async () => {
      const res = editing ? await updateProperty(editing.id, form) : await createProperty(form);
      if (res.error || !res.data) {
        emitGlobalToast({ tone: "error", text: res.error ?? "No se pudo guardar." });
        return;
      }
      const saved = res.data;
      setList((prev) => {
        const next = editing ? prev.map((p) => (p.id === saved.id ? saved : p)) : [saved, ...prev];
        return next;
      });
      emitGlobalToast({ tone: "success", text: editing ? "Propiedad actualizada." : "Propiedad agregada." });
      setOpen(false);
    });
  }

  function remove(p: PropertyRecord) {
    startTransition(async () => {
      const res = await deleteProperty(p.id);
      if (res.error) { emitGlobalToast({ tone: "error", text: res.error }); return; }
      setList((prev) => prev.filter((x) => x.id !== p.id));
      emitGlobalToast({ tone: "success", text: "Propiedad eliminada." });
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-card/90">
        <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-primary/10 p-3 text-primary">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Catálogo de propiedades</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Todas las propiedades que tu inmobiliaria tiene en cartera. El agente las usa para
                matchear leads contra lo que tenés disponible.
              </p>
            </div>
          </div>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Agregar propiedad
          </Button>
        </CardContent>
      </Card>

      {/* Stats + filter */}
      <Card className="bg-card/90">
        <CardContent className="pt-6">
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {(["all", "disponible", "reservada", "vendida", "alquilada"] as const).map((s) => {
              const count = s === "all" ? counts.total : counts[s as keyof typeof counts] ?? 0;
              const active = filterStatus === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setFilterStatus(s)}
                  className={cn(
                    "rounded-2xl border p-4 text-center transition-all",
                    active ? "border-primary/40 bg-primary/10" : "border-border bg-muted hover:border-[#D4420A]/30",
                    s !== "all" && !active ? STATUS_TONE[s as string] : ""
                  )}
                >
                  <p className="text-2xl font-semibold">{count}</p>
                  <p className="mt-1 text-xs font-medium">{s === "all" ? "Total" : STATUS_LABELS[s as string]}</p>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Grid */}
      {filtered.length === 0 ? (
        <Card className="bg-card/90">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Building2 className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {list.length === 0
                ? "Todavía no cargaste propiedades. Agregá la primera para empezar."
                : "No hay propiedades en este filtro."}
            </p>
            {list.length === 0 ? (
              <Button onClick={openCreate} variant="outline" className="border-border bg-muted">
                <Plus className="mr-2 h-4 w-4" />
                Agregar propiedad
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => (
            <Card key={p.id} className="group bg-card/90">
              <CardContent className="pt-6">
                {/* status + price */}
                <div className="mb-3 flex items-start justify-between gap-2">
                  <Badge className={cn("font-medium", STATUS_TONE[p.status] ?? STATUS_TONE.pausada)}>
                    {STATUS_LABELS[p.status] ?? p.status}
                  </Badge>
                  <div className="text-right">
                    <p className="text-lg font-semibold">{money(p.price, p.currency)}</p>
                    {usdEquivalent(p.price, p.currency, blueRate) ? (
                      <p className="text-[10px] text-muted-foreground">≈ {usdEquivalent(p.price, p.currency, blueRate)}</p>
                    ) : null}
                  </div>
                </div>

                {/* title + classification */}
                <p className="line-clamp-2 font-semibold">{p.title}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge className="border-border bg-muted text-foreground">
                    {PROPERTY_TYPE_LABELS[p.propertyType] ?? p.propertyType}
                  </Badge>
                  <Badge className="border-border bg-muted text-foreground">
                    {OPERATION_LABELS[p.operationType] ?? p.operationType}
                  </Badge>
                  {p.mortgageEligible ? (
                    <Badge className="border-emerald-400/30 bg-emerald-500/10 text-emerald-700">Apto crédito</Badge>
                  ) : null}
                </div>

                {/* location */}
                {(p.address || p.zone || p.city) ? (
                  <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" />
                    <span className="truncate">
                      {[p.address, p.zone, p.city].filter(Boolean).join(" · ")}
                    </span>
                  </p>
                ) : null}

                {/* specs */}
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  {p.rooms != null ? <span>{p.rooms} amb.</span> : null}
                  {p.bedrooms != null ? <span>{p.bedrooms} dorm.</span> : null}
                  {p.bathrooms != null ? <span>{p.bathrooms} baños</span> : null}
                  {p.surfaceTotal != null ? <span>{p.surfaceTotal} m² tot.</span> : null}
                  {p.surfaceCovered != null ? <span>{p.surfaceCovered} m² cub.</span> : null}
                  {p.hasGarage ? <span>Cochera{p.garageCount && p.garageCount > 1 ? ` x${p.garageCount}` : ""}</span> : null}
                </div>

                {/* amenities */}
                {p.amenities.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {p.amenities.slice(0, 4).map((a) => (
                      <span key={a} className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                        {AMENITY_LABELS[a] ?? a}
                      </span>
                    ))}
                    {p.amenities.length > 4 ? (
                      <span className="text-[10px] text-muted-foreground">+{p.amenities.length - 4}</span>
                    ) : null}
                  </div>
                ) : null}

                {/* actions */}
                <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                  <span className="text-[11px] text-muted-foreground">
                    {p.internalCode ? <><Tag className="mr-1 inline h-3 w-3" />{p.internalCode}</> : ""}
                  </span>
                  <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button size="icon" variant="ghost" className="h-8 w-8" disabled={isPending} onClick={() => openEdit(p)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:text-red-600" disabled={isPending} onClick={() => remove(p)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add / edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar propiedad" : "Agregar propiedad"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Identificación */}
            <div className="space-y-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Identificación</p>
              <div className="space-y-2">
                <Label htmlFor="p-title">Título *</Label>
                <Input
                  id="p-title"
                  value={form.title}
                  onChange={(e) => patchForm("title", e.target.value)}
                  placeholder="Ej: Depto 2 ambientes Palermo, balcón al frente"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="p-code">Código interno</Label>
                  <Input id="p-code" value={form.internalCode ?? ""} onChange={(e) => patchForm("internalCode", e.target.value)} placeholder="REF-123" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p-url">URL del aviso</Label>
                  <Input id="p-url" value={form.listingUrl ?? ""} onChange={(e) => patchForm("listingUrl", e.target.value)} placeholder="https://…" />
                </div>
              </div>
            </div>

            {/* Clasificación */}
            <div className="space-y-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Clasificación</p>
              <ChipSelect
                options={PROPERTY_TYPES}
                value={form.propertyType as (typeof PROPERTY_TYPES)[number]}
                onChange={(v) => patchForm("propertyType", v)}
                label="Tipo de propiedad"
                getLabel={(v) => PROPERTY_TYPE_LABELS[v] ?? v}
              />
              <ChipSelect
                options={OPERATION_TYPES}
                value={form.operationType as (typeof OPERATION_TYPES)[number]}
                onChange={(v) => patchForm("operationType", v)}
                label="Operación"
                getLabel={(v) => OPERATION_LABELS[v] ?? v}
              />
              <ChipSelect
                options={PROPERTY_STATUSES}
                value={form.status as (typeof PROPERTY_STATUSES)[number]}
                onChange={(v) => patchForm("status", v)}
                label="Estado"
                getLabel={(v) => STATUS_LABELS[v] ?? v}
              />
            </div>

            {/* Ubicación */}
            <div className="space-y-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Ubicación</p>
              <div className="space-y-2">
                <Label htmlFor="p-address">Dirección</Label>
                <Input id="p-address" value={form.address ?? ""} onChange={(e) => patchForm("address", e.target.value)} placeholder="Av. Santa Fe 1234" />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="p-zone">Zona / barrio</Label>
                  <Input id="p-zone" value={form.zone ?? ""} onChange={(e) => patchForm("zone", e.target.value)} placeholder="Palermo" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p-city">Ciudad</Label>
                  <Input id="p-city" value={form.city ?? ""} onChange={(e) => patchForm("city", e.target.value)} placeholder="CABA" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p-province">Provincia</Label>
                  <Input id="p-province" value={form.province ?? ""} onChange={(e) => patchForm("province", e.target.value)} placeholder="Buenos Aires" />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="p-floor">Piso</Label>
                  <Input id="p-floor" value={form.floor ?? ""} onChange={(e) => patchForm("floor", e.target.value)} placeholder="8°" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p-apt">Unidad / depto</Label>
                  <Input id="p-apt" value={form.apartment ?? ""} onChange={(e) => patchForm("apartment", e.target.value)} placeholder="A" />
                </div>
              </div>
            </div>

            {/* Especificaciones */}
            <div className="space-y-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Especificaciones</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="p-rooms">Ambientes</Label>
                  <NumberInput id="p-rooms" value={form.rooms} onChange={(n) => patchForm("rooms", n)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p-bedrooms">Dormitorios</Label>
                  <NumberInput id="p-bedrooms" value={form.bedrooms} onChange={(n) => patchForm("bedrooms", n)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p-bathrooms">Baños</Label>
                  <NumberInput id="p-bathrooms" value={form.bathrooms} onChange={(n) => patchForm("bathrooms", n)} />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="p-st">Sup. total (m²)</Label>
                  <NumberInput id="p-st" value={form.surfaceTotal} onChange={(n) => patchForm("surfaceTotal", n)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p-sc">Sup. cubierta (m²)</Label>
                  <NumberInput id="p-sc" value={form.surfaceCovered} onChange={(n) => patchForm("surfaceCovered", n)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p-year">Antigüedad (año)</Label>
                  <NumberInput id="p-year" value={form.yearBuilt} onChange={(n) => patchForm("yearBuilt", n)} placeholder="2010" />
                </div>
              </div>
            </div>

            {/* Precio */}
            <div className="space-y-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Precio</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="p-price">Precio</Label>
                  <NumberInput id="p-price" value={form.price} onChange={(n) => patchForm("price", n)} />
                </div>
                <ChipSelect
                  options={["USD", "ARS"] as const}
                  value={(form.currency ?? "USD") as "USD" | "ARS"}
                  onChange={(v) => patchForm("currency", v)}
                  label="Moneda"
                  getLabel={(v) => v}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="p-exp">Expensas (mensual)</Label>
                  <NumberInput id="p-exp" value={form.expenses} onChange={(n) => patchForm("expenses", n)} />
                </div>
                <ChipSelect
                  options={["ARS", "USD"] as const}
                  value={(form.expensesCurrency ?? "ARS") as "ARS" | "USD"}
                  onChange={(v) => patchForm("expensesCurrency", v)}
                  label="Moneda exp."
                  getLabel={(v) => v}
                />
              </div>
            </div>

            {/* Características */}
            <div className="space-y-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Características</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <ChipSelect
                  options={["si", "no"] as const}
                  value={form.hasGarage === true ? "si" : form.hasGarage === false ? "no" : "no"}
                  onChange={(v) => patchForm("hasGarage", v === "si")}
                  label="Cochera"
                  getLabel={(v) => v === "si" ? "Sí" : "No"}
                />
                <div className="space-y-2">
                  <Label htmlFor="p-garage">Cant. cocheras</Label>
                  <NumberInput id="p-garage" value={form.garageCount} onChange={(n) => patchForm("garageCount", n)} />
                </div>
                <ChipSelect
                  options={["si", "no"] as const}
                  value={form.mortgageEligible === true ? "si" : form.mortgageEligible === false ? "no" : "no"}
                  onChange={(v) => patchForm("mortgageEligible", v === "si")}
                  label="Apto crédito"
                  getLabel={(v) => v === "si" ? "Sí" : "No"}
                />
              </div>
              <div className="space-y-2">
                <Label>Amenities</Label>
                <div className="flex flex-wrap gap-2">
                  {COMMON_AMENITIES.map((a) => {
                    const active = (form.amenities ?? []).includes(a);
                    return (
                      <button
                        key={a}
                        type="button"
                        onClick={() => toggleAmenity(a)}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                          active
                            ? "border-primary/40 bg-primary/15 text-foreground"
                            : "border-border bg-muted text-muted-foreground hover:border-[#D4420A]/30"
                        )}
                      >
                        {AMENITY_LABELS[a] ?? a}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Descripción */}
            <div className="space-y-2">
              <Label htmlFor="p-desc">Descripción</Label>
              <Textarea
                id="p-desc"
                value={form.description ?? ""}
                onChange={(e) => patchForm("description", e.target.value)}
                placeholder="Detalles, comodidades, observaciones internas…"
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} className="border-border bg-muted">
              Cancelar
            </Button>
            <Button onClick={save} disabled={isPending}>
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {editing ? "Guardar cambios" : "Agregar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
