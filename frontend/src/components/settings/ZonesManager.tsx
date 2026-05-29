"use client";

import { useState, useTransition } from "react";
import { Map, MapPin, Pencil, Plus, Trash2, Loader2 } from "lucide-react";
import { createZone, deleteZone, updateZone } from "@/modules/agency/zones/actions";
import type { ZoneRecord } from "@/modules/agency/zones/types";
import { emitGlobalToast } from "@/lib/global-toast";
import { Button } from "@/components/ui/button";
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

export function ZonesManager({ initialZones }: { initialZones: ZoneRecord[] }) {
  const [list, setList] = useState<ZoneRecord[]>(initialZones);
  const [isPending, startTransition] = useTransition();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ZoneRecord | null>(null);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [notes, setNotes] = useState("");

  function openCreate() {
    setEditing(null);
    setName(""); setCity(""); setProvince(""); setNotes("");
    setOpen(true);
  }

  function openEdit(zone: ZoneRecord) {
    setEditing(zone);
    setName(zone.name);
    setCity(zone.city ?? "");
    setProvince(zone.province ?? "");
    setNotes(zone.notes ?? "");
    setOpen(true);
  }

  function save() {
    if (!name.trim()) {
      emitGlobalToast({ tone: "error", text: "Poné el nombre de la zona." });
      return;
    }
    const payload = { name: name.trim(), city, province, notes };
    startTransition(async () => {
      const res = editing ? await updateZone(editing.id, payload) : await createZone(payload);
      if (res.error || !res.data) {
        emitGlobalToast({ tone: "error", text: res.error ?? "No se pudo guardar." });
        return;
      }
      const saved = res.data;
      setList((prev) => {
        const next = editing
          ? prev.map((z) => (z.id === saved.id ? saved : z))
          : [...prev, saved];
        return next.sort((a, b) => a.name.localeCompare(b.name));
      });
      emitGlobalToast({ tone: "success", text: editing ? "Zona actualizada." : "Zona agregada." });
      setOpen(false);
    });
  }

  function remove(zone: ZoneRecord) {
    startTransition(async () => {
      const res = await deleteZone(zone.id);
      if (res.error) {
        emitGlobalToast({ tone: "error", text: res.error });
        return;
      }
      setList((prev) => prev.filter((z) => z.id !== zone.id));
      emitGlobalToast({ tone: "success", text: "Zona eliminada." });
    });
  }

  // Group zones by city for a friendly schema.
  const groupedByCity = list.reduce<Record<string, ZoneRecord[]>>((acc, z) => {
    const key = z.city || "Sin ciudad";
    (acc[key] ??= []).push(z);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-card/90">
        <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-primary/10 p-3 text-primary">
              <Map className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Zonas que cubre la agencia</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Cargá los barrios y áreas en los que operás. El agente las usa para clasificar leads y
                marcar como sospechosos los que pidan zonas que no cubrís.
              </p>
            </div>
          </div>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Agregar zona
          </Button>
        </CardContent>
      </Card>

      {/* Summary */}
      <Card className="bg-card/90">
        <CardContent className="pt-6">
          <p className="mb-4 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Resumen de cobertura
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <div className="rounded-2xl border border-[#2A1A0A]/10 bg-[#F5F0E8] p-4 text-center">
              <p className="text-2xl font-semibold">{list.length}</p>
              <p className="mt-1 text-xs font-medium text-muted-foreground">Zonas</p>
            </div>
            <div className="rounded-2xl border border-[#2A1A0A]/10 bg-[#F5F0E8] p-4 text-center">
              <p className="text-2xl font-semibold">{Object.keys(groupedByCity).filter((k) => k !== "Sin ciudad").length}</p>
              <p className="mt-1 text-xs font-medium text-muted-foreground">Ciudades</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Zones, grouped by city */}
      {list.length === 0 ? (
        <Card className="bg-card/90">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <MapPin className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Todavía no cargaste zonas. Agregá la primera para empezar.
            </p>
            <Button onClick={openCreate} variant="outline" className="border-[#2A1A0A]/15 bg-[#F5F0E8]">
              <Plus className="mr-2 h-4 w-4" />
              Agregar zona
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedByCity).map(([cityName, zones]) => (
            <Card key={cityName} className="bg-card/90">
              <CardContent className="pt-5">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <MapPin className="h-4 w-4 text-primary" />
                  {cityName}
                  <span className="text-xs font-normal text-muted-foreground">· {zones.length} zona{zones.length === 1 ? "" : "s"}</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {zones.map((zone) => (
                    <div
                      key={zone.id}
                      className="group flex items-start justify-between gap-2 rounded-2xl border border-[#2A1A0A]/15 bg-[#F5F0E8] p-4"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{zone.name}</p>
                        {zone.province ? (
                          <p className="text-xs text-muted-foreground">{zone.province}</p>
                        ) : null}
                        {zone.notes ? (
                          <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{zone.notes}</p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button size="icon" variant="ghost" className="h-7 w-7" disabled={isPending} onClick={() => openEdit(zone)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:text-red-600" disabled={isPending} onClick={() => remove(zone)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add / edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar zona" : "Agregar zona"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="zone-name">Nombre de la zona</Label>
              <Input
                id="zone-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Palermo, Recoleta, Tigre Centro"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="zone-city">Ciudad</Label>
                <Input
                  id="zone-city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="CABA"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="zone-province">Provincia</Label>
                <Input
                  id="zone-province"
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                  placeholder="Buenos Aires"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="zone-notes">Notas (opcional)</Label>
              <Textarea
                id="zone-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Detalles internos: comisión, partners, vendedor responsable…"
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
