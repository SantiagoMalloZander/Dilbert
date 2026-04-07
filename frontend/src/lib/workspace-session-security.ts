import { createAdminSupabaseClient } from "@/lib/supabase/server";

function isTransientBackendError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes("fetch failed") ||
    message.includes("network") ||
    message.includes("timeout") ||
    message.includes("supabase")
  );
}

export async function revokeAuthSessionsByUserId(userId: string) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase.auth.admin.getUserById(userId);

  if (error) {
    throw error;
  }

  const nextAppMetadata = {
    ...(data.user.app_metadata || {}),
    session_revoked_at: new Date().toISOString(),
  };

  const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
    app_metadata: nextAppMetadata,
  });

  if (updateError) {
    throw updateError;
  }
}

export function getFriendlyWorkspaceErrorMessage(error: unknown) {
  if (isTransientBackendError(error)) {
    return "No pudimos conectarnos con Supabase en este momento. Probá de nuevo en unos segundos.";
  }

  return "Ocurrió un error inesperado. Reintentá y, si sigue pasando, avisale al equipo de Dilbert.";
}
