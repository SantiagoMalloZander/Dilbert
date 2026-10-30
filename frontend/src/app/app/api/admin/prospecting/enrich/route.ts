import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthSession } from "@/lib/workspace-auth";
import { findEmailsOnWebsite } from "@/lib/prospecting/enrich";
import { getProspectsByIds, updateProspect } from "@/modules/prospecting/queries";

// Rastrea la web de hasta 4 prospectos en paralelo buscando emails.
const enrichSchema = z.object({ ids: z.array(z.string().uuid()).min(1).max(4) });

export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session?.user?.isSuperAdmin) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  try {
    const { ids } = enrichSchema.parse(await request.json());
    const prospects = await getProspectsByIds(ids);

    const updated = await Promise.all(
      prospects.map(async (prospect) => {
        const found = await findEmailsOnWebsite(prospect.website);
        const emails = [...new Set([...(prospect.emails ?? []), ...found])];
        return updateProspect(prospect.id, {
          emails,
          email: prospect.email ?? emails[0] ?? null,
          enriched_at: new Date().toISOString(),
        });
      })
    );

    return NextResponse.json({ ok: true, prospects: updated });
  } catch (error) {
    console.error("[prospecting] enrich failed", error);
    return NextResponse.json({ error: "No pude rastrear las webs." }, { status: 500 });
  }
}
