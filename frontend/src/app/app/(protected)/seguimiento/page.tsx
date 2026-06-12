import { redirect } from "next/navigation";

// El Seguimiento ahora vive dentro del CRM.
export default function SeguimientoRedirectPage() {
  redirect("/app/crm/seguimiento");
}
