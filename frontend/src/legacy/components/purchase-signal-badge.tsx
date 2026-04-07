// @ts-nocheck
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PurchaseSignal } from "@/lib/types";

const signalStyles: Record<PurchaseSignal["level"], string> = {
  muy_alta: "border-emerald-200 bg-emerald-50 text-emerald-700",
  alta: "border-lime-200 bg-lime-50 text-lime-700",
  media: "border-amber-200 bg-amber-50 text-amber-700",
  baja: "border-orange-200 bg-orange-50 text-orange-700",
  muy_baja: "border-rose-200 bg-rose-50 text-rose-700",
};

export function PurchaseSignalBadge({
  signal,
  className,
}: {
  signal: PurchaseSignal;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(signalStyles[signal.level], className)}
    >
      {signal.label}
    </Badge>
  );
}
