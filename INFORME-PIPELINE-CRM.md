# Informe — Pipeline de Automatización de Data Entry al CRM

> **Fecha:** 2026-05-26
> **Alcance:** El sistema que convierte conversaciones (Gmail, WhatsApp, Fathom, audio) en datos del CRM.
> **Método:** Análisis estático del código. La verificación en vivo queda **pendiente** (ver §5).
> **Documento hermano:** [AUDITORIA.md](AUDITORIA.md) (abril 2026) cubre la transición arquitectónica general. Este informe se enfoca solo en el pipeline de carga automática.

---

## 0. Aclaración de infraestructura (leer antes de verificar)

El pipeline de data-entry analizado **NO corre en Railway**. Railway hostea el bot de Telegram en Python (`bot/`), que es el sistema legacy.

El pipeline nuevo vive en `frontend/` y depende de:

- **Netlify** — hostea la app Next.js y la scheduled function de Gmail.
- **Supabase** — base de datos (contacts, leads, activities, agent_questions, contact_channel_links, gmail_queue).
- **OpenAI** — GPT-4o-mini (extracción) + Whisper (audio).
- **Gmail API / Evolution API / Fathom** — los canales de entrada.

Para verificar en vivo lo que está en este informe hay que tener **esos** servicios arriba, no Railway. Ver el plan de verificación en §5.

---

## 1. Arquitectura del pipeline

Entrada unificada en `runAgent()`. Flujo:

```
Canal → runAgent()
          ├─ 1. resolver identidad del contacto (cross-channel)
          ├─ 2. extraer datos estructurados (GPT-4o-mini, JSON, temp 0)
          ├─ 3. gate de relevancia (is_relevant_for_crm)
          ├─ 4. escribir al CRM (contacto + lead + stage + activity)
          └─ 5. encolar preguntas al vendedor por lo no resuelto
```

### Módulos (`frontend/src/lib/agent/`)

| Módulo | Archivo | Rol |
|---|---|---|
| Orquestador | `orchestrator.ts` | Punto de entrada único, coordina todo |
| Identity resolver | `identity-resolver.ts` | channel-link → email → teléfono (variantes AR) → fuzzy nombre+empresa |
| Extractor | `data-extractor.ts` | GPT-4o-mini, JSON estructurado, gate de relevancia |
| CRM writer | `crm-writer.ts` | Rellena contacto, crea/actualiza lead, avanza stage, crea activity |
| Deal detector | `deal-detector.ts` | Decide deal nuevo vs continuación (token overlap + GPT) |
| Stage resolver | `stage-resolver.ts` | Mapea keyword de IA → pipeline_stage real |
| Memory | `memory.ts` | Preferencias aprendidas + dedup de preguntas respondidas |

### Canales de entrada

| Canal | Entrada | ¿Usa `runAgent`? |
|---|---|---|
| Gmail | `gmail/sync` (encola) → `gmail/process` + cron c/10min | ✅ |
| WhatsApp | `webhooks/whatsapp` (Evolution API) | ✅ |
| Audio / llamada | `agent/transcribe` (Whisper) | ✅ |
| Fathom (reuniones) | `webhooks/fathom` | ❌ pipeline paralelo (ver F-04) |

### Loop de feedback al vendedor

Cuando el agente no puede resolver algo (identidad desconocida, conflicto de campo), encola una pregunta en `agent_questions`. El vendedor responde desde `/app/agente` y el handler:
- registra el channel-link (aprende la identidad), y/o
- aplica el cambio de campo, y/o
- **re-ejecuta `runAgent` con el contacto ya resuelto** (replay desde el `context` JSON guardado).

Diseño correcto y bien pensado. La memoria evita repreguntar lo mismo (umbral de similitud por token overlap).

---

## 2. Hallazgos priorizados

### 🔴 Calidad de datos (corromper el CRM)

