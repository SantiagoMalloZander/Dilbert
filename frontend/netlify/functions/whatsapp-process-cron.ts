/**
 * Scheduled function: every minute, trigger the WhatsApp queue processor.
 * The actual debounced extraction logic lives in the Next.js app at
 * /app/api/cron/whatsapp-process (it imports the CRM agent pipeline).
 */

export const config = {
  schedule: "* * * * *",
};

export default async function handler() {
  const secret = process.env.CRON_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://dilvert.netlify.app";

  if (!secret) {
    console.error("[whatsapp-process-cron] CRON_SECRET not set");
    return new Response("Missing CRON_SECRET", { status: 500 });
  }

  try {
    const res = await fetch(`${appUrl}/app/api/cron/whatsapp-process`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
    });
    const data = (await res.json().catch(() => ({}))) as {
      processed?: number;
      skipped?: number;
      conversations?: number;
    };
    console.log(
      `[whatsapp-process-cron] ok — conversations:${data.conversations ?? 0} processed:${data.processed ?? 0} skipped:${data.skipped ?? 0}`
    );
    return new Response("ok", { status: 200 });
  } catch (err) {
    console.error("[whatsapp-process-cron] error:", err);
    return new Response("error", { status: 500 });
  }
}
