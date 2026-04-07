import type { Result, PipelineStageRecord } from "@/modules/crm/pipeline/types";

export async function getPipelineStages(): Promise<Result<PipelineStageRecord[]>> {
  return {
    data: [],
    error: null,
  };
}

