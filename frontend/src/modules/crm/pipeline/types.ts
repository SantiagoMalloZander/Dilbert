export type Result<T> = {
  data: T | null;
  error: string | null;
};

export type PipelineStageRecord = {
  id: string;
  name: string;
  position: number;
};

