import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/workspace-auth";
import { uploadAccountAvatar } from "@/lib/workspace-account";

function mapAvatarError(error: unknown) {
  if (!(error instanceof Error)) {
    return { status: 500, message: "No pude subir tu foto." };
  }

  switch (error.message) {
    case "ACCOUNT_USER_NOT_FOUND":
      return { status: 404, message: "No encontré tu usuario." };
    case "AVATAR_INVALID_TYPE":
      return { status: 400, message: "Subí una imagen válida." };
    case "AVATAR_TOO_LARGE":
      return { status: 400, message: "La imagen supera el máximo de 2 MB." };
    default:
      return { status: 500, message: "No pude subir tu foto." };
  }
}

export async function POST(request: Request) {
  const session = await getAuthSession();

  if (!session?.user?.email || !session.user.id) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const avatar = formData.get("avatar");

    if (!(avatar instanceof File)) {
      return NextResponse.json({ error: "No encontré el archivo." }, { status: 400 });
    }

    const result = await uploadAccountAvatar({
      userId: session.user.id,
      companyId: session.user.companyId,
      file: avatar,
    });

    return NextResponse.json({ ok: true, avatarUrl: result.avatarUrl });
  } catch (error) {
    const mapped = mapAvatarError(error);
    console.error("[account/avatar]", error);
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}
