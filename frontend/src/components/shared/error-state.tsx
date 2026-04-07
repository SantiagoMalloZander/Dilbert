"use client";

import { AlertTriangle, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ErrorState({
  title,
  message,
  onRetry,
}: {
  title: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl rounded-[30px] border border-white/10 bg-card/90 p-8 text-center shadow-panel backdrop-blur">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-destructive/20 bg-destructive/10 text-destructive">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <p className="mt-5 text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
          Dilbert
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{message}</p>
        {onRetry ? (
          <div className="mt-6">
            <Button onClick={onRetry}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              Reintentar
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
