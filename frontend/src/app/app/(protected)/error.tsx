"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/error-state";
import { getFriendlyWorkspaceErrorMessage } from "@/lib/workspace-session-security";

export default function ProtectedWorkspaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[workspace:error]", error);
  }, [error]);

  return (
    <ErrorState
      title="No pudimos cargar tu workspace"
      message={getFriendlyWorkspaceErrorMessage(error)}
      onRetry={reset}
    />
  );
}
