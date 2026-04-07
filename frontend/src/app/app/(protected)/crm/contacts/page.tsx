import { Suspense } from "react";
import { ContactTable, ContactTableSkeleton } from "@/components/crm/ContactTable";
import { getContactsPageData, parseContactsFilters } from "@/modules/crm/contacts/queries";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function ContactsPageContent({ searchParams }: { searchParams?: SearchParams }) {
  const resolvedSearchParams = (await searchParams) || {};
  const { page, ...filters } = parseContactsFilters(resolvedSearchParams);
  const data = await getContactsPageData({
    filters,
    page,
  });

  return <ContactTable key={`${page}-${filters.query || ""}-${filters.source || ""}-${filters.contactId || ""}`} data={data} />;
}

export default function CrmContactsPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  return (
    <Suspense fallback={<ContactTableSkeleton />}>
      <ContactsPageContent searchParams={searchParams} />
    </Suspense>
  );
}

