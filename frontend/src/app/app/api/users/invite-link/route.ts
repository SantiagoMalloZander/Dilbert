import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/workspace-auth";
import {
  ensureCompanyInviteLink,
  regenerateCompanyInviteLink,
} from "@/lib/workspace-users";

export async function GET() {
  const session = await getAuthSession();

  if (!session?.user?.email || session.user.role !== "owner" || !session.user.companyId) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  try {
    const inviteLink = await ensureCompanyInviteLink(session.user.companyId);
    return NextResponse.json({ ok: true, inviteLink });
  } catch (error) {
    console.error("[users/invite-link:get]", error);
    return NextResponse.json(
      { error: "No pude obtener el link de acceso." },
      { status: 500 }
    );
  }
}

export async function POST() {
  const session = await getAuthSession();

  if (!session?.user?.email || session.user.role !== "owner" || !session.user.companyId) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  try {
    const inviteLink = await regenerateCompanyInviteLink(session.user.companyId);
    return NextResponse.json({ ok: true, inviteLink });
  } catch (error) {
    console.error("[users/invite-link:post]", error);
    return NextResponse.json(
      { error: "No pude regenerar el link de acceso." },
      { status: 500 }
    );
  }
}