#### F-01 — Moneda mal etiquetada: USD guardado como ARS
- **Dónde:** `crm-writer.ts` (insert de lead, `currency: "ARS"`) + `crm_schema` (`currency text not null default 'ARS'`).
- **Qué pasa:** El extractor convierte todo a USD ("Valores monetarios siempre en USD" en el system prompt de `data-extractor.ts`), pero el lead se guarda con `currency = 'ARS'`. Resultado: un número en dólares etiquetado como pesos. El pipeline de Fathom ni siquiera setea currency → cae al default ARS.
- **Impacto:** Todo el reporting de valor de pipeline queda inflado/mal. Relacionado con el commit reciente `Fix RangeError: Invalid currency code null`.
- **Fix sugerido:** Decidir una sola fuente de verdad. O bien (a) que el extractor devuelva `currency` y el valor en la moneda original, o (b) dejar todo en USD y setear `currency: "USD"` en el writer y en Fathom. No mezclar.

#### F-02 — Emails enviados por el vendedor extraen al vendedor como contacto
- **Dónde:** `data-extractor.ts`, hint de Gmail: *"La línea 'De:' contiene el email del CLIENTE"*.
- **Qué pasa:** En emails con `direction === "sent"`, el `De:` es el vendedor, no el cliente. La identidad se resuelve bien (el orchestrator usa el `external_email`, que para enviados es el `Para:`), pero el `contact_info.email/name` que extrae el modelo puede tomar al vendedor y contaminar el contacto vía `crm-writer.updateContact`.
- **Fix sugerido:** Pasar la dirección (`sent`/`received`) al extractor y ajustar el hint, o en `gmail/sync` etiquetar explícitamente quién es el cliente independientemente de De/Para.

#### F-03 — Sin idempotencia en WhatsApp ni Fathom
- **Dónde:** `webhooks/whatsapp` (no chequea `message.id`), `webhooks/fathom` (no chequea recording id).
- **Qué pasa:** Gmail deduplica (marker `<!-- gmail:id -->` + índice único en `gmail_queue`). WhatsApp y Fathom no. Un reintento del webhook (cosa normal en webhooks) crea activities/leads duplicados.
- **Fix sugerido:** Guardar el id externo del mensaje/reunión y rechazar duplicados (índice único o lookup previo). Para WhatsApp, dedup por `message.id`; para Fathom, por `recording.id`.

#### F-04 — Fathom corre un pipeline paralelo (lógica duplicada)
- **Dónde:** `webhooks/fathom` reimplementa creación de contacto, análisis IA (`analyzeTranscript`) y creación de lead, en vez de llamar a `runAgent` (que ya define `source: "fathom"`).
- **Qué pasa:** Dos "cerebros" que divergen. Fathom **no** usa identity-resolver (solo match por email exacto), ni memory, ni el gate de relevancia, ni stage-resolver (siempre crea en el primer stage). Cualquier mejora al pipeline central no llega a Fathom.
- **Fix sugerido:** Reescribir el webhook para que arme el `rawText` (resumen + transcript + action items) y delegue en `runAgent({ source: "fathom", ... })`. Eliminar la lógica duplicada.

### 🟠 Robustez / pérdida de datos

#### F-05 — Emails fallidos se descartan sin reintento
- **Dónde:** `gmail/process` y `cron/gmail-sync` borran el item de `gmail_queue` pase lo que pase ("don't retry infinitely").
- **Qué pasa:** Un fallo transitorio (timeout de OpenAI, error de red) = email perdido para siempre. No hay dead-letter ni contador de reintentos.
- **Fix sugerido:** Agregar `attempts` + `last_error` a `gmail_queue`. Borrar solo tras N intentos; mientras tanto, dejar en cola o mover a una tabla `gmail_dead_letter`.

#### F-06 — Fathom sin email de asistente = activity huérfana
- **Dónde:** `webhooks/fathom`. Si el asistente externo no trae email, `contactId` queda null, no se crea lead, pero **sí** se inserta la activity con `contact_id = null`.
- **Fix sugerido:** Fallback de identidad por nombre (o encolar pregunta al vendedor, como hace el orchestrator). Cubierto naturalmente si se resuelve F-04.

### 🟡 Seguridad de webhooks

