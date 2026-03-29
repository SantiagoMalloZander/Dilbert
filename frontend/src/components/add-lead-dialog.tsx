"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const DEMO_COMPANY_ID = "11111111-1111-1111-1111-111111111111";
const DEMO_SELLER_ID = "22222222-2222-2222-2222-222222222222";

type FormState = {
  client_name: string;
  client_company: string;
  product_interest: string;
  estimated_amount: string;
  currency: string;
  status: string;
  sentiment: string;
  next_steps: string;
};

const EMPTY: FormState = {
  client_name: "",
  client_company: "",
  product_interest: "",
  estimated_amount: "",
  currency: "USD",
  status: "new",
  sentiment: "",
  next_steps: "",
};

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground mb-1.5">
      {children}
    </label>
  );
}

const selectCls =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring";

export function AddLeadDialog() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function set(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.client_name.trim()) {
      setError("El nombre del cliente es obligatorio.");
      return;
    }
    setLoading(true);
    setError("");

    const supabase = getSupabaseBrowserClient();
    const { error: err } = await supabase.from("leads").insert({
      company_id: DEMO_COMPANY_ID,
      seller_id: DEMO_SELLER_ID,
      client_name: form.client_name.trim(),
      client_company: form.client_company.trim() || null,
      product_interest: form.product_interest.trim() || null,
      estimated_amount: form.estimated_amount ? parseFloat(form.estimated_amount) : null,
      currency: form.currency || null,
      status: form.status,
      sentiment: form.sentiment || null,
      next_steps: form.next_steps.trim() || null,
      last_interaction: new Date().toISOString(),
    });

    setLoading(false);

    if (err) {
      setError(err.message);
    } else {
      setForm(EMPTY);
      setOpen(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium bg-[#D4420A] hover:bg-[#B83509] text-[#F5F0E8] transition-colors">
        <Plus size={14} />
        Agregar lead
      </DialogTrigger>

      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <p className="text-[9px] font-mono font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            CRM Manual
          </p>
          <DialogTitle className="font-heading text-2xl tracking-wide leading-none">
            NUEVO LEAD
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <FieldLabel>Nombre *</FieldLabel>
              <Input
                placeholder="Juan García"
                value={form.client_name}
                onChange={(e) => set("client_name", e.target.value)}
              />
            </div>
            <div>
              <FieldLabel>Empresa</FieldLabel>
              <Input
                placeholder="Acme S.A."
                value={form.client_company}
                onChange={(e) => set("client_company", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <FieldLabel>Producto / Servicio</FieldLabel>
              <Input
                placeholder="Software de facturación"
                value={form.product_interest}
                onChange={(e) => set("product_interest", e.target.value)}
              />
            </div>
            <div>
              <FieldLabel>Estado</FieldLabel>
              <select
                className={selectCls}
                value={form.status}
                onChange={(e) => set("status", e.target.value)}
              >
                <option value="new">Nuevo</option>
                <option value="contacted">Contactado</option>
                <option value="negotiating">Negociando</option>
                <option value="closed_won">Ganado</option>
                <option value="closed_lost">Perdido</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <FieldLabel>Monto estimado</FieldLabel>
              <Input
                type="number"
                min={0}
                placeholder="5000"
                value={form.estimated_amount}
                onChange={(e) => set("estimated_amount", e.target.value)}
              />
            </div>
            <div>
              <FieldLabel>Moneda</FieldLabel>
              <select
                className={selectCls}
                value={form.currency}
                onChange={(e) => set("currency", e.target.value)}
              >
                <option value="USD">USD</option>
                <option value="ARS">ARS</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <FieldLabel>Sentimiento</FieldLabel>
              <select
                className={selectCls}
                value={form.sentiment}
                onChange={(e) => set("sentiment", e.target.value)}
              >
                <option value="">Sin definir</option>
                <option value="positive">Positivo</option>
                <option value="neutral">Neutral</option>
                <option value="negative">Negativo</option>
              </select>
            </div>
            <div>
              <FieldLabel>Próximos pasos</FieldLabel>
              <Input
                placeholder="Enviar propuesta..."
                value={form.next_steps}
                onChange={(e) => set("next_steps", e.target.value)}
              />
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-600 font-mono">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md px-3 py-1.5 text-sm border border-border hover:bg-muted transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-md px-3 py-1.5 text-sm font-medium bg-[#D4420A] hover:bg-[#B83509] text-[#F5F0E8] transition-colors disabled:opacity-50"
            >
              {loading ? "Guardando..." : "Guardar lead"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
