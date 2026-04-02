import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/workspace-auth";
import { revokeAllAccountSessions } from "@/lib/workspace-account";

export async function POST() {
  const session = await getAuthSession();

  if (!session?.user?.email || !session.user.id) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  try {
    await revokeAllAccountSessions(session.user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[account/sessions]", error);
    return NextResponse.json(
      { error: "No pude invalidar tus sesiones activas." },
      { status: 500 }
    );
  }
}
