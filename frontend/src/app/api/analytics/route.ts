import { NextResponse } from "next/server";

import { buildAnalyticsReport } from "@/lib/analytics";
import { getAnalyticsContext } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const context = await getAnalyticsContext();
    const report = buildAnalyticsReport(context);
    return NextResponse.json(report);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error generando analytics";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
