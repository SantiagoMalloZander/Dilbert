import { Suspense } from "react";
import { KanbanBoard, KanbanBoardSkeleton } from "@/components/crm/KanbanBoard";
import { getLeadBoardData, parseLeadBoardFilters } from "@/modules/crm/leads/queries";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function LeadsBoardContent({ searchParams }: { searchParams?: SearchParams }) {
  const resolvedSearchParams = (await searchParams) || {};
  const filters = parseLeadBoardFilters(resolvedSearchParams);
  const data = await getLeadBoardData(filters);

  return (
    <KanbanBoard
      key={[
        data.pipeline.id,
        data.filters.assignedTo || "",
        data.filters.source || "",
        data.filters.createdFrom || "",
        data.filters.createdTo || "",
        data.filters.stageId || "",
        data.selectedLead?.id || "",
        data.selectedLead?.updatedAt || "",
      ].join(":")}
      data={data}
    />
  );
}

export default function CrmLeadsPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  return (
    <Suspense fallback={<KanbanBoardSkeleton />}>
      <LeadsBoardContent searchParams={searchParams} />
    </Suspense>
  );
}
