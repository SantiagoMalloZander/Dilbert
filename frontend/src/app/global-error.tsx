"use client";

import { ErrorState } from "@/components/error-state";
import { getFriendlyWorkspaceErrorMessage } from "@/lib/workspace-session-security";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-background text-foreground">
        <ErrorState
          title="No pudimos cargar Dilbert"
          message={getFriendlyWorkspaceErrorMessage(error)}
          onRetry={reset}
        />
      </body>
    </html>
  );
}
