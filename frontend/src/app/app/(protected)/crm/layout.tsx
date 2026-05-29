import { CrmSubNav } from "@/components/crm/CrmSubNav";

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <CrmSubNav />
      {children}
    </div>
  );
}
