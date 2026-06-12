"use client";

import { Draggable, Droppable } from "@hello-pangea/dnd";
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
    <div className="flex min-h-[72vh] w-[320px] shrink-0 flex-col rounded-2xl bg-muted/40">
      <div className="px-4 pb-2 pt-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: stage.color }} />
            <h3 className="truncate text-[15px] font-semibold text-foreground">{stage.name}</h3>
            <span className="shrink-0 rounded-full bg-background px-2 py-0.5 text-xs font-semibold text-muted-foreground">
              {stage.leadCount}
            </span>
          </div>
          {stage.totalValue > 0 ? (
            <span className="shrink-0 text-xs font-medium text-muted-foreground">
              {formatCurrency(stage.totalValue)}
            </span>
          ) : null}
        </div>
      </div>

      <Droppable droppableId={stage.id} isDropDisabled={!canDrag}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              "flex min-h-[220px] flex-1 flex-col gap-2.5 overflow-y-auto rounded-2xl px-2.5 py-2.5 transition-colors",
              snapshot.isDraggingOver && "bg-[#D4420A]/[0.06]"
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
                    style={draggableProvided.draggableProps.style}
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
              <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border/70 px-4 py-10 text-center">
                <p className="text-[13px] text-muted-foreground">Arrastrá un cliente acá</p>
              </div>
            ) : null}
          </div>
        )}
      </Droppable>
    </div>
  );
}

