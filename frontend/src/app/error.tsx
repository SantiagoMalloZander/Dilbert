"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/error-state";
import { getFriendlyWorkspaceErrorMessage } from "@/lib/workspace-session-security";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app:error]", error);
  }, [error]);

  return (
    <ErrorState
      title="Algo salió mal"
      message={getFriendlyWorkspaceErrorMessage(error)}
      onRetry={reset}
    />
  );
}
