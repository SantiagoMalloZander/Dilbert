// @ts-nocheck
import { HelpCircle, MessageSquare, Mic, Video } from "lucide-react";
import { cn } from "@/lib/utils";

type SourceConfig = {
  icon: React.ElementType;
  label: string;
  className: string;
};

const SOURCE_MAP: Record<string, SourceConfig> = {
  group_chat: {
    icon: MessageSquare,
    label: "Telegram",
    className: "text-blue-700 bg-blue-50 border-blue-200",
  },
  text: {
    icon: MessageSquare,
    label: "Chat directo",
    className: "text-cyan-700 bg-cyan-50 border-cyan-200",
  },
  voice: {
    icon: Mic,
    label: "Voz",
    className: "text-violet-700 bg-violet-50 border-violet-200",
  },
  audio: {
    icon: Mic,
    label: "Audio",
    className: "text-violet-700 bg-violet-50 border-violet-200",
  },
  fathom_meet: {
    icon: Video,
    label: "Google Meet",
    className: "text-[#1A7A6E] bg-[#1A7A6E]/10 border-[#1A7A6E]/25",
  },
};

const FALLBACK: SourceConfig = {
  icon: HelpCircle,
  label: "Sin fuente",
  className: "text-[#6B6B6B] bg-[#EDE8DF] border-[rgba(42,26,10,0.15)]",
};

export function SourceBadge({
  sourceType,
  size = "sm",
  className,
}: {
  sourceType: string | null | undefined;
  size?: "sm" | "md";
  className?: string;
}) {
  const config = (sourceType && SOURCE_MAP[sourceType]) || FALLBACK;
  const label = sourceType && !SOURCE_MAP[sourceType] ? sourceType : config.label;
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded border font-mono uppercase tracking-wide",
        size === "sm" ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-1",
        config.className,
        className
      )}
    >
      <Icon className={size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3"} />
      {label}
    </span>
  );
}
