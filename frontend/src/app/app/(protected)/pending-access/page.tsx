import { Clock3, Mail } from "lucide-react";
import { requireSession } from "@/lib/workspace-auth";

export default async function PendingAccessPage() {
  const session = await requireSession();

  return (
    <section className="mx-auto max-w-2xl">
      <div className="rounded-[32px] border border-white/10 bg-card/80 p-8 shadow-panel backdrop-blur">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] text-amber-200">
          <Clock3 className="h-3.5 w-3.5" />
          Acceso pendiente
        </div>

        <h2 className="text-3xl font-semibold tracking-tight">
          Tu cuenta ya existe, pero todavia no tiene una empresa asignada.
        </h2>

        <p className="mt-4 text-base leading-7 text-muted-foreground">
          Te logueaste correctamente con <strong>{session.user.email}</strong>. El siguiente paso es
          que tu empresa te agregue en el Centro de Usuarios para asignarte una empresa y un rol.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-background/60 p-5">
            <p className="text-sm font-medium text-foreground">Que tenes que hacer ahora</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Compartiles este mail y pediles que te agreguen desde el panel de Dilbert.
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-background/60 p-5">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Mail className="h-4 w-4" />
              Email para compartir
            </div>
            <p className="mt-2 break-all text-sm leading-6 text-muted-foreground">
              {session.user.email}
            </p>
          </div>
        </div>

        <div className="mt-8 rounded-3xl border border-dashed border-white/15 bg-white/5 p-5">
          <p className="text-sm leading-6 text-muted-foreground">
            Cuando te habiliten, volve a entrar o refresca esta pagina y te vamos a llevar al CRM automaticamente.
          </p>
        </div>
      </div>
    </section>
  );
}
