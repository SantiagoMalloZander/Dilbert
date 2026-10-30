import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthSession } from "@/lib/workspace-auth";
import { searchTown } from "@/lib/prospecting/sources";
import { findTown } from "@/lib/prospecting/towns";
import { upsertFoundProspects } from "@/modules/prospecting/queries";

// Una localidad por request: el panel recorre la lista desde el cliente para
// no pasarse del timeout de las funciones de Netlify.
const searchSchema = z.object({
  town: z.string().min(1),
  query: z.string().max(80).optional(),
  useGoogle: z.boolean().optional(),
  useOsm: z.boolean().optional(),
});

export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session?.user?.isSuperAdmin) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  try {
    const payload = searchSchema.parse(await request.json());
    const town = findTown(payload.town);
    if (!town) {
      return NextResponse.json({ error: "Localidad desconocida." }, { status: 400 });
    }

    const found = await searchTown(town, payload);
    const { inserted } = await upsertFoundProspects(found);

    return NextResponse.json({ ok: true, town: town.name, found: found.length, inserted });
  } catch (error) {
    console.error("[prospecting] search failed", error);
    const message =
      error instanceof Error && error.message.startsWith("GOOGLE_PLACES_ERROR")
        ? "Google Places rechazó la búsqueda (revisá la API key y que esté habilitada 'Places API (New)')."
        : "No pude buscar en esta localidad.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
