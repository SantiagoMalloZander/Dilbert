"use client";

import { Draggable, Droppable } from "@hello-pangea/dnd";
import { ChevronRight } from "lucide-react";
import { LeadCard } from "@/components/crm/LeadCard";
import { cn } from "@/lib/utils";
import type { PipelineStageRecord } from "@/modules/crm/leads/types";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

export function PipelineStage({
  stage,
  onOpenLead,
  canDrag,
}: {
  stage: PipelineStageRecord;
  onOpenLead: (leadId: string) => void;
  canDrag: boolean;
}) {
  return (
    <div className="flex min-h-[72vh] w-[320px] shrink-0 flex-col rounded-[28px] border border-[#2A1A0A]/15 bg-background">
      <div className="border-b border-[#2A1A0A]/10 px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <span
                className="h-3 w-3 rounded-full border border-[#2A1A0A]/15"
                style={{ backgroundColor: stage.color }}
              />
              <h3 className="truncate text-sm font-semibold tracking-wide text-foreground">
                {stage.name}
              </h3>
            </div>
            <p className="mt-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              {stage.leadCount} leads
            </p>
          </div>
          <div className="rounded-2xl border border-[#2A1A0A]/15 bg-[#F5F0E8] px-3 py-2 text-right">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Valor</p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {formatCurrency(stage.totalValue)}
            </p>
          </div>
        </div>
      </div>

      <Droppable droppableId={stage.id} isDropDisabled={!canDrag}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              "flex min-h-[220px] flex-1 flex-col gap-3 overflow-y-auto px-3 py-3 transition-colors",
              snapshot.isDraggingOver && "bg-[#0d1928]"
            )}
          >
            {stage.cards.map((lead, index) => (
              <Draggable
                key={lead.id}
                draggableId={lead.id}
                index={index}
                isDragDisabled={!canDrag}
              >
                {(draggableProvided, draggableSnapshot) => (
                  <div
                    ref={draggableProvided.innerRef}
                    {...draggableProvided.draggableProps}
                    {...draggableProvided.dragHandleProps}
                  >
                    <LeadCard
                      lead={lead}
                      onOpen={onOpenLead}
                      disabled={!canDrag}
                      isDragging={draggableSnapshot.isDragging}
                    />
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}

            {stage.cards.length === 0 ? (
              <div className="flex flex-1 items-center justify-center rounded-[22px] border border-dashed border-[#2A1A0A]/15 px-4 py-10 text-center text-sm text-muted-foreground">
                <div>
                  <p>No hay leads en esta etapa.</p>
                  <p className="mt-1 inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.16em]">
                    Soltá una oportunidad acá <ChevronRight className="h-3 w-3" />
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </Droppable>
    </div>
  );
}

