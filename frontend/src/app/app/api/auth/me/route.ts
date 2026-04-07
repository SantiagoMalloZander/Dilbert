import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/workspace-auth";
import { buildPermissionSnapshot } from "@/lib/auth/permissions";

export async function GET() {
  const session = await getAuthSession();

  if (!session?.user?.email) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  return NextResponse.json({
    user: session.user,
    permissions: buildPermissionSnapshot({
      role: session.user.role,
      email: session.user.email,
    }),
  });
}
