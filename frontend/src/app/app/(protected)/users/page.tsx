import { redirect } from "next/navigation";

// El Centro de Usuarios ahora vive como una pestaña dentro de Configuración.
export default function UsersPage() {
  redirect("/app/settings");
}
