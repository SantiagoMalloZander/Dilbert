import { listProperties } from "@/modules/agency/properties/queries";
import { PropertiesExplorer } from "@/components/crm/PropertiesExplorer";

export default async function CrmPropiedadesPage() {
  const properties = await listProperties();
  return <PropertiesExplorer properties={properties} />;
}
