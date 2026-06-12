"use client";

import { useState } from "react";
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
  draggingId,
  onDragStartLead,
  onDragEndLead,
  onDropLead,
}: {
  stage: PipelineStageRecord;
  onOpenLead: (leadId: string) => void;
  canDrag: boolean;
  draggingId: string | null;
  onDragStartLead: (leadId: string) => void;
  onDragEndLead: () => void;
  onDropLead: (leadId: string, destStageId: string) => void;
}) {
  const [isOver, setIsOver] = useState(false);

  const allowDrop = (event: React.DragEvent) => {
    if (!canDrag) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (event: React.DragEvent) => {
    if (!canDrag) return;
    event.preventDefault();
    setIsOver(false);
    const leadId = event.dataTransfer.getData("text/plain");
    if (leadId) onDropLead(leadId, stage.id);
  };

  return (
    <div className="flex min-h-[72vh] w-[320px] shrink-0 flex-col overflow-hidden rounded-2xl bg-muted/40">
      {/* Color de la etapa (barra superior) */}
      <div className="h-1.5 w-full" style={{ backgroundColor: stage.color }} />

      <div className="px-4 pb-2 pt-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
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

      <div
        onDragOver={allowDrop}
        onDragEnter={() => canDrag && setIsOver(true)}
        onDragLeave={(e) => {
          // Only clear when leaving the column, not when moving over a child.
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsOver(false);
        }}
        onDrop={handleDrop}
        className={cn(
          "flex min-h-[220px] flex-1 flex-col gap-2.5 rounded-2xl px-2.5 py-2.5 transition-colors",
          isOver && "bg-[#D4420A]/[0.07] ring-2 ring-inset ring-[#D4420A]/30"
        )}
      >
        {stage.cards.map((lead) => (
          <div
            key={lead.id}
            draggable={canDrag}
            onDragStart={(event) => {
              if (!canDrag) return;
              event.dataTransfer.setData("text/plain", lead.id);
              event.dataTransfer.effectAllowed = "move";
              onDragStartLead(lead.id);
            }}
            onDragEnd={onDragEndLead}
            className={cn("transition-opacity", draggingId === lead.id && "opacity-40")}
          >
            <LeadCard lead={lead} onOpen={onOpenLead} disabled={!canDrag} />
          </div>
        ))}

        {stage.cards.length === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border/70 px-4 py-10 text-center">
            <p className="text-[13px] text-muted-foreground">
              {canDrag ? "Arrastrá un cliente acá" : "Sin clientes"}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
