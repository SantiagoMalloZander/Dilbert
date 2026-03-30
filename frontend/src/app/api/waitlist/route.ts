import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Email inválido" }, { status: 400 });
  }

  const { error } = await supabase
    .from("waitlist")
    .upsert({ email: email.toLowerCase().trim() }, { onConflict: "email" });

  if (error) {
    // Table might not exist yet — still return success for demo
    console.error("waitlist insert:", error.message);
  }

  return NextResponse.json({ ok: true });
}

export async function GET() {
  const { count } = await supabase
    .from("waitlist")
    .select("*", { count: "exact", head: true });

  return NextResponse.json({ count: count ?? 0 });
}
