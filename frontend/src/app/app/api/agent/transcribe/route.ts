/**
 * POST /app/api/agent/transcribe
 *
 * Accepts a multipart/form-data upload with:
 *   - file: audio file (mp3, wav, m4a, webm, ogg, etc.)
 *   - contactName?: optional hint for contact name
 *   - phoneNumber?: optional hint for phone number
 *
 * Flow:
 *   1. Transcribe audio with OpenAI Whisper
 *   2. Run the CRM agent on the transcript (creates contact + lead + activity)
 *   3. Return agent result
 */

import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/workspace-auth";
import { runAgent } from "@/lib/agent/orchestrator";

const OPENAI_KEY = process.env.OPENAI_API_KEY ?? "";

export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id || !session.user.companyId) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  if (!OPENAI_KEY) {
    return NextResponse.json({ error: "OpenAI no configurado." }, { status: 500 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Formato inválido. Enviá multipart/form-data." }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "Falta el campo 'file'." }, { status: 400 });
  }

  const contactName = (formData.get("contactName") as string | null)?.trim() || undefined;
  const phoneNumber = (formData.get("phoneNumber") as string | null)?.trim() || undefined;

  // ── Step 1: Transcribe with Whisper ─────────────────────────────────────────
  let transcript: string;
  try {
    const whisperForm = new FormData();
    whisperForm.append("file", file, file.name || "audio.webm");
    whisperForm.append("model", "whisper-1");
    whisperForm.append("language", "es"); // hint Spanish for better accuracy

    const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_KEY}` },
      body: whisperForm,
    });

    if (!whisperRes.ok) {
      const errText = await whisperRes.text();
      console.error("[transcribe] Whisper error", whisperRes.status, errText);
      return NextResponse.json({ error: "Error al transcribir el audio." }, { status: 502 });
    }

    const whisperJson = await whisperRes.json() as { text: string };
    transcript = whisperJson.text?.trim() ?? "";
  } catch (err) {
    console.error("[transcribe] Whisper fetch error", err);
    return NextResponse.json({ error: "Error de conexión con Whisper." }, { status: 502 });
  }

  if (!transcript) {
    return NextResponse.json({ error: "No se pudo extraer texto del audio." }, { status: 422 });
  }

  // ── Step 2: Build raw text with optional hints ───────────────────────────────
  const hints: string[] = [];
  if (contactName) hints.push(`Nombre del contacto (dato del vendedor): ${contactName}`);
  if (phoneNumber) hints.push(`Teléfono del contacto (dato del vendedor): ${phoneNumber}`);

  const rawText = hints.length
    ? `${hints.join("\n")}\n\n---\n\nTranscripción:\n${transcript}`
    : `Transcripción:\n${transcript}`;

  // ── Step 3: Run CRM agent ────────────────────────────────────────────────────
  try {
    const result = await runAgent({
      companyId: session.user.companyId,
      userId: session.user.id,
      source: "audio",
      rawText,
      channelIdentifier: phoneNumber,
      senderName: contactName,
      occurredAt: new Date().toISOString(),
    });

    return NextResponse.json({
      ok: true,
      transcript,
      ...result,
    });
  } catch (err) {
    console.error("[transcribe] runAgent error", err);
    return NextResponse.json({ error: "Error al procesar la transcripción en el CRM." }, { status: 500 });
  }
}
