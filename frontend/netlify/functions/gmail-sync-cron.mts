import { schedule } from "@netlify/functions";

/**
 * Runs every 30 minutes and triggers Gmail sync for all connected vendors.
 * The actual sync logic lives in the Next.js app at /app/api/cron/gmail-sync.
 */
export const handler = schedule("*/30 * * * *", async () => {
  const secret = process.env.CRON_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://dilvert.netlify.app";

  if (!secret) {
    console.error("[gmail-sync-cron] CRON_SECRET not set");
    return { statusCode: 500 };
  }

  try {
    const res = await fetch(`${appUrl}/app/api/cron/gmail-sync`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
    });

    const data = await res.json() as { synced?: number; totalImported?: number };
    console.log(`[gmail-sync-cron] ok — vendors:${data.synced ?? 0} imported:${data.totalImported ?? 0}`);
    return { statusCode: 200 };
  } catch (err) {
    console.error("[gmail-sync-cron] error:", err);
    return { statusCode: 500 };
  }
});
