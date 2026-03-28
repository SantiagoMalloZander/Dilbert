import json
import os
from openai import AsyncOpenAI

client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

SYSTEM_PROMPT = """Sos un asistente que extrae datos de ventas de conversaciones de chat.
Analizá los mensajes y extraé la siguiente información en JSON:

{
  "client_name": "nombre del cliente o null",
  "client_company": "empresa del cliente o null",
  "product_interest": "producto/servicio mencionado o null",
  "estimated_amount": number o null,
  "currency": "ARS" | "USD" | null,
  "sentiment": "positive" | "neutral" | "negative",
  "status": "new" | "contacted" | "negotiating" | "closed_won" | "closed_lost",
  "next_steps": "próximos pasos o null",
  "summary": "resumen breve de la conversación",
  "needs_clarification": false,
  "clarification_question": null
}

Si algo no es claro, poné needs_clarification: true y una pregunta en clarification_question.
Respondé SOLO con JSON válido."""

async def extract_sales_data(messages: list[dict]) -> dict | None:
    conversation = "\n".join(
        f"{m['from']}: {m['text']}" for m in messages
    )

    response = await client.chat.completions.create(
        model="gpt-4o",
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": conversation},
        ],
        temperature=0.1,
    )

    content = response.choices[0].message.content
    if content:
        return json.loads(content)
    return None
