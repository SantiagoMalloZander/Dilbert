"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Loader2, Filter, Plus, Phone } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PipelineStage } from "@/components/crm/PipelineStage";
import { Breadcrumbs } from "@/components/crm/Breadcrumbs";
import { LeadFormDialog } from "@/components/crm/LeadFormDialog";
import { AudioUploadDialog } from "@/components/crm/AudioUploadDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { emitGlobalToast } from "@/lib/global-toast";
import { cn } from "@/lib/utils";
import { moveLeadToStage } from "@/modules/crm/leads/actions";
import type { CrmSource, LeadBoardData, PipelineStageRecord } from "@/modules/crm/leads/types";

const LeadDetailPanel = dynamic(
  () => import("@/components/crm/LeadDetailPanel").then((module) => module.LeadDetailPanel),
  {
    ssr: false,
    loading: () => null,
  }
);

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

function getSourceLabel(source: CrmSource) {
  switch (source) {
    case "whatsapp":
      return "WhatsApp";
    case "gmail":
      return "Gmail";
    case "instagram":
      return "Instagram";
    case "zoom":
      return "Zoom";
    case "meet":
      return "Meet";
    case "import":
      return "Importado";
    default:
      return "Manual";
  }
}

export function KanbanBoard({ data }: { data: LeadBoardData }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [stages, setStages] = useState<PipelineStageRecord[]>(data.stages);
  const [createLeadOpen, setCreateLeadOpen] = useState(false);
  const [audioUploadOpen, setAudioUploadOpen] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const canDrag = data.currentUser.role === "owner" || data.currentUser.role === "vendor";

  // Server refreshes (realtime updates, post-move revalidation) deliver new
  // stage data; sync the optimistic local copy so the board reflects it.
  useEffect(() => {
    setStages(data.stages);
  }, [data.stages]);

  const summary = useMemo(() => {
    const leadCount = stages.reduce((sum, stage) => sum + stage.leadCount, 0);
    const totalValue = stages.reduce((sum, stage) => sum + stage.totalValue, 0);
    return { leadCount, totalValue };
  }, [stages]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (data.filters.assignedTo) count++;
    if (data.filters.source) count++;
    if (data.filters.createdFrom) count++;
    if (data.filters.createdTo) count++;
    if (data.filters.stageId) count++;
    return count;
  }, [data.filters]);

  const activeStage = data.filters.stageId
    ? stages.find((stage) => stage.id === data.filters.stageId) || null
    : null;

  const updateSearchParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());

    if (!value || value === "all") {
      params.delete(key);
    } else {
      params.set(key, value);
    }

    if (key !== "lead") {
      params.delete("lead");
    }

    startTransition(() => {
      router.replace(params.size ? `${pathname}?${params.toString()}` : pathname, {
        scroll: false,
      });
    });
  };

  const handleOpenLead = (leadId: string) => {
    updateSearchParam("lead", leadId);
  };

  const handleClearFilters = () => {
    startTransition(() => {
      router.replace(pathname, { scroll: false });
    });
  };

  // Native HTML5 drag & drop: click a card and drag it to another column.
  const handleDropOnStage = async (leadId: string, destStageId: string) => {
    setDraggingId(null);
    if (!canDrag) return;

    const sourceColumn = stages.find((stage) => stage.cards.some((card) => card.id === leadId));
    if (!sourceColumn || sourceColumn.id === destStageId) return;

    const previousStages = stages;
    const nextStages = stages.map((stage) => ({ ...stage, cards: [...stage.cards] }));
    const from = nextStages.find((stage) => stage.id === sourceColumn.id);
    const to = nextStages.find((stage) => stage.id === destStageId);
    if (!from || !to) return;

    const index = from.cards.findIndex((card) => card.id === leadId);
    if (index === -1) return;
    const [moved] = from.cards.splice(index, 1);
    to.cards.push({ ...moved, stageId: destStageId });

    nextStages.forEach((stage) => {
      stage.leadCount = stage.cards.length;
      stage.totalValue = stage.cards.reduce((sum, card) => sum + (card.value || 0), 0);
    });
    setStages(nextStages);

    const response = await moveLeadToStage({ leadId, stageId: destStageId });
    if (response.error) {
      setStages(previousStages);
      emitGlobalToast({ tone: "error", text: response.error });
      return;
    }
    router.refresh();
  };

  return (
    <>
      <div className="mb-6">
        <Breadcrumbs items={[{ label: "Pipeline", href: "/app/crm/leads" }]} />
      </div>
      <div className="space-y-5">
        <Card className="border-border bg-card shadow-panel">
          <CardContent className="p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">Pipeline</h1>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Arrastrá cada cliente a la columna según cómo viene. Tocá una tarjeta para ver el detalle.
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button variant="outline" onClick={() => setAudioUploadOpen(true)} className="rounded-xl">
                  <Phone className="mr-2 h-4 w-4" />
                  Cargar llamada
                </Button>
                {data.leadForm.canCreate && (
                  <Button
                    onClick={() => setCreateLeadOpen(true)}
                    disabled={!data.leadForm.pipelines.length}
                    className="rounded-xl shadow-sm transition-all active:scale-[0.98]"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Nuevo cliente
                  </Button>
                )}
              </div>
            </div>

            {/* Resumen suave */}
            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-2 rounded-full bg-muted px-3.5 py-1.5 text-sm">
                <span className="font-semibold text-foreground">{summary.leadCount}</span>
                <span className="text-muted-foreground">clientes</span>
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-muted px-3.5 py-1.5 text-sm">
                <span className="text-muted-foreground">Valor estimado</span>
                <span className="font-semibold text-foreground">{formatCurrency(summary.totalValue)}</span>
              </span>
              {activeStage ? (
                <span className="inline-flex items-center gap-2 rounded-full bg-[#D4420A]/[0.08] px-3.5 py-1.5 text-sm font-medium text-[#D4420A]">
                  Etapa: {activeStage.name}
                </span>
              ) : null}
            </div>

            {/* Filtros: una fila limpia */}
            <div className="mt-5 flex flex-wrap items-end gap-3">
              {data.currentUser.canManageAssigneeFilter ? (
                <div className="min-w-[180px] flex-1 space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Vendedor</Label>
                  <Select
                    value={data.filters.assignedTo || "all"}
                    onValueChange={(value) => updateSearchParam("assignedTo", value)}
                  >
                    <SelectTrigger className="w-full rounded-xl border-border bg-background">
                      <span className="flex-1 truncate text-left text-sm">
                        {data.assignees.find((a) => a.id === data.filters.assignedTo)?.name || "Todos"}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los vendedores</SelectItem>
                      {data.assignees.map((assignee) => (
                        <SelectItem key={assignee.id} value={assignee.id}>
                          {assignee.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              <div className="min-w-[150px] flex-1 space-y-1.5">
                <Label className="text-xs text-muted-foreground">Tipo de cliente</Label>
                <Select
                  value={data.filters.role || "all"}
                  onValueChange={(value) => updateSearchParam("role", value)}
                >
                  <SelectTrigger className="w-full rounded-xl border-border bg-background">
                    <span className="flex-1 truncate text-left text-sm">
                      {data.filters.role === "comprador"
                        ? "Compradores"
                        : data.filters.role === "vendedor"
                          ? "Vendedores"
                          : "Todos"}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="comprador">Compradores</SelectItem>
                    <SelectItem value="vendedor">Vendedores</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="min-w-[140px] flex-1 space-y-1.5">
                <Label className="text-xs text-muted-foreground">Desde</Label>
                <Input
                  type="date"
                  value={data.filters.createdFrom || ""}
                  onChange={(event) => updateSearchParam("createdFrom", event.target.value || null)}
                  className="rounded-xl border-border bg-background"
                />
              </div>
              <div className="min-w-[140px] flex-1 space-y-1.5">
                <Label className="text-xs text-muted-foreground">Hasta</Label>
                <Input
                  type="date"
                  value={data.filters.createdTo || ""}
                  onChange={(event) => updateSearchParam("createdTo", event.target.value || null)}
                  className="rounded-xl border-border bg-background"
                />
              </div>

              {activeFilterCount > 0 ? (
                <Button variant="ghost" onClick={handleClearFilters} className="rounded-xl text-muted-foreground">
                  {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Filter className="mr-2 h-4 w-4" />}
                  Limpiar
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <div className={cn("overflow-x-auto pb-4", isPending && "opacity-80")}>
          <div className="flex min-w-max gap-3">
            {stages.map((stage) => (
              <PipelineStage
                key={stage.id}
                stage={stage}
                canDrag={canDrag}
                onOpenLead={handleOpenLead}
                draggingId={draggingId}
                onDragStartLead={setDraggingId}
                onDragEndLead={() => setDraggingId(null)}
                onDropLead={handleDropOnStage}
              />
            ))}
          </div>
        </div>
      </div>

      <LeadDetailPanel
        key={data.selectedLead ? `${data.selectedLead.id}:${data.selectedLead.updatedAt}` : "lead-panel"}
        lead={data.selectedLead}
      />

      <LeadFormDialog
        open={createLeadOpen}
        onOpenChange={setCreateLeadOpen}
        pipelines={data.leadForm.pipelines}
        assignees={data.assignees}
        isOwner={data.currentUser.role === "owner"}
      />

      <AudioUploadDialog
        open={audioUploadOpen}
        onClose={() => setAudioUploadOpen(false)}
      />
    </>
  );
}

export function KanbanBoardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card/90 p-6">
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-3">
            <div className="h-6 w-28 animate-pulse rounded-full bg-card/10" />
            <div className="h-10 w-72 animate-pulse rounded-xl bg-card/10" />
            <div className="h-4 w-full max-w-xl animate-pulse rounded-full bg-card/10" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="h-24 animate-pulse rounded-xl bg-card/10" />
            <div className="h-24 animate-pulse rounded-xl bg-card/10" />
          </div>
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-14 animate-pulse rounded-xl bg-card/10" />
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="flex min-w-max gap-4">
          {Array.from({ length: 4 }).map((_, stageIndex) => (
            <div
              key={stageIndex}
              className="flex min-h-[70vh] w-[320px] shrink-0 flex-col rounded-xl border border-border bg-card/90 p-4"
            >
              <div className="h-6 w-32 animate-pulse rounded-full bg-card/10" />
              <div className="mt-2 h-4 w-20 animate-pulse rounded-full bg-card/10" />
              <div className="mt-6 space-y-3">
                {Array.from({ length: 3 }).map((__, cardIndex) => (
                  <div key={cardIndex} className="h-36 animate-pulse rounded-xl bg-card/10" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
