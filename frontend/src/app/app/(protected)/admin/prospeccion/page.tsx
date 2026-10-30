import { requireSuperAdmin } from "@/lib/workspace-auth";
import { ProspectingPanel } from "@/components/prospecting-panel";

export default async function ProspectingPage() {
  await requireSuperAdmin();
  return <ProspectingPanel />;
}
