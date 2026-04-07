"use client";

import dynamic from "next/dynamic";
import { useMemo, useState, useTransition } from "react";
import { DragDropContext, type DropResult } from "@hello-pangea/dnd";
import { FilterX, Loader2, Sparkles } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PipelineStage } from "@/components/crm/PipelineStage";
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

  const canDrag = data.currentUser.role === "owner" || data.currentUser.role === "vendor";

  const summary = useMemo(() => {
    const leadCount = stages.reduce((sum, stage) => sum + stage.leadCount, 0);
    const totalValue = stages.reduce((sum, stage) => sum + stage.totalValue, 0);
    return { leadCount, totalValue };
  }, [stages]);
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
      <div className="space-y-6">
        <div className="rounded-[30px] border border-white/10 bg-[#07101b] p-6 text-[#f8fafc] shadow-[0_22px_60px_rgba(2,6,23,0.3)]">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#35d6ae]/20 bg-[#35d6ae]/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[#9fe9d5]">
                <Sparkles className="h-3.5 w-3.5" />
                Pipeline activo
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight">{data.pipeline.name}</h1>
                <p className="mt-2 max-w-2xl text-sm text-[#9fb0c8]">
                  Mové oportunidades entre etapas, abrí el detalle lateral y actualizá el estado sin salir del board.
                </p>
                {activeStage ? (
                  <p className="mt-3 text-xs uppercase tracking-[0.18em] text-[#9fe9d5]">
                    Filtrado por etapa: {activeStage.name}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[360px]">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.16em] text-[#6f85a3]">Leads visibles</p>
                <p className="mt-2 text-2xl font-semibold">{summary.leadCount}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.16em] text-[#6f85a3]">Valor total</p>
                <p className="mt-2 text-2xl font-semibold">{formatCurrency(summary.totalValue)}</p>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1.3fr_1fr_1fr_auto]">
            {data.currentUser.canManageAssigneeFilter ? (
              <div className="space-y-2">
                <Label className="text-[#9fb0c8]">Vendedor</Label>
                <Select
                  value={data.filters.assignedTo || "all"}
                  onValueChange={(value) => updateSearchParam("assignedTo", value)}
                >
                  <SelectTrigger className="w-full border-white/10 bg-white/5 text-[#f8fafc]">
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
              <Label className="text-[#9fb0c8]">Fuente</Label>
              <Select
                value={data.filters.source || "all"}
                onValueChange={(value) => updateSearchParam("source", value)}
              >
                <SelectTrigger className="w-full border-white/10 bg-white/5 text-[#f8fafc]">
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
                <Label className="text-[#9fb0c8]">Desde</Label>
                <Input
                  type="date"
                  value={data.filters.createdFrom || ""}
                  onChange={(event) => updateSearchParam("createdFrom", event.target.value || null)}
                  className="border-white/10 bg-white/5 text-[#f8fafc]"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[#9fb0c8]">Hasta</Label>
                <Input
                  type="date"
                  value={data.filters.createdTo || ""}
                  onChange={(event) => updateSearchParam("createdTo", event.target.value || null)}
                  className="border-white/10 bg-white/5 text-[#f8fafc]"
                />
              </div>
            </div>

            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={handleClearFilters}
                className="w-full border-white/10 bg-white/5 text-[#f8fafc] hover:border-[#35d6ae] hover:bg-[#35d6ae]/10 hover:text-[#f8fafc]"
              >
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FilterX className="mr-2 h-4 w-4" />}
                Limpiar
              </Button>
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
    </>
  );
}

export function KanbanBoardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-[30px] border border-white/10 bg-[#07101b] p-6">
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-3">
            <div className="h-6 w-28 animate-pulse rounded-full bg-white/8" />
            <div className="h-10 w-72 animate-pulse rounded-2xl bg-white/8" />
            <div className="h-4 w-full max-w-xl animate-pulse rounded-full bg-white/8" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="h-24 animate-pulse rounded-2xl bg-white/8" />
            <div className="h-24 animate-pulse rounded-2xl bg-white/8" />
          </div>
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-14 animate-pulse rounded-2xl bg-white/8" />
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="flex min-w-max gap-4">
          {Array.from({ length: 4 }).map((_, stageIndex) => (
            <div
              key={stageIndex}
              className="flex min-h-[70vh] w-[320px] shrink-0 flex-col rounded-[28px] border border-white/10 bg-[#08111d] p-4"
            >
              <div className="h-6 w-32 animate-pulse rounded-full bg-white/8" />
              <div className="mt-2 h-4 w-20 animate-pulse rounded-full bg-white/8" />
              <div className="mt-6 space-y-3">
                {Array.from({ length: 3 }).map((__, cardIndex) => (
                  <div key={cardIndex} className="h-36 animate-pulse rounded-[22px] bg-white/8" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
