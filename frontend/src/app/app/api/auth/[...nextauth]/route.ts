import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({ error: "NextAuth ya no se usa en /app." }, { status: 410 });
}

export const POST = GET;
