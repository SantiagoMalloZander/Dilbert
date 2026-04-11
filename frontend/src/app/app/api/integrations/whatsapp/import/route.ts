import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthSession } from "@/lib/workspace-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

const EVOLUTION_URL = process.env.EVOLUTION_API_URL || "http://localhost:8080";
const EVOLUTION_KEY = process.env.EVOLUTION_API_KEY || "";
const OPENAI_KEY = process.env.OPENAI_API_KEY || "";

const schema = z.object({
  instanceName: z.string(),
  mode: z.enum(["auto", "ai_classify", "manual_exclude"]),
  // For manual_exclude: phone numbers the vendor wants to skip
  excludedPhones: z.array(z.string()).optional(),
});

type WhatsAppChat = {
  id: string;
  name?: string;
  pushName?: string;
  lastMessage?: {
    conversation?: string;
    extendedTextMessage?: { text: string };
  };
};

type WhatsAppMessage = {
  key: { remoteJid: string; fromMe: boolean };
  message?: {
    conversation?: string;
    extendedTextMessage?: { text: string };
  };
  pushName?: string;
  messageTimestamp?: number;
};

function extractText(msg: WhatsAppMessage): string {
  return (
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    ""
  );
}

function parsePhone(jid: string): string {
  return jid.replace("@s.whatsapp.net", "").replace("@c.us", "");
}

function parseName(chat: WhatsAppChat): { first: string; last: string } {
  const raw = chat.name || chat.pushName || "";
  const parts = raw.trim().split(/\s+/);
  return {
    first: parts[0] || "Desconocido",
    last: parts.slice(1).join(" ") || "",
  };
}

async function fetchLastChats(instanceName: string): Promise<WhatsAppChat[]> {
  const res = await fetch(
    `${EVOLUTION_URL}/chat/findChats/${instanceName}`,
    { headers: { apikey: EVOLUTION_KEY } }
  );
  if (!res.ok) return [];
  const all: WhatsAppChat[] = await res.json();
  // Filter only individual chats (not groups), last 50
  return all
    .filter((c) => c.id.endsWith("@s.whatsapp.net"))
    .slice(0, 50);
}

async function fetchMessages(instanceName: string, jid: string, limit = 10): Promise<WhatsAppMessage[]> {
  const res = await fetch(
    `${EVOLUTION_URL}/chat/findMessages/${instanceName}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: EVOLUTION_KEY },
      body: JSON.stringify({ where: { key: { remoteJid: jid } }, limit }),
    }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : data.messages || [];
}

async function classifyContactsWithAI(
  chats: WhatsAppChat[],
  instanceName: string
): Promise<Set<string>> {
  // Fetch up to 10 messages per contact in parallel (batches of 5)
  const personalJids = new Set<string>();

  const batchSize = 5;
  for (let i = 0; i < chats.length; i += batchSize) {
    const batch = chats.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (chat) => {
        const messages = await fetchMessages(instanceName, chat.id, 10);
        if (messages.length === 0) return;

        const preview = messages
          .map((m) => {
            const who = m.key.fromMe ? "Yo" : (chat.name || chat.pushName || "Ellos");
            return `${who}: ${extractText(m)}`;
          })
          .filter(Boolean)
          .slice(0, 10)
          .join("\n");

        if (!preview.trim()) return;

        try {
          const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${OPENAI_KEY}`,
            },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              max_tokens: 10,
              messages: [
                {
                  role: "system",
                  content:
                    'Sos un clasificador. Dado el inicio de una conversación de WhatsApp, respondé SOLO con "personal" o "ventas". Personal = amigos, familia, conversaciones no comerciales. Ventas = clientes, prospectos, negocios.',
                },
                {
                  role: "user",
                  content: `Contacto: ${chat.name || chat.pushName || "Desconocido"}\n\n${preview}`,
                },
              ],
            }),
          });

          if (!aiRes.ok) return;
          const aiData = await aiRes.json();
          const label = aiData.choices?.[0]?.message?.content?.toLowerCase().trim();
          if (label === "personal") {
            personalJids.add(chat.id);
          }
        } catch {
          // if AI fails, assume sales contact
        }
      })
    );
  }

  return personalJids;
}

export async function POST(request: Request) {
  const session = await getAuthSession();

  if (!session?.user?.id || session.user.role !== "vendor" || !session.user.companyId) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { instanceName, mode, excludedPhones } = schema.parse(body);

    // 1. Fetch last 50 chats
    const chats = await fetchLastChats(instanceName);

    if (chats.length === 0) {
      return NextResponse.json({ imported: 0, message: "No se encontraron chats." });
    }

    // 2. Determine which contacts to exclude
    let excludedJids = new Set<string>();

    if (mode === "ai_classify") {
      excludedJids = await classifyContactsWithAI(chats, instanceName);
    } else if (mode === "manual_exclude" && excludedPhones?.length) {
      for (const chat of chats) {
        const phone = parsePhone(chat.id);
        if (excludedPhones.some((p) => p.replace(/\D/g, "") === phone.replace(/\D/g, ""))) {
          excludedJids.add(chat.id);
        }
      }
    }

    // 3. Import non-excluded contacts to Supabase
    const toImport = chats.filter((c) => !excludedJids.has(c.id));
    const supabase = createAdminSupabaseClient();

    const contactRows = toImport.map((chat) => {
      const { first, last } = parseName(chat);
      return {
        company_id: session.user.companyId!,
        created_by: session.user.id,
        assigned_to: session.user.id,
        first_name: first,
        last_name: last,
        phone: parsePhone(chat.id),
        source: "whatsapp" as const,
        tags: ["whatsapp-import"],
        custom_fields: { whatsapp_jid: chat.id, instance: instanceName },
      };
    });

    // Upsert by phone + company to avoid duplicates
    let imported = 0;
    for (const row of contactRows) {
      const { error } = await supabase.from("contacts").upsert(row, {
        onConflict: "company_id,phone",
        ignoreDuplicates: true,
      });
      if (!error) imported++;
    }

    return NextResponse.json({
      imported,
      total: chats.length,
      excluded: excludedJids.size,
      personalContacts: mode === "ai_classify"
        ? chats
            .filter((c) => excludedJids.has(c.id))
            .map((c) => ({ jid: c.id, name: c.name || c.pushName || "Desconocido" }))
        : [],
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
    }
    console.error("[whatsapp/import]", error);
    return NextResponse.json({ error: "Error al importar contactos." }, { status: 500 });
  }
}
