import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let serverClient: SupabaseClient | null = null;

export function getSupabaseServerClient() {
  if (!serverClient) {
    const supabaseUrl =
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl) {
      throw new Error("Missing required environment variable: SUPABASE_URL");
    }

    if (!supabaseKey) {
      throw new Error(
        "Missing required environment variable: SUPABASE_SERVICE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY"
      );
    }

    serverClient = createClient(supabaseUrl, supabaseKey);
  }

  return serverClient;
}

export function getAnalyticsCompanyId() {
  return (
    process.env.ANALYTICS_COMPANY_ID || "11111111-1111-1111-1111-111111111111"
  );
}
