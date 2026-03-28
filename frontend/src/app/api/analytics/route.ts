import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const DEMO_COMPANY_ID = "11111111-1111-1111-1111-111111111111";

export async function GET() {
  const { data: leads, error } = await supabase
    .from("leads")
    .select("*")
    .eq("company_id", DEMO_COMPANY_ID);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const now = new Date();

  // Current metrics
  const totalLeads = leads.length;
  const closedWon = leads.filter((l) => l.status === "closed_won");
  const closedLost = leads.filter((l) => l.status === "closed_lost");
  const activeLeads = leads.filter(
    (l) => !["closed_won", "closed_lost"].includes(l.status)
  );

  const totalRevenue = closedWon.reduce(
    (sum, l) => sum + (l.estimated_amount || 0),
    0
  );
  const activePipeline = activeLeads.reduce(
    (sum, l) => sum + (l.estimated_amount || 0),
    0
  );

  const winRate =
    closedWon.length + closedLost.length > 0
      ? closedWon.length / (closedWon.length + closedLost.length)
      : 0;

  // Average deal size (from won deals)
  const avgDealSize =
    closedWon.length > 0 ? totalRevenue / closedWon.length : 0;

  // Average days to close (from won deals)
  const avgDaysToClose =
    closedWon.length > 0
      ? closedWon.reduce((sum, l) => {
          const created = new Date(l.created_at);
          const lastInteraction = new Date(l.last_interaction);
          return sum + (lastInteraction.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
        }, 0) / closedWon.length
      : 0;

  // Conversion funnel
  const funnel = {
    new: leads.filter((l) => l.status === "new").length,
    contacted: leads.filter((l) => l.status === "contacted").length,
    negotiating: leads.filter((l) => l.status === "negotiating").length,
    closed_won: closedWon.length,
    closed_lost: closedLost.length,
  };

  // Sentiment distribution
  const sentimentDist = {
    positive: leads.filter((l) => l.sentiment === "positive").length,
    neutral: leads.filter((l) => l.sentiment === "neutral").length,
    negative: leads.filter((l) => l.sentiment === "negative").length,
  };

  // Revenue by product
  const productRevenue: Record<string, number> = {};
  leads
    .filter((l) => l.status !== "closed_lost" && l.product_interest)
    .forEach((l) => {
      const product = l.product_interest!;
      productRevenue[product] =
        (productRevenue[product] || 0) + (l.estimated_amount || 0);
    });

  // Seller performance
  const sellerStats: Record<string, { leads: number; won: number; revenue: number }> = {};
  leads.forEach((l) => {
    const sid = l.seller_id || "unknown";
    if (!sellerStats[sid]) sellerStats[sid] = { leads: 0, won: 0, revenue: 0 };
    sellerStats[sid].leads++;
    if (l.status === "closed_won") {
      sellerStats[sid].won++;
      sellerStats[sid].revenue += l.estimated_amount || 0;
    }
  });

  // Predictions based on current velocity
  // Monthly lead creation rate
  const oldestLead = leads.reduce(
    (oldest, l) =>
      new Date(l.created_at) < new Date(oldest) ? l.created_at : oldest,
    leads[0]?.created_at || now.toISOString()
  );
  const daysSinceFirst =
    Math.max(
      (now.getTime() - new Date(oldestLead).getTime()) / (1000 * 60 * 60 * 24),
      1
    );
  const leadsPerDay = totalLeads / daysSinceFirst;

  const prediction30d = {
    estimated_new_leads: Math.round(leadsPerDay * 30),
    estimated_revenue: Math.round(leadsPerDay * 30 * winRate * avgDealSize),
    estimated_pipeline: Math.round(activePipeline + leadsPerDay * 30 * avgDealSize * (1 - winRate)),
  };

  const prediction90d = {
    estimated_new_leads: Math.round(leadsPerDay * 90),
    estimated_revenue: Math.round(leadsPerDay * 90 * winRate * avgDealSize),
    estimated_pipeline: Math.round(activePipeline + leadsPerDay * 90 * avgDealSize * (1 - winRate)),
  };

  return NextResponse.json({
    current: {
      total_leads: totalLeads,
      active_leads: activeLeads.length,
      total_revenue: totalRevenue,
      active_pipeline: activePipeline,
      win_rate: Math.round(winRate * 100),
      avg_deal_size: Math.round(avgDealSize),
      avg_days_to_close: Math.round(avgDaysToClose),
    },
    funnel,
    sentiment: sentimentDist,
    product_revenue: productRevenue,
    seller_stats: sellerStats,
    predictions: {
      "30d": prediction30d,
      "90d": prediction90d,
    },
  });
}
