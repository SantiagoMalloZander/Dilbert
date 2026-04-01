import { NextRequest, NextResponse } from "next/server";

const TZ_OFFSET = 3; // Argentina is UTC-3, no DST
const SLOT_MINUTES = 30;
const WORK_START = 9;
const WORK_END = 18;

/** All 30-min slot times for a given date, as "HH:MM" strings in Argentina time */
function allSlots(): string[] {
  const slots: string[] = [];
  for (let h = WORK_START; h < WORK_END; h++) {
    for (let m = 0; m < 60; m += SLOT_MINUTES) {
      slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return slots;
}

/** Convert an Argentina date+time string to a UTC Date */
function argToUtc(dateStr: string, timeStr: string): Date {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const [h, min] = timeStr.split(":").map(Number);
  return new Date(Date.UTC(y, mo - 1, d, h + TZ_OFFSET, min));
}

/** Current date string in Argentina time (YYYY-MM-DD) */
function argToday(): string {
  const now = new Date();
  // Shift UTC to Argentina time
  const arg = new Date(now.getTime() - TZ_OFFSET * 3600_000);
  return arg.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "date param required (YYYY-MM-DD)" }, { status: 400 });
  }

  // Reject past dates
  if (date < argToday()) {
    return NextResponse.json({ slots: [] });
  }

  // Reject weekends (using local JS Date which gives local dow — we want Argentina dow)
  const [y, m, d] = date.split("-").map(Number);
  const dow = new Date(y, m - 1, d).getDay(); // 0=Sun, 6=Sat
  if (dow === 0 || dow === 6) {
    return NextResponse.json({ slots: [] });
  }

  // Fetch busy times from Google Calendar (optional — degrades gracefully)
  let busyTimes: { start: Date; end: Date }[] = [];

  if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
    try {
      const { google } = await import("googleapis");
      const auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
          private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
        },
        scopes: ["https://www.googleapis.com/auth/calendar.readonly"],
      });

      const cal = google.calendar({ version: "v3", auth });
      const calId = process.env.GOOGLE_CALENDAR_ID ?? "primary";

      // Full day window in UTC (9:00 Argentina = 12:00 UTC, 18:00 Argentina = 21:00 UTC)
      const dayStartUtc = new Date(Date.UTC(y, m - 1, d, TZ_OFFSET, 0));
      const dayEndUtc = new Date(Date.UTC(y, m - 1, d, WORK_END + TZ_OFFSET, 0));

      const { data } = await cal.freebusy.query({
        requestBody: {
          timeMin: dayStartUtc.toISOString(),
          timeMax: dayEndUtc.toISOString(),
          timeZone: "America/Argentina/Buenos_Aires",
          items: [{ id: calId }],
        },
      });

      busyTimes = (data.calendars?.[calId]?.busy ?? []).map((b) => ({
        start: new Date(b.start!),
        end: new Date(b.end!),
      }));
    } catch (err) {
      console.error("[availability] gcal freebusy error:", err);
      // Fall through — return all slots if Calendar is not configured
    }
  }

  const nowUtc = new Date();
  const BUFFER_MS = 60 * 60_000; // 1 hour minimum advance booking

  const available = allSlots().filter((slot) => {
    const slotUtc = argToUtc(date, slot);
    const slotEndUtc = new Date(slotUtc.getTime() + SLOT_MINUTES * 60_000);

    // Must be at least 1 hour in the future
    if (slotUtc.getTime() <= nowUtc.getTime() + BUFFER_MS) return false;

    // Must not overlap any busy period
    for (const busy of busyTimes) {
      if (slotUtc < busy.end && slotEndUtc > busy.start) return false;
    }
    return true;
  });

  return NextResponse.json({ slots: available });
}
