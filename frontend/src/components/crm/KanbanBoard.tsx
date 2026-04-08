"use client";

import dynamic from "next/dynamic";
import { useMemo, useState, useTransition } from "react";
import { DragDropContext, type DropResult } from "@hello-pangea/dnd";
import { FilterX, Loader2, Plus, Sparkles } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PipelineStage } from "@/components/crm/PipelineStage";
import { Breadcrumbs } from "@/components/crm/Breadcrumbs";
import { LeadFormDialog } from "@/components/crm/LeadFormDialog";
import { Button } from "@/components/ui/button";
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

  const canDrag = data.currentUser.role === "owner" || data.currentUser.role === "vendor";

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

  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination || destination.droppableId === source.droppableId) {
      return;
    }

    const previousStages = stages;
    const nextStages = stages.map((stage) => ({
      ...stage,
      cards: [...stage.cards],
    }));
    const sourceColumn = nextStages.find((stage) => stage.id === source.droppableId);
    const destinationColumn = nextStages.find((stage) => stage.id === destination.droppableId);

    if (!sourceColumn || !destinationColumn) {
      return;
    }

    const [movedLead] = sourceColumn.cards.splice(source.index, 1);
    if (!movedLead) {
      return;
    }

    destinationColumn.cards.splice(destination.index, 0, {
      ...movedLead,
      stageId: destination.droppableId,
    });

    nextStages.forEach((stage) => {
      stage.leadCount = stage.cards.length;
      stage.totalValue = stage.cards.reduce((sum, card) => sum + (card.value || 0), 0);
    });

    setStages(nextStages);

    const response = await moveLeadToStage({
      leadId: draggableId,
      stageId: destination.droppableId,
    });

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
      <div className="space-y-6">
        <div className="rounded-[30px] border border-[#2A1A0A]/15 bg-background p-6 text-foreground shadow-hard">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#D4420A]/20 bg-[#D4420A]/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-foreground">
                <Sparkles className="h-3.5 w-3.5" />
                Pipeline activo
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight">{data.pipeline.name}</h1>
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                  Mové oportunidades entre etapas, abrí el detalle lateral y actualizá el estado sin salir del board.
                </p>
                {activeStage ? (
                  <p className="mt-3 text-xs uppercase tracking-[0.18em] text-foreground">
                    Filtrado por etapa: {activeStage.name}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[360px]">
              <div className="rounded-2xl border border-[#2A1A0A]/15 bg-[#F5F0E8] px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Leads visibles</p>
                <p className="mt-2 text-2xl font-semibold">{summary.leadCount}</p>
              </div>
              <div className="rounded-2xl border border-[#2A1A0A]/15 bg-[#F5F0E8] px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Valor total</p>
                <p className="mt-2 text-2xl font-semibold">{formatCurrency(summary.totalValue)}</p>
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-foreground">Filtros</h3>
                {activeFilterCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[#D4420A]/30 bg-[#D4420A]/10 px-2.5 py-0.5 text-xs font-medium text-[#D4420A]">
                    {activeFilterCount} activo{activeFilterCount !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
              {data.leadForm.canCreate && (
                <Button
                  size="sm"
                  onClick={() => setCreateLeadOpen(true)}
                  disabled={!data.leadForm.pipelines.length}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  CREAR LEAD
                </Button>
              )}
            </div>
            <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr_1fr_auto]">
              {data.currentUser.canManageAssigneeFilter ? (
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Vendedor</Label>
                <Select
                  value={data.filters.assignedTo || "all"}
                  onValueChange={(value) => updateSearchParam("assignedTo", value)}
                >
                  <SelectTrigger className="w-full border-[#2A1A0A]/15 bg-[#F5F0E8] text-foreground">
                    <SelectValue />
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

            <div className="space-y-2">
              <Label className="text-muted-foreground">Fuente</Label>
              <Select
                value={data.filters.source || "all"}
                onValueChange={(value) => updateSearchParam("source", value)}
              >
                <SelectTrigger className="w-full border-[#2A1A0A]/15 bg-[#F5F0E8] text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las fuentes</SelectItem>
                  {data.sources.map((source) => (
                    <SelectItem key={source} value={source}>
                      {getSourceLabel(source)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-muted-foreground">Desde</Label>
                <Input
                  type="date"
                  value={data.filters.createdFrom || ""}
                  onChange={(event) => updateSearchParam("createdFrom", event.target.value || null)}
                  className="border-[#2A1A0A]/15 bg-[#F5F0E8] text-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Hasta</Label>
                <Input
                  type="date"
                  value={data.filters.createdTo || ""}
                  onChange={(event) => updateSearchParam("createdTo", event.target.value || null)}
                  className="border-[#2A1A0A]/15 bg-[#F5F0E8] text-foreground"
                />
              </div>
            </div>

              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={handleClearFilters}
                  className="w-full border-[#2A1A0A]/15 bg-[#F5F0E8] text-foreground hover:border-[#D4420A] hover:bg-[#D4420A]/10 hover:text-foreground"
                >
                  {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FilterX className="mr-2 h-4 w-4" />}
                  Limpiar
                </Button>
              </div>
            </div>
            </div>
        </div>

        <DragDropContext onDragEnd={handleDragEnd}>
          <div className={cn("overflow-x-auto pb-4", isPending && "opacity-80")}>
            <div className="flex min-w-max gap-4">
              {stages.map((stage) => (
                <PipelineStage
                  key={stage.id}
                  stage={stage}
                  canDrag={canDrag}
                  onOpenLead={handleOpenLead}
                />
              ))}
            </div>
          </div>
        </DragDropContext>
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
    </>
  );
}

export function KanbanBoardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-[30px] border border-[#2A1A0A]/15 bg-background p-6">
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-3">
            <div className="h-6 w-28 animate-pulse rounded-full bg-[#F5F0E8]/8" />
            <div className="h-10 w-72 animate-pulse rounded-2xl bg-[#F5F0E8]/8" />
            <div className="h-4 w-full max-w-xl animate-pulse rounded-full bg-[#F5F0E8]/8" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="h-24 animate-pulse rounded-2xl bg-[#F5F0E8]/8" />
            <div className="h-24 animate-pulse rounded-2xl bg-[#F5F0E8]/8" />
          </div>
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-14 animate-pulse rounded-2xl bg-[#F5F0E8]/8" />
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="flex min-w-max gap-4">
          {Array.from({ length: 4 }).map((_, stageIndex) => (
            <div
              key={stageIndex}
              className="flex min-h-[70vh] w-[320px] shrink-0 flex-col rounded-[28px] border border-[#2A1A0A]/15 bg-background p-4"
            >
              <div className="h-6 w-32 animate-pulse rounded-full bg-[#F5F0E8]/8" />
              <div className="mt-2 h-4 w-20 animate-pulse rounded-full bg-[#F5F0E8]/8" />
              <div className="mt-6 space-y-3">
                {Array.from({ length: 3 }).map((__, cardIndex) => (
                  <div key={cardIndex} className="h-36 animate-pulse rounded-[22px] bg-[#F5F0E8]/8" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
