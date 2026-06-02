"use client";

import { Home } from "lucide-react";
import type { LeadRealEstateFields } from "@/modules/crm/leads/types";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const OPERATIONS = [
  { value: "compra", label: "Compra" },
  { value: "venta", label: "Venta" },
  { value: "alquiler", label: "Alquiler" },
  { value: "tasacion", label: "Tasación" },
] as const;

const CLIENT_ROLES = [
  { value: "buyer", label: "Comprador" },
  { value: "seller", label: "Vendedor" },
  { value: "owner", label: "Propietario" },
  { value: "renter", label: "Inquilino" },
  { value: "investor", label: "Inversor" },
] as const;

const PROPERTY_TYPES = [
  { value: "depto", label: "Depto" },
  { value: "casa", label: "Casa" },
  { value: "ph", label: "PH" },
  { value: "terreno", label: "Terreno" },
  { value: "terreno_industrial", label: "Terreno industrial" },
  { value: "terreno_barrio", label: "Lote en barrio" },
  { value: "terreno_complejo", label: "Lote en complejo" },
  { value: "local", label: "Local" },
  { value: "oficina", label: "Oficina" },
  { value: "galpon", label: "Galpón" },
  { value: "cochera", label: "Cochera" },
  { value: "quinta", label: "Quinta" },
] as const;

const URGENCIES = [
  { value: "high", label: "Alta" },
  { value: "medium", label: "Media" },
  { value: "low", label: "Baja" },
] as const;

const VISIT_STATUSES = [
  { value: "agendada", label: "Agendada" },
  { value: "realizada", label: "Realizada" },
  { value: "cancelada", label: "Cancelada" },
] as const;

const FINANCINGS = [
  { value: "contado", label: "Contado" },
  { value: "credito", label: "Crédito" },
  { value: "mixto", label: "Mixto" },
] as const;

const CURRENCIES = ["USD", "ARS"] as const;

type Option<T extends string> = { value: T; label: string };

