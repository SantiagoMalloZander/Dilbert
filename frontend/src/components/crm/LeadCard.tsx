"use client";

import {
  Camera,
  CalendarClock,
  CircleDollarSign,
  Mail,
  MessageCircleMore,
  PenSquare,
  Upload,
  Video,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { LeadCardRecord } from "@/modules/crm/leads/types";

function formatCurrency(value: number | null, currency: string | null) {
  if (value == null) {
    return "Sin valor";
  }

  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: currency || "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

function getSourceMeta(source: LeadCardRecord["source"]) {
  switch (source) {
    case "whatsapp":
      return {
        label: "WhatsApp",
        icon: MessageCircleMore,
      };
    case "gmail":
      return {
        label: "Gmail",
        icon: Mail,
      };
    case "instagram":
      return {
        label: "Instagram",
        icon: Camera,
      };
    case "zoom":
      return {
        label: "Zoom",
        icon: Video,
      };
    case "meet":
      return {
        label: "Meet",
        icon: Video,
      };
    case "import":
      return {
        label: "Importado",
        icon: Upload,
      };
    default:
      return {
        label: "Manual",
        icon: PenSquare,
      };
  }
}

function getInitials(name?: string | null) {
  return (name || "DU")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function getDueState(value: string | null) {
  if (!value) {
    return null;
  }

  const now = new Date();
  const dueDate = new Date(value);
  const diffInMs = dueDate.getTime() - now.getTime();
  const diffInDays = Math.ceil(diffInMs / (1000 * 60 * 60 * 24));

  if (diffInDays < 0) {
    return {
      label: "Vencida",
      className: "border-red-400/40 bg-red-500/10 text-red-700",
    };
  }

  if (diffInDays <= 7) {
    return {
      label: `${diffInDays === 0 ? "Hoy" : `${diffInDays}d`}`,
      className: "border-amber-300/40 bg-amber-300/10 text-amber-700",
    };
  }

  return null;
}

export function LeadCard({
  lead,
  onOpen,
  isDragging,
  disabled,
}: {
  lead: LeadCardRecord;
  onOpen: (leadId: string) => void;
  isDragging?: boolean;
  disabled?: boolean;
}) {
  const sourceMeta = getSourceMeta(lead.source);
  const SourceIcon = sourceMeta.icon;
  const dueState = getDueState(lead.expectedCloseDate);

  return (
    <button
      type="button"
      onClick={() => onOpen(lead.id)}
      className={cn(
        "group block w-full rounded-2xl border border-border bg-card p-4 text-left transition-all duration-200",
        "shadow-[0_1px_2px_rgba(32,26,19,0.05)] hover:-translate-y-0.5 hover:border-[#D4420A]/30 hover:shadow-[0_6px_20px_rgba(32,26,19,0.08)]",
        disabled ? "cursor-default" : "cursor-grab active:cursor-grabbing",
        isDragging && "rotate-[1.5deg] cursor-grabbing border-[#D4420A]/50 shadow-[0_12px_30px_rgba(32,26,19,0.16)]"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="line-clamp-2 text-[15px] font-semibold leading-snug text-foreground">
            {lead.title}
          </p>
          <p className="mt-1 truncate text-[13px] text-muted-foreground">{lead.contact.name}</p>
        </div>
        <Avatar className="h-9 w-9 shrink-0 border border-border">
          <AvatarImage src={lead.assignedUser?.avatarUrl} alt={lead.assignedUser?.name || "Vendedor"} />
          <AvatarFallback className="bg-muted text-[11px] font-medium text-muted-foreground">
            {getInitials(lead.assignedUser?.name)}
          </AvatarFallback>
        </Avatar>
      </div>

      <div className="mt-3.5 flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#D4420A]/[0.07] px-2.5 py-1 text-[13px] font-semibold text-[#D4420A]">
          <CircleDollarSign className="h-3.5 w-3.5" />
          {formatCurrency(lead.value, lead.currency)}
        </span>
        {dueState ? (
          <Badge className={cn("border", dueState.className)}>
            <CalendarClock className="h-3 w-3" />
            {dueState.label}
          </Badge>
        ) : null}
      </div>

      <div className="mt-3 flex items-center gap-1.5 text-[12px] text-muted-foreground">
        <SourceIcon className="h-3.5 w-3.5" />
        <span>{sourceMeta.label}</span>
        <span className="text-border">·</span>
        <span className="truncate">{lead.assignedUser?.name || "Sin vendedor"}</span>
      </div>
    </button>
  );
}
