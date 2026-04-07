import Link from "next/link";
import { ErrorState } from "@/components/error-state";
import { buttonVariants } from "@/components/ui/button-variants";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <ErrorState
        title="Página no encontrada"
        message="La ruta que intentaste abrir no existe o ya no está disponible."
      />
      <div className="-mt-28 flex justify-center pb-12">
        <Link href="/app/" className={buttonVariants()}>
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