function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  clearable = true,
}: {
  options: readonly Option<T>[];
  value: T | null;
  onChange: (v: T | null) => void;
  clearable?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(active && clearable ? null : opt.value)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
              active
                ? "border-primary/40 bg-primary/15 text-foreground"
                : "border-[#2A1A0A]/15 bg-[#F5F0E8] text-muted-foreground hover:border-[#D4420A]/30"
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function NumberInput({
  id,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  value: number | null;
  onChange: (n: number | null) => void;
  placeholder?: string;
}) {
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

export function LeadRealEstateFormSection({
  values,
  onChange,
  idPrefix = "re",
}: {
  values: LeadRealEstateFields;
  onChange: (patch: Partial<LeadRealEstateFields>) => void;
  idPrefix?: string;
}) {
  const id = (key: string) => `${idPrefix}-${key}`;

  return (
    <div className="space-y-5 rounded-2xl border border-[#2A1A0A]/15 bg-[#F5F0E8]/40 p-4">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        <Home className="h-3.5 w-3.5" />
        Detalles de la búsqueda
      </div>

      {/* Operación + rol */}
      <div className="space-y-2">
        <Label>Operación</Label>
        <ChipGroup
          options={OPERATIONS}
          value={values.operationType as (typeof OPERATIONS)[number]["value"] | null}
          onChange={(v) => onChange({ operationType: v })}
        />
      </div>
      <div className="space-y-2">
        <Label>Rol del cliente</Label>
        <ChipGroup
          options={CLIENT_ROLES}
          value={values.clientRole as (typeof CLIENT_ROLES)[number]["value"] | null}
          onChange={(v) => onChange({ clientRole: v })}
        />
      </div>

      {/* Tipo de propiedad */}
      <div className="space-y-2">
        <Label>Tipo de propiedad</Label>
        <ChipGroup
          options={PROPERTY_TYPES}
          value={values.propertyType as (typeof PROPERTY_TYPES)[number]["value"] | null}
          onChange={(v) => onChange({ propertyType: v })}
        />
      </div>

      {/* Ubicación */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor={id("zone")}>Zona / barrio</Label>
          <Input
            id={id("zone")}
            value={values.zone ?? ""}
            onChange={(e) => onChange({ zone: e.target.value || null })}
            placeholder="Palermo"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={id("city")}>Ciudad</Label>
          <Input
            id={id("city")}
            value={values.city ?? ""}
            onChange={(e) => onChange({ city: e.target.value || null })}
            placeholder="CABA"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={id("province")}>Provincia</Label>
          <Input
            id={id("province")}
            value={values.province ?? ""}
            onChange={(e) => onChange({ province: e.target.value || null })}
            placeholder="Buenos Aires"
          />
        </div>
      </div>

      {/* Presupuesto */}
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <div className="space-y-2">
          <Label htmlFor={id("bmin")}>Presupuesto desde</Label>
          <NumberInput id={id("bmin")} value={values.budgetMin} onChange={(n) => onChange({ budgetMin: n })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor={id("bmax")}>Presupuesto hasta</Label>
          <NumberInput id={id("bmax")} value={values.budgetMax} onChange={(n) => onChange({ budgetMax: n })} />
        </div>
        <div className="space-y-2">
          <Label>Moneda</Label>
          <ChipGroup
            options={CURRENCIES.map((c) => ({ value: c, label: c }))}
            value={values.budgetCurrency as "USD" | "ARS" | null}
            onChange={(v) => onChange({ budgetCurrency: v })}
            clearable={false}
          />
        </div>
      </div>

      {/* Specs */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor={id("rooms")}>Ambientes</Label>
          <NumberInput id={id("rooms")} value={values.rooms} onChange={(n) => onChange({ rooms: n })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor={id("bedrooms")}>Dormitorios</Label>
          <NumberInput id={id("bedrooms")} value={values.bedrooms} onChange={(n) => onChange({ bedrooms: n })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor={id("bathrooms")}>Baños</Label>
          <NumberInput id={id("bathrooms")} value={values.bathrooms} onChange={(n) => onChange({ bathrooms: n })} />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={id("stotal")}>Sup. total (m²)</Label>
          <NumberInput id={id("stotal")} value={values.surfaceTotal} onChange={(n) => onChange({ surfaceTotal: n })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor={id("scov")}>Sup. cubierta (m²)</Label>
          <NumberInput id={id("scov")} value={values.surfaceCovered} onChange={(n) => onChange({ surfaceCovered: n })} />
        </div>
      </div>

      {/* Cochera + Urgencia + Financiación */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-2">
          <Label>Cochera</Label>
          <ChipGroup
            options={[
              { value: "si", label: "Sí" },
              { value: "no", label: "No" },
            ] as const}
            value={values.hasGarage === true ? "si" : values.hasGarage === false ? "no" : null}
            onChange={(v) => onChange({ hasGarage: v === "si" ? true : v === "no" ? false : null })}
          />
        </div>
        <div className="space-y-2">
          <Label>Urgencia</Label>
          <ChipGroup
            options={URGENCIES}
            value={values.urgency as "high" | "medium" | "low" | null}
            onChange={(v) => onChange({ urgency: v })}
          />
        </div>
        <div className="space-y-2">
          <Label>Financiación</Label>
          <ChipGroup
            options={FINANCINGS}
            value={values.financing as "contado" | "credito" | "mixto" | null}
            onChange={(v) => onChange({ financing: v })}
          />
        </div>
      </div>

      {/* Visita + plazo + referencia externa */}
      <div className="space-y-2">
        <Label>Visita</Label>
        <ChipGroup
          options={VISIT_STATUSES}
          value={values.visitStatus as "agendada" | "realizada" | "cancelada" | null}
          onChange={(v) => onChange({ visitStatus: v })}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={id("timeline")}>Plazo</Label>
          <Input
            id={id("timeline")}
            value={values.timeline ?? ""}
            onChange={(e) => onChange({ timeline: e.target.value || null })}
            placeholder="Ej: este mes, antes de fin de año"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={id("listingRef")}>Referencia externa</Label>
          <Input
            id={id("listingRef")}
            value={values.listingRef ?? ""}
            onChange={(e) => onChange({ listingRef: e.target.value || null })}
            placeholder="URL del aviso o código"
          />
        </div>
      </div>
    </div>
  );
}
