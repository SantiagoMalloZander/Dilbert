import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const TZ_OFFSET = 3; // Argentina UTC-3
const SLOT_MINUTES = 30;
const WORK_START = 9;
const WORK_END = 18;

// Recurring busy blocks by day of week (0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat)
// Format: [startHour, endHour) — all slots >= startHour and < endHour are blocked
const RECURRING_BUSY: Record<number, { start: number; end: number }[]> = {
  1: [{ start: 17, end: 21 }],   // Lunes: 17:00-21:00 (5pm-9pm)
  2: [{ start: 8,  end: 15 }],   // Martes: 8:00-15:00
  4: [{ start: 10, end: 15 }],   // Jueves: 10:00-15:00
  5: [{ start: 0,  end: 10 }],   // Viernes: antes de las 10:00
};

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

function isRecurringBusy(dow: number, slotHour: number): boolean {
  const blocks = RECURRING_BUSY[dow] ?? [];
  return blocks.some((b) => slotHour >= b.start && slotHour < b.end);
}

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "date param required (YYYY-MM-DD)" }, { status: 400 });
  }

  if (date < argToday()) return NextResponse.json({ slots: [] });

  const [y, m, d] = date.split("-").map(Number);
  const dow = new Date(y, m - 1, d).getDay();

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
    // Table may not exist yet — degrade gracefully
  }

  const nowArg = new Date(Date.now() - TZ_OFFSET * 3600_000);
  const nowMinutes = nowArg.getUTCHours() * 60 + nowArg.getUTCMinutes();
  const isToday = date === argToday();

  const available = allSlots().filter((slot) => {
    if (bookedSlots.includes(slot)) return false;
    const [h, min] = slot.split(":").map(Number);
    if (isRecurringBusy(dow, h + min / 60)) return false;
    if (isToday && h * 60 + min <= nowMinutes + 60) return false;
    return true;
  });

  return NextResponse.json({ slots: available });
}
