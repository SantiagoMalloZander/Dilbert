"use client";

import { useMemo, useState, useTransition } from "react";
import { Building2, Pencil, Plus, ShieldCheck, Trash2, Loader2 } from "lucide-react";
import {
  createProvider,
  deleteProvider,
  updateProvider,
} from "@/modules/insurance/providers/actions";
import {
  CATEGORY_LABELS,
  INSURANCE_CATEGORIES,
  type ProviderRecord,
} from "@/modules/insurance/providers/types";
import { emitGlobalToast } from "@/lib/global-toast";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const CATEGORY_TONE: Record<string, string> = {
  auto: "border-blue-400/40 bg-blue-500/10 text-blue-700",
  hogar: "border-violet-400/40 bg-violet-500/10 text-violet-700",
  vida: "border-emerald-400/40 bg-emerald-500/10 text-emerald-700",
  salud: "border-rose-400/40 bg-rose-500/10 text-rose-700",
  comercial: "border-amber-400/40 bg-amber-500/10 text-amber-700",
  art: "border-orange-400/40 bg-orange-500/10 text-orange-700",
  caucion: "border-teal-400/40 bg-teal-500/10 text-teal-700",
  responsabilidad_civil: "border-indigo-400/40 bg-indigo-500/10 text-indigo-700",
  otros: "border-zinc-400/40 bg-zinc-500/10 text-zinc-700",
};

function CategoryBadge({ category }: { category: string }) {
  return (
    <Badge className={cn("font-medium", CATEGORY_TONE[category] ?? CATEGORY_TONE.otros)}>
      {CATEGORY_LABELS[category] ?? category}
    </Badge>
  );
}

export function ProvidersManager({ initialProviders }: { initialProviders: ProviderRecord[] }) {
  const [list, setList] = useState<ProviderRecord[]>(initialProviders);
  const [isPending, startTransition] = useTransition();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProviderRecord | null>(null);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  // Coverage overview: how many carriers cover each category.
  const coverage = useMemo(() => {
    return INSURANCE_CATEGORIES.map((cat) => ({
      category: cat,
      count: list.filter((p) => p.categories.includes(cat)).length,
    }));
  }, [list]);

  function openCreate() {
    setEditing(null);
    setName("");
    setSelected([]);
    setNotes("");
    setOpen(true);
  }

  function openEdit(provider: ProviderRecord) {
    setEditing(provider);
    setName(provider.name);
    setSelected(provider.categories);
    setNotes(provider.notes ?? "");
    setOpen(true);
  }

  function toggleCategory(cat: string) {
    setSelected((prev) => (prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]));
  }

  function save() {
    if (!name.trim()) {
      emitGlobalToast({ tone: "error", text: "Poné el nombre de la aseguradora." });
      return;
    }
    const payload = { name: name.trim(), categories: selected, notes };
    startTransition(async () => {
      const res = editing
        ? await updateProvider(editing.id, payload)
        : await createProvider(payload);
      if (res.error || !res.data) {
        emitGlobalToast({ tone: "error", text: res.error ?? "No se pudo guardar." });
        return;
      }
      const saved = res.data;
      setList((prev) => {
        const next = editing
          ? prev.map((p) => (p.id === saved.id ? saved : p))
          : [...prev, saved];
        return next.sort((a, b) => a.name.localeCompare(b.name));
      });
      emitGlobalToast({ tone: "success", text: editing ? "Aseguradora actualizada." : "Aseguradora agregada." });
      setOpen(false);
    });
  }

  function remove(provider: ProviderRecord) {
    startTransition(async () => {
      const res = await deleteProvider(provider.id);
      if (res.error) {
        emitGlobalToast({ tone: "error", text: res.error });
        return;
      }
      setList((prev) => prev.filter((p) => p.id !== provider.id));
      emitGlobalToast({ tone: "success", text: "Aseguradora eliminada." });
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-card/90">
        <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-primary/10 p-3 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Aseguradoras</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Cargá las compañías con las que trabajás y marcá qué ramos cubre cada una.
              </p>
            </div>
          </div>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Agregar aseguradora
          </Button>
        </CardContent>
      </Card>

      {/* Coverage overview */}
      <Card className="bg-card/90">
        <CardContent className="pt-6">
          <p className="mb-4 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Cobertura por ramo
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {coverage.map((c) => (
              <div
                key={c.category}
                className={cn(
                  "rounded-2xl border p-4 text-center",
                  c.count > 0 ? CATEGORY_TONE[c.category] : "border-[#2A1A0A]/10 bg-[#F5F0E8] text-muted-foreground"
                )}
              >
                <p className="text-2xl font-semibold">{c.count}</p>
                <p className="mt-1 text-xs font-medium">{CATEGORY_LABELS[c.category]}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Providers grid */}
      {list.length === 0 ? (
        <Card className="bg-card/90">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Building2 className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Todavía no cargaste aseguradoras. Agregá la primera para empezar.
            </p>
            <Button onClick={openCreate} variant="outline" className="border-[#2A1A0A]/15 bg-[#F5F0E8]">
              <Plus className="mr-2 h-4 w-4" />
              Agregar aseguradora
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((provider) => (
            <Card key={provider.id} className="group bg-card/90">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-sm font-semibold text-primary">
                      {provider.name.slice(0, 2).toUpperCase()}
                    </div>
                    <p className="truncate text-base font-semibold">{provider.name}</p>
                  </div>
                  <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      disabled={isPending}
                      onClick={() => openEdit(provider)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-red-500 hover:text-red-600"
                      disabled={isPending}
                      onClick={() => remove(provider)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-1.5">
                  {provider.categories.length === 0 ? (
                    <span className="text-xs text-muted-foreground">Sin ramos asignados</span>
                  ) : (
                    provider.categories.map((cat) => <CategoryBadge key={cat} category={cat} />)
                  )}
                </div>

                {provider.notes ? (
                  <p className="mt-3 line-clamp-2 text-xs text-muted-foreground">{provider.notes}</p>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add / edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar aseguradora" : "Agregar aseguradora"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="provider-name">Nombre</Label>
              <Input
                id="provider-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Sancor Seguros"
              />
            </div>

            <div className="space-y-2">
              <Label>Ramos que cubre</Label>
              <div className="flex flex-wrap gap-2">
                {INSURANCE_CATEGORIES.map((cat) => {
                  const active = selected.includes(cat);
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => toggleCategory(cat)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                        active
                          ? CATEGORY_TONE[cat]
                          : "border-[#2A1A0A]/15 bg-[#F5F0E8] text-muted-foreground hover:border-[#D4420A]/30"
                      )}
                    >
                      {CATEGORY_LABELS[cat]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="provider-notes">Notas (opcional)</Label>
              <Textarea
                id="provider-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Contacto del productor, condiciones, comisiones…"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} className="border-[#2A1A0A]/15 bg-[#F5F0E8]">
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
