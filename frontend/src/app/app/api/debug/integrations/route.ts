import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/workspace-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

/**
 * Debug endpoint to check integrations setup
 * GET /app/api/debug/integrations
 */
export async function GET(request: Request) {
  const session = await getAuthSession();

  if (!session?.user?.id || !session.user.companyId) {
    return NextResponse.json(
      { error: "Not authenticated or no company assigned" },
      { status: 401 }
    );
  }

  try {
    const supabase = createAdminSupabaseClient();
    const diagnostics: Record<string, any> = {
      user: {
        id: session.user.id,
        companyId: session.user.companyId,
        role: session.user.role,
        email: session.user.email,
      },
      checks: {},
    };

    // Check 1: Can we connect to Supabase?
    const { data: tableTest } = await supabase
      .from("channel_credentials")
      .select("*")
      .limit(1);

    diagnostics.checks.supabaseConnection = {
      status: "ok",
      message: "Successfully connected to Supabase",
    };

    // Check 2: Do channel_credentials have the right columns?
    const { data: schema, error: schemaError } = await supabase
      .from("channel_credentials")
      .select("*")
      .eq("user_id", session.user.id)
      .limit(1);

    if (schemaError) {
      diagnostics.checks.channelCredentialsSchema = {
        status: "error",
        error: schemaError.message,
      };
    } else {
      const sampleRow = schema?.[0];
      if (sampleRow) {
        diagnostics.checks.channelCredentialsSchema = {
          status: "ok",
          columns: Object.keys(sampleRow),
          sampleRow,
        };
      } else {
        diagnostics.checks.channelCredentialsSchema = {
          status: "empty",
          message: "No channel_credentials records found for this user",
        };
      }
    }

    // Check 3: Get actual vendor data
    const { data: vendorData, error: vendorError } = await supabase
      .from("channel_credentials")
      .select("company_id, user_id, channel, status, updated_at, last_sync_at, credentials")
      .eq("company_id", session.user.companyId)
      .eq("user_id", session.user.id);

    if (vendorError) {
      diagnostics.checks.getVendorData = {
        status: "error",
        error: vendorError.message,
      };
    } else {
      diagnostics.checks.getVendorData = {
        status: "ok",
        rowCount: vendorData?.length || 0,
        data: vendorData,
      };
    }

    // Check 4: Get all companies and vendors
    const { data: companies } = await supabase
      .from("companies")
      .select("id, name")
      .eq("id", session.user.companyId);

    diagnostics.checks.company = {
      status: "ok",
      data: companies,
    };

    // Check 5: Get all users in this company
    const { data: users } = await supabase
      .from("users")
      .select("id, name, email, role")
      .eq("company_id", session.user.companyId);

    diagnostics.checks.usersInCompany = {
      status: "ok",
      count: users?.length || 0,
      data: users,
    };

    return NextResponse.json(diagnostics);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Debug check failed",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
