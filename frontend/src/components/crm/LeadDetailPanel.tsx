"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  CalendarClock,
  CheckCircle2,
  CircleOff,
  Clock3,
  ExternalLink,
  FilePenLine,
  Loader2,
  MessageSquarePlus,
  Milestone,
  NotebookPen,
  X,
} from "lucide-react";
import {
  addLeadActivity,
  addLeadNote,
  markLeadAsLost,
  markLeadAsWon,
  moveLeadToStage,
  updateLead,
} from "@/modules/crm/leads/actions";
import type {
  ActivityType,
  CrmSource,
  LeadDetailRecord,
  LeadStageOption,
} from "@/modules/crm/leads/types";
import { emitGlobalToast } from "@/lib/global-toast";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const SOURCE_OPTIONS: Array<{ value: CrmSource; label: string }> = [
  { value: "manual", label: "Manual" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "gmail", label: "Gmail" },
  { value: "instagram", label: "Instagram" },
  { value: "zoom", label: "Zoom" },
  { value: "meet", label: "Meet" },
  { value: "import", label: "Importado" },
];

const ACTIVITY_OPTIONS: Array<{ value: ActivityType; label: string }> = [
  { value: "call", label: "Llamada" },
  { value: "email", label: "Email" },
  { value: "meeting", label: "Reunión" },
  { value: "task", label: "Tarea" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "instagram", label: "Instagram" },
  { value: "note", label: "Nota" },
];

