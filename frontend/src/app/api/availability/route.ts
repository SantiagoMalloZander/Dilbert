import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const TZ_OFFSET = 3; // Argentina UTC-3
const SLOT_MINUTES = 30;
const WORK_START = 9;
const WORK_END = 18;

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}

function allSlots(): string[] {
  const slots: string[] = [];
  for (let h = WORK_START; h < WORK_END; h++) {
    for (let m = 0; m < 60; m += SLOT_MINUTES) {
      slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return slots;
}

function argToday(): string {
  const arg = new Date(Date.now() - TZ_OFFSET * 3600_000);
  return arg.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "date param required (YYYY-MM-DD)" }, { status: 400 });
  }

  if (date < argToday()) return NextResponse.json({ slots: [] });

  const [y, m, d] = date.split("-").map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  if (dow === 0 || dow === 6) return NextResponse.json({ slots: [] });

  // Get already-booked slots for this date from Supabase
  let bookedSlots: string[] = [];
  try {
    const { data } = await db()
      .from("demos")
      .select("time")
      .eq("date", date)
      .neq("status", "cancelled");
    bookedSlots = (data ?? []).map((r: { time: string }) => r.time);
  } catch {
    // If table doesn't exist yet, ignore — return all slots
  }

  const nowArg = new Date(Date.now() - TZ_OFFSET * 3600_000);
  const nowMinutes = nowArg.getUTCHours() * 60 + nowArg.getUTCMinutes();
  const isToday = date === argToday();

  const available = allSlots().filter((slot) => {
    if (bookedSlots.includes(slot)) return false;
    if (isToday) {
      const [h, min] = slot.split(":").map(Number);
      if (h * 60 + min <= nowMinutes + 60) return false; // 1h buffer
    }
    return true;
  });

  return NextResponse.json({ slots: available });
}
