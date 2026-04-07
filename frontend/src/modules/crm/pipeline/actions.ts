import { canEditLeads } from "@/lib/auth/permissions";
import type { Result, PipelineStageRecord } from "@/modules/crm/pipeline/types";
import { requireAuth } from "@/lib/workspace-auth";

export async function updatePipelineStage(): Promise<Result<PipelineStageRecord>> {
  const { user, company_id } = await requireAuth();
  if (!canEditLeads(user.role)) {
    throw new Error("FORBIDDEN");
  }
  void user;
  void company_id;
  return {
    data: null,
    error: "NOT_IMPLEMENTED",
  };
}
