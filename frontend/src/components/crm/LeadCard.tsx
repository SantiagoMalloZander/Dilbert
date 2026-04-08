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
      className: "border-red-400/40 bg-red-500/10 text-red-200",
    };
  }

  if (diffInDays <= 7) {
    return {
      label: `${diffInDays === 0 ? "Hoy" : `${diffInDays}d`}`,
      className: "border-amber-300/40 bg-amber-300/10 text-amber-100",
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
        "group w-full rounded-[22px] border border-[#2A1A0A]/15 bg-card p-4 text-left shadow-[0_18px_45px_rgba(2,8,23,0.25)] transition duration-200",
        "hover:border-[#D4420A]/40 hover:bg-[#122033]",
        disabled && "cursor-default",
        isDragging && "rotate-[1deg] border-[#D4420A]/50 shadow-[0_20px_60px_rgba(53,214,174,0.2)]"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="line-clamp-2 text-sm font-semibold text-foreground">{lead.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{lead.contact.name}</p>
        </div>
        <Avatar className="h-9 w-9 border border-[#2A1A0A]/15 bg-[#111b2a]">
          <AvatarImage src={lead.assignedUser?.avatarUrl} alt={lead.assignedUser?.name || "Vendedor"} />
          <AvatarFallback className="bg-[#16304a] text-[10px] text-[#d8e4f2]">
            {getInitials(lead.assignedUser?.name)}
          </AvatarFallback>
        </Avatar>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
          <CircleDollarSign className="h-4 w-4 text-[#D4420A]" />
          {formatCurrency(lead.value, lead.currency)}
        </div>
        {dueState ? (
          <Badge className={cn("border", dueState.className)}>
            <CalendarClock className="h-3 w-3" />
            {dueState.label}
          </Badge>
        ) : null}
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <Badge className="border border-[#2A1A0A]/15 bg-white/5 text-[#d8e4f2]">
          <SourceIcon className="h-3 w-3" />
          {sourceMeta.label}
        </Badge>
        <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          {lead.assignedUser?.name || "Sin vendedor"}
        </span>
      </div>
    </button>
  );
}