#### F-07 — Webhook de WhatsApp sin autenticación
- **Dónde:** `webhooks/whatsapp`. El único "secreto" es el `instance_name` que viaja en el payload.
- **Qué pasa:** Quien adivine/conozca un instance name puede POSTear mensajes falsos y crear leads/contactos espurios en ese tenant.
- **Fix sugerido:** Header secreto compartido (Evolution API `apikey`/webhook token) validado antes de procesar.

#### F-08 — Fathom autentica con `?token=<userId>` en la URL
- **Dónde:** `webhooks/fathom`, `searchParams.get("token")` = el UUID del usuario.
- **Qué pasa:** El UUID queda en logs, proxies e historiales. Es identificador, no secreto.
- **Fix sugerido:** Token dedicado por integración (columna en `channel_credentials`), rotable, distinto del `user_id`.

### 🔵 Performance / costo (tolerable en hackathon, no con clientes reales)

| ID | Hallazgo | Dónde |
|---|---|---|
| F-09 | Match de teléfono = full table scan de contactos en JS por cada variante | `identity-resolver.ts` |
| F-10 | Dedup de Gmail escanea TODAS las activities con `LIKE '%<!-- gmail:%'` en cada sync; crece sin techo | `gmail/sync`, `cron/gmail-sync` |
| F-11 | Doble llamada a OpenAI para contactos nuevos (quick + full extraction) | `orchestrator.ts` |
| F-12 | `stageCache` a nivel módulo nunca se limpia entre requests en lambdas calientes → stages viejos si se edita el pipeline | `stage-resolver.ts` |
| F-13 | Log del cron reporta `data.totalImported` que la route nunca devuelve (cosmético) | `gmail-sync-cron.mts` |

---

## 3. Lo que está bien (no tocar)

- Diseño del orquestador como entrada única y el replay tras respuesta del vendedor.
- Gate de relevancia (`is_relevant_for_crm`) para filtrar newsletters/notificaciones.
- Memoria del agente con dedup de preguntas por similitud.
- Normalización de teléfonos argentinos con variantes (`+54 9` ↔ `+54`).
- Stage advancement "solo hacia adelante" (nunca retrocede el pipeline).
- Arquitectura de cola para Gmail (sync rápido sin IA + process con IA) que respeta el timeout de 10s de Netlify.

---

## 4. Orden de ataque recomendado

1. **F-01 (moneda)** — corrompe reporting hoy, fix chico.
2. **F-03 (idempotencia)** — evita duplicados, fix chico-medio.
3. **F-02 (emails enviados)** — calidad de contactos.
4. **F-04 (unificar Fathom)** — paga deuda y arregla F-06 de paso.
5. **F-05 (dead-letter Gmail)** — robustez.
6. **F-07 / F-08 (auth webhooks)** — antes de cualquier cliente real.
7. Performance (F-09 a F-13) — cuando crezca el volumen.

---

## 5. Plan de verificación en vivo (pendiente)

> Para correr cuando estén arriba los servicios. Recordatorio: esto **no** depende de Railway (eso es el bot Telegram legacy).

**Necesito que estén operativos:** Supabase (con el schema migrado), OpenAI key, y al menos un canal conectado (Gmail es el más fácil de probar end-to-end).

**Checks concretos:**

1. **F-01 moneda:** mandar un email/audio que mencione "USD 5.000" y otro "$5.000.000 ARS"; ver qué `value`/`currency` quedan en `leads`. Confirmar el mismatch.
2. **F-03 duplicados WhatsApp:** reenviar el mismo webhook dos veces; contar activities/leads creados.
3. **F-03 duplicados Fathom:** reenviar el mismo payload; idem.
4. **F-02 email enviado:** sincronizar un email que el vendedor *envió* a un cliente nuevo; ver si el contacto creado queda con el mail del cliente o del vendedor.
5. **F-05 pérdida:** simular fallo de OpenAI (key inválida) durante `process`; confirmar que el email desaparece de la cola sin quedar en ningún lado.
6. **Flujo feliz:** mandar un email comercial claro y verificar contacto + lead + stage + activity + (si aplica) pregunta al vendedor.

Cuando levantes los servicios, decime cuáles quedaron arriba y con qué cuenta de prueba, y arrancamos por el check #1.
