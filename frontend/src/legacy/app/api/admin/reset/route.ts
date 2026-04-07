// @ts-nocheck
import { getSession } from "@/lib/auth";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;

const DEMO_COMPANY_ID = "11111111-1111-1111-1111-111111111111";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function supabaseDel(table: string, filter: string) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${table}?${filter}`,
    {
      method: "DELETE",
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        Prefer: "return=minimal",
      },
    }
  );
  return res.ok;
}

export async function POST() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return Response.json({ error: "No autorizado." }, { status: 403 });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return Response.json(
      { error: "Falta configurar la credencial server-side de Supabase." },
      { status: 500 }
    );
  }

  const steps: { step: string; ok: boolean; detail?: string }[] = [];

  // 1. Delete all interactions
  const intOk = await supabaseDel(
    "interactions",
    "id=neq.00000000-0000-0000-0000-000000000000"
  );
  steps.push({ step: "Borrar interacciones", ok: intOk });

  // 2. Delete all leads for demo company
  const leadsOk = await supabaseDel(
    "leads",
    `company_id=eq.${DEMO_COMPANY_ID}`
  );
  steps.push({ step: "Borrar leads", ok: leadsOk });

  // 3. Log out the Telegram bot (forces QR re-scan on next /connect)
  if (!TELEGRAM_BOT_TOKEN) {
    steps.push({ step: "Desconectar bot de Telegram", ok: false, detail: "TELEGRAM_BOT_TOKEN no configurado" });
  } else {
    try {
      const tgRes = await fetch(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/logOut`,
        { method: "POST" }
      );
      const tgData = await tgRes.json();
      steps.push({
        step: "Desconectar bot de Telegram",
        ok: tgData.ok === true,
        detail: tgData.ok ? undefined : tgData.description,
      });
    } catch (err) {
      steps.push({
        step: "Desconectar bot de Telegram",
        ok: false,
        detail: String(err),
      });
    }
  }

  const allOk = steps.every((s) => s.ok);
  return Response.json({ ok: allOk, steps }, { status: allOk ? 200 : 207 });
}