function formatCurrency(value: number | null, currency: string) {
  if (value == null) {
    return "Sin valor";
  }

  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function getStageTone(stage: LeadStageOption | null) {
  if (!stage) {
    return "border-[#2A1A0A]/15 bg-white/5 text-[#d8e4f2]";
  }

  if (stage.isWonStage) {
    return "border-emerald-400/30 bg-emerald-500/10 text-emerald-100";
  }

  if (stage.isLostStage) {
    return "border-red-400/30 bg-red-500/10 text-red-100";
  }

  return "border-[#2A1A0A]/15 bg-white/5 text-[#d8e4f2]";
}

export function LeadDetailPanel({
  lead,
}: {
  lead: LeadDetailRecord | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isNoteOpen, setIsNoteOpen] = useState(false);
  const [isActivityOpen, setIsActivityOpen] = useState(false);
  const [isStageOpen, setIsStageOpen] = useState(false);
  const [isLostOpen, setIsLostOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    title: lead?.title || "",
    value: lead?.value == null ? "" : String(lead.value),
    probability: String(lead?.probability || 0),
    expectedCloseDate: lead?.expectedCloseDate || "",
    source: (lead?.source || "manual") as CrmSource,
  });
  const [noteContent, setNoteContent] = useState("");
  const [activityForm, setActivityForm] = useState({
    type: "call" as ActivityType,
    title: "",
    description: "",
    scheduledAt: "",
  });
  const [stageId, setStageId] = useState(lead?.stage?.id || "");
  const [lostReason, setLostReason] = useState("");

  if (!lead) {
    return null;
  }

  const closePanel = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("lead");
    startTransition(() => {
      router.replace(params.size ? `${pathname}?${params.toString()}` : pathname, {
        scroll: false,
      });
    });
  };

  const refreshView = () => {
    startTransition(() => {
      router.refresh();
    });
  };

  const handleEditLead = async () => {
    const response = await updateLead({
      leadId: lead.id,
      title: editForm.title,
      contactId: lead.contact.id,
      value: editForm.value.trim() ? Number(editForm.value) : null,
      currency: lead.currency,
      probability: Number(editForm.probability),
      expectedCloseDate: editForm.expectedCloseDate || null,
      pipelineId: lead.pipelineId,
      stageId: lead.stage?.id || stageId,
      assignedTo: lead.assignedUser?.id || null,
      source: editForm.source,
    });

    if (response.error) {
      emitGlobalToast({ tone: "error", text: response.error });
      return;
    }

    setIsEditOpen(false);
    emitGlobalToast({ tone: "success", text: "Lead actualizado." });
    refreshView();
  };

  const handleAddNote = async () => {
    const response = await addLeadNote({
      leadId: lead.id,
      content: noteContent,
    });

    if (response.error) {
      emitGlobalToast({ tone: "error", text: response.error });
      return;
    }

    setIsNoteOpen(false);
    setNoteContent("");
    emitGlobalToast({ tone: "success", text: "Nota agregada." });
    refreshView();
  };

  const handleAddActivity = async () => {
    const response = await addLeadActivity({
      leadId: lead.id,
      type: activityForm.type,
      title: activityForm.title,
      description: activityForm.description || null,
      scheduledAt: activityForm.scheduledAt || null,
    });

    if (response.error) {
      emitGlobalToast({ tone: "error", text: response.error });
      return;
    }

    setIsActivityOpen(false);
    emitGlobalToast({ tone: "success", text: "Actividad registrada." });
    refreshView();
  };

  const handleStageChange = async () => {
    const response = await moveLeadToStage({
      leadId: lead.id,
      stageId,
    });

    if (response.error) {
      emitGlobalToast({ tone: "error", text: response.error });
      return;
    }

    setIsStageOpen(false);
    emitGlobalToast({ tone: "success", text: "Etapa actualizada." });
    refreshView();
  };

  const handleMarkWon = async () => {
    const response = await markLeadAsWon(lead.id);

    if (response.error) {
      emitGlobalToast({ tone: "error", text: response.error });
      return;
    }

    emitGlobalToast({ tone: "success", text: "Lead marcado como ganado." });
    refreshView();
  };

  const handleMarkLost = async () => {
    const response = await markLeadAsLost({
      leadId: lead.id,
      lostReason,
    });

    if (response.error) {
      emitGlobalToast({ tone: "error", text: response.error });
      return;
    }

    setIsLostOpen(false);
    setLostReason("");
    emitGlobalToast({ tone: "success", text: "Lead marcado como perdido." });
    refreshView();
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-[#030712]/45 backdrop-blur-[2px]" onClick={closePanel} />
      <aside className="fixed right-0 top-0 z-50 flex h-screen w-full max-w-[560px] flex-col border-l border-[#2A1A0A]/15 bg-background text-foreground shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_30px_80px_rgba(2,6,23,0.55)]">
        <div className="border-b border-[#2A1A0A]/10 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-3">
              <Badge className={getStageTone(lead.stage)}>{lead.stage?.name || "Sin etapa"}</Badge>
              <div>
                <h2 className="text-2xl font-semibold leading-tight">{lead.title}</h2>
                <button
                  onClick={() => router.push(`/app/crm/contacts?contactId=${lead.contact.id}`)}
                  className="mt-1 flex items-center gap-1.5 text-sm text-[#D4420A] hover:text-[#D4420A]/80 transition-colors"
                >
                  {lead.contact.name}
                  <ExternalLink className="h-3 w-3" />
                </button>
              </div>
            </div>
            <Button variant="ghost" size="icon-sm" className="text-white" onClick={closePanel}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-2xl border border-[#2A1A0A]/15 bg-white/5 p-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Valor</p>
              <p className="mt-2 text-lg font-semibold">{formatCurrency(lead.value, lead.currency)}</p>
            </div>
            <div className="rounded-2xl border border-[#2A1A0A]/15 bg-white/5 p-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Probabilidad</p>
              <p className="mt-2 text-lg font-semibold">{lead.probability}%</p>
            </div>
          </div>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              <CalendarClock className="h-3.5 w-3.5" />
              Datos del lead
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                onClick={() => router.push(`/app/crm/contacts?contactId=${lead.contact.id}`)}
                className="group rounded-2xl border border-[#2A1A0A]/15 bg-white/5 p-4 text-left transition-all hover:border-[#D4420A]/30 hover:bg-[#D4420A]/5"
              >
                <p className="text-xs text-muted-foreground">Contacto</p>
                <p className="mt-2 font-medium flex items-center gap-1.5 text-foreground group-hover:text-[#D4420A]">
                  {lead.contact.name}
                  <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100" />
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{lead.contact.companyName || "Sin empresa"}</p>
              </button>
              <div className="rounded-2xl border border-[#2A1A0A]/15 bg-white/5 p-4">
                <p className="text-xs text-muted-foreground">Cierre esperado</p>
                <p className="mt-2 font-medium">
                  {lead.expectedCloseDate ? formatDate(lead.expectedCloseDate) : "Sin fecha"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">Fuente: {lead.source}</p>
              </div>
              <div className="rounded-2xl border border-[#2A1A0A]/15 bg-white/5 p-4">
                <p className="text-xs text-muted-foreground">Vendedor asignado</p>
                <p className="mt-2 font-medium">{lead.assignedUser?.name || "Sin asignar"}</p>
              </div>
              <div className="rounded-2xl border border-[#2A1A0A]/15 bg-white/5 p-4">
                <p className="text-xs text-muted-foreground">Estado</p>
                <p className="mt-2 font-medium capitalize">{lead.status}</p>
                {lead.lostReason ? (
                  <p className="mt-1 text-sm text-[#f8b4b4]">{lead.lostReason}</p>
                ) : null}
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button disabled={!lead.permissions.canEdit || isPending} onClick={() => setIsEditOpen(true)}>
                <FilePenLine className="mr-2 h-4 w-4" />
                Editar lead
              </Button>
              <Button
                variant="outline"
                disabled={!lead.permissions.canEdit || isPending}
                onClick={() => setIsNoteOpen(true)}
                className="border-[#2A1A0A]/15 bg-white/5 text-foreground"
              >
                <NotebookPen className="mr-2 h-4 w-4" />
                Añadir nota
              </Button>
              <Button
                variant="outline"
                disabled={!lead.permissions.canEdit || isPending}
                onClick={() => setIsActivityOpen(true)}
                className="border-[#2A1A0A]/15 bg-white/5 text-foreground"
              >
                <MessageSquarePlus className="mr-2 h-4 w-4" />
                Añadir actividad
              </Button>
              <Button
                variant="outline"
                disabled={!lead.permissions.canEdit || isPending}
                onClick={() => setIsStageOpen(true)}
                className="border-[#2A1A0A]/15 bg-white/5 text-foreground"
              >
                <Milestone className="mr-2 h-4 w-4" />
                Cambiar stage
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                disabled={!lead.permissions.canMarkOutcome || isPending}
                onClick={handleMarkWon}
                className="bg-emerald-500 text-[#06131f] hover:bg-emerald-400"
              >
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                Marcar como Ganado
              </Button>
              <Button
                variant="outline"
                disabled={!lead.permissions.canMarkOutcome || isPending}
                onClick={() => setIsLostOpen(true)}
                className="border-red-400/30 bg-red-500/10 text-red-100 hover:bg-red-500/15"
              >
                <CircleOff className="mr-2 h-4 w-4" />
                Marcar como Perdido
              </Button>
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              <Clock3 className="h-3.5 w-3.5" />
              Timeline
            </div>
            <div className="space-y-3">
              {lead.timeline.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#2A1A0A]/15 px-4 py-5 text-sm text-muted-foreground">
                  Todavía no hay actividades registradas.
                </div>
              ) : (
                lead.timeline.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-[#2A1A0A]/15 bg-white/5 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">{item.title}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                          {item.type} · {item.user?.name || "Usuario"} · {formatDate(item.createdAt)}
                        </p>
                      </div>
                      <Badge className="border border-[#2A1A0A]/15 bg-transparent text-[#d8e4f2]">
                        {item.source}
                      </Badge>
                    </div>
                    {item.description ? (
                      <p className="mt-3 text-sm text-[#c3d3e8]">{item.description}</p>
                    ) : null}
                    {item.scheduledAt ? (
                      <p className="mt-3 text-xs text-muted-foreground">
                        Programada para {formatDate(item.scheduledAt)}
                      </p>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="space-y-3 pb-4">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              <NotebookPen className="h-3.5 w-3.5" />
              Notas
            </div>
            <div className="space-y-3">
              {lead.notes.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#2A1A0A]/15 px-4 py-5 text-sm text-muted-foreground">
                  Todavía no hay notas asociadas.
                </div>
              ) : (
                lead.notes.map((note) => (
                  <div key={note.id} className="rounded-2xl border border-[#2A1A0A]/15 bg-white/5 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                        {note.user?.name || "Usuario"} · {formatDate(note.createdAt)}
                      </p>
                      <Badge className="border border-[#2A1A0A]/15 bg-transparent text-[#d8e4f2]">
                        {note.source}
                      </Badge>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm text-[#e6eef8]">{note.content}</p>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </aside>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="border-[3px] border-[#2A1A0A] bg-[#F5F0E8] text-[#1A1A1A] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar lead</DialogTitle>
            <DialogDescription>Actualizá la información principal de la oportunidad.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="lead-title">Título</Label>
              <Input
                id="lead-title"
                value={editForm.title}
                onChange={(event) =>
                  setEditForm((current) => ({ ...current, title: event.target.value }))
                }
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="lead-value">Valor</Label>
                <Input
                  id="lead-value"
                  type="number"
                  value={editForm.value}
                  onChange={(event) =>
                    setEditForm((current) => ({ ...current, value: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lead-probability">Probabilidad</Label>
                <Input
                  id="lead-probability"
                  type="number"
                  min="0"
                  max="100"
                  value={editForm.probability}
                  onChange={(event) =>
                    setEditForm((current) => ({ ...current, probability: event.target.value }))
                  }
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="lead-close-date">Cierre esperado</Label>
                <Input
                  id="lead-close-date"
                  type="date"
                  value={editForm.expectedCloseDate}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      expectedCloseDate: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Fuente</Label>
                <Select
                  value={editForm.source}
                  onValueChange={(value) =>
                    setEditForm((current) => ({ ...current, source: value as CrmSource }))
                  }
                >
                  <SelectTrigger className="w-full bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SOURCE_OPTIONS.map((source) => (
                      <SelectItem key={source.value} value={source.value}>
                        {source.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancelar
            </Button>
            <Button disabled={isPending} onClick={handleEditLead}>
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Guardar cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isNoteOpen} onOpenChange={setIsNoteOpen}>
        <DialogContent className="border-[3px] border-[#2A1A0A] bg-[#F5F0E8] text-[#1A1A1A] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Añadir nota</DialogTitle>
            <DialogDescription>Guardá contexto útil para el resto del equipo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="lead-note">Nota</Label>
            <textarea
              id="lead-note"
              value={noteContent}
              onChange={(event) => setNoteContent(event.target.value)}
              className="min-h-36 w-full rounded-lg border border-input bg-white px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNoteOpen(false)}>
              Cancelar
            </Button>
            <Button disabled={isPending} onClick={handleAddNote}>
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Guardar nota
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isActivityOpen} onOpenChange={setIsActivityOpen}>
        <DialogContent className="border-[3px] border-[#2A1A0A] bg-[#F5F0E8] text-[#1A1A1A] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Añadir actividad</DialogTitle>
            <DialogDescription>Agendá o registrá una interacción del lead.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={activityForm.type}
                onValueChange={(value) =>
                  setActivityForm((current) => ({ ...current, type: value as ActivityType }))
                }
              >
                <SelectTrigger className="w-full bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTIVITY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="activity-title">Título</Label>
              <Input
                id="activity-title"
                value={activityForm.title}
                onChange={(event) =>
                  setActivityForm((current) => ({ ...current, title: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="activity-description">Descripción</Label>
              <textarea
                id="activity-description"
                value={activityForm.description}
                onChange={(event) =>
                  setActivityForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                className="min-h-28 w-full rounded-lg border border-input bg-white px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="activity-scheduled-at">Fecha y hora</Label>
              <Input
                id="activity-scheduled-at"
                type="datetime-local"
                value={activityForm.scheduledAt}
                onChange={(event) =>
                  setActivityForm((current) => ({
                    ...current,
                    scheduledAt: event.target.value,
                  }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsActivityOpen(false)}>
              Cancelar
            </Button>
            <Button disabled={isPending} onClick={handleAddActivity}>
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Guardar actividad
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isStageOpen} onOpenChange={setIsStageOpen}>
        <DialogContent className="border-[3px] border-[#2A1A0A] bg-[#F5F0E8] text-[#1A1A1A] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cambiar stage</DialogTitle>
            <DialogDescription>Mové esta oportunidad a otra etapa del pipeline.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Etapa</Label>
            <Select value={stageId} onValueChange={(value) => setStageId(value || stageId)}>
              <SelectTrigger className="w-full bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {lead.stageOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsStageOpen(false)}>
              Cancelar
            </Button>
            <Button disabled={isPending || !stageId} onClick={handleStageChange}>
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Cambiar etapa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isLostOpen} onOpenChange={setIsLostOpen}>
        <DialogContent className="border-[3px] border-[#2A1A0A] bg-[#F5F0E8] text-[#1A1A1A] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Marcar como perdido</DialogTitle>
            <DialogDescription>Indicá por qué se cayó la oportunidad.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="lost-reason">Razón de pérdida</Label>
            <textarea
              id="lost-reason"
              value={lostReason}
              onChange={(event) => setLostReason(event.target.value)}
              className="min-h-28 w-full rounded-lg border border-input bg-white px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsLostOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={isPending || !lostReason.trim()}
              onClick={handleMarkLost}
              className="bg-red-500 text-white hover:bg-red-400"
            >
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirmar pérdida
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
