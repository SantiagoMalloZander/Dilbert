import { NextResponse } from "next/server";

export async function GET() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN not set" }, { status: 503 });
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
      next: { revalidate: 3600 },
    });
    const data = await res.json();
    if (!data.ok) {
      return NextResponse.json({ error: "Invalid bot token" }, { status: 502 });
    }
    return NextResponse.json({
      username: data.result.username as string,
      name: data.result.first_name as string,
      link: `https://t.me/${data.result.username}`,
    });
  } catch {
    return NextResponse.json({ error: "Failed to reach Telegram API" }, { status: 502 });
  }
}
