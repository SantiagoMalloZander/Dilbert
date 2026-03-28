# Dilbert: Contexto Integral Para Nuevos Chats

Este archivo resume el estado real del repo para abrir chats nuevos con contexto suficiente y pedir implementaciones sin tener que reexplicar toda la idea.

## 1. Que es Dilbert

Dilbert es un CRM asistido por IA para equipos comerciales.

La idea central es:

- el bot vive dentro de conversaciones de venta
- lee mensajes entre vendedor y cliente en Telegram
- extrae datos comerciales con OpenAI
- persiste leads e interacciones en Supabase
- muestra el pipeline y analitica en un dashboard Next.js

Tambien existe un flujo adicional para que el vendedor le mande al bot, por privado, texto o audio directo para cargar informacion manualmente al CRM.

## 2. Que esta implementado hoy

### Bot principal

El flujo real del bot vive sobre todo en:

- `bot/main.py`
- `bot/intake.py`
- `bot/extractor.py`
- `bot/db.py`
- `bot/proactive.py`
- `bot/transcription.py`
- `bot/validation.py`

Capacidades implementadas:

- escucha mensajes en grupos de Telegram
- bufferiza mensajes por `chat_id`
- dispara analisis por timeout o por cantidad de mensajes
- manda el transcript a OpenAI en JSON mode
- guarda o actualiza lead + crea interaccion en Supabase
- si faltan datos o hay ambiguedades, pregunta y re-analiza con la aclaracion
- en chat privado, auto-registra al vendedor si no existe
- en chat privado, acepta texto, audio y voice notes
- transcribe audio con Whisper
- evita duplicados en privados con `source_message_key`

### Dashboard web

El dashboard real vive en `frontend/` y tiene estas vistas:

- `/` pipeline en tiempo real
- `/leads/[id]` detalle de lead con interacciones
- `/metricas` panel de metricas generales
- `/analytics` analitica por comprador
- `/analytics/[leadId]` detalle analitico por cliente
- `/configuracion` vista de canales del bot
- `/crm/hubspot` vista de integracion HubSpot con sync saliente Dilbert -> HubSpot

### Modulo de analytics

Existe un modulo read-only que no escribe en DB:

- `bot/analytics.py` version Python
- `frontend/src/lib/analytics.ts` version TypeScript usada en produccion

Calcula:

- prediccion 30d y 90d
- probabilidad de recompra
- proximos dias esperados para compra
- segmento del cliente
- drivers comerciales principales

## 3. Arquitectura actual

### Flujo principal

1. Telegram recibe mensajes entre vendedor y cliente.
2. `bot/main.py` clasifica si el chat es grupal o privado.
3. En grupos:
   - acumula mensajes en `bot/buffer.py`
   - genera transcript
   - llama a `bot/extractor.py`
   - persiste con `bot/db.py`
4. En privados:
   - normaliza texto o transcribe audio
   - arma un transcript de nota directa al CRM
   - valida campos obligatorios y ambiguedades en `bot/validation.py`
   - si hace falta, guarda contexto pendiente en `bot/proactive.py`
   - si todo esta bien, escribe en Supabase
5. El frontend lee Supabase y muestra pipeline + analytics.

### Stack

- Bot: Python 3.11 + python-telegram-bot 21
- LLM: OpenAI `gpt-4o`
- Audio: OpenAI `whisper-1`
- DB: Supabase Postgres + Realtime
- Frontend: Next.js 16 + React 19 + Tailwind 4 + componentes UI
- Deploy bot: Railway
- Deploy frontend: Vercel

## 4. Modelo de datos

Tablas principales:

- `companies`
- `sellers`
- `leads`
- `interactions`

Puntos importantes:

- `leads` guarda estado comercial, monto, moneda, producto, sentimiento, proximos pasos y ultima interaccion
- `interactions` guarda transcript crudo, JSON extraido y resumen
- `interactions` tambien tiene metadata de origen para deduplicacion:
  - `source_type`
  - `source_chat_id`
  - `source_message_id`
  - `source_user_id`
  - `source_message_key`

Enums reales usados por el codigo:

- status: `new`, `contacted`, `negotiating`, `closed_won`, `closed_lost`
- sentiment: `positive`, `neutral`, `negative`
- currency: `ARS`, `USD`

## 5. Como esta partido el frontend

Hay dos estilos de implementacion conviviendo:

- vistas client-side que leen Supabase desde el browser
- vistas server-side que leen Supabase desde el server

Detalles importantes:

- la home (`frontend/src/app/page.tsx`) usa cliente browser y hardcodea `DEMO_COMPANY_ID`
- el detalle de lead (`frontend/src/app/leads/[id]/page.tsx`) tambien es client-side
- analytics usa `getAnalyticsContext()` del lado server y toma `ANALYTICS_COMPANY_ID`
- hay mezcla entre partes demo y partes mas cercanas a produccion

## 6. Verdades importantes del repo

Estas son las cosas mas utiles para no asumir mal en chats futuros:

- El flujo principal vigente del bot es `bot/main.py` + `bot/intake.py`, no `bot/handlers.py`.
- `bot/handlers.py` parece legacy y referencia funciones que ya no existen.
- El repo es de hackathon y tiene varias capas coexistiendo: demo, MVP y algunas extensiones insinuadas.
- El dashboard de CRM y el modulo de analytics comparten la misma base de datos, pero analytics es solo lectura.
- Existe sync saliente Dilbert -> HubSpot via `frontend/src/app/api/hubspot/sync/route.ts`, pero sigue siendo parcial: usa `HUBSPOT_API_KEY`, empresa demo hardcodeada y no hay import ni sync bidireccional.
- Las vistas de WhatsApp, Instagram, Messenger y Slack son placeholders de producto, no integraciones reales.
- El bot ya soporta carga directa por privado con texto o audio, que hoy es una de las features mas "productizadas".
- La deduplicacion de mensajes privados ya esta contemplada a nivel DB + codigo.

## 7. Inconsistencias o deuda tecnica visibles

Esto no invalida el repo, pero hay que saberlo antes de tocar cosas:

- `.env.example` no incluye variables de la integracion HubSpot, aunque ya existe una ruta server-side de sync.
- `supabase/config.toml` apunta a `./seed.sql`, pero los seeds reales estan en `supabase/migrations/`.
- `README.md` describe bien la idea general, pero no siempre refleja el estado exacto mas reciente.
- Algunas vistas frontend venden integraciones futuras que todavia no existen en backend.
- El estilo de acceso a datos en frontend no esta unificado: algunas paginas usan browser client y otras server client.
- Hay una duplicacion conceptual entre `bot/analytics.py` y `frontend/src/lib/analytics.ts`.
- La ruta de sync de HubSpot hoy usa `DEMO_COMPANY_ID` hardcodeado y cliente Supabase creado con `NEXT_PUBLIC_SUPABASE_ANON_KEY`, o sea que todavia no esta cerrada como integracion multi-company robusta.

## 8. Restricciones de producto que conviene respetar

Si se implementan features nuevas, asumir esto salvo que se decida lo contrario:

- no hay auth real
- hay una empresa demo por default
- la experiencia principal sigue siendo Telegram -> CRM -> dashboard
- no romper la persistencia actual en Supabase
- no romper realtime del pipeline
- mantener el bot async
- no inventar un backend separado si Supabase ya cubre la necesidad

## 9. Mapa rapido de responsabilidades por archivo

- `bot/main.py`: entrypoint, routing de mensajes, comandos, buffer y disparo de analisis
- `bot/intake.py`: flujo privado, validacion, respuestas al vendedor, escritura controlada
- `bot/extractor.py`: llamada a OpenAI y parseo del JSON
- `bot/prompts.py`: prompt de extraccion comercial
- `bot/db.py`: lookup de sellers, upsert de leads, insert de interactions
- `bot/validation.py`: reglas para bloquear escritura o pedir aclaracion
- `bot/proactive.py`: estado temporal de aclaraciones pendientes
- `bot/transcription.py`: descarga y transcripcion de audio
- `bot/analytics.py`: motor analitico Python read-only
- `frontend/src/lib/queries.ts`: acceso server-side a Supabase
- `frontend/src/lib/analytics.ts`: motor analitico productivo del frontend
- `frontend/src/app/page.tsx`: pipeline principal
- `frontend/src/app/analytics/page.tsx`: modulo de analitica
- `frontend/src/app/analytics/[leadId]/page.tsx`: detalle analitico por cliente
- `frontend/src/app/api/hubspot/sync/route.ts`: sync saliente de leads hacia HubSpot

## 10. Prompt base para abrir un chat nuevo

Pegar esto como punto de partida:

```text
Estoy trabajando sobre Dilbert, un CRM asistido por IA para ventas.

Contexto real del repo:
- Bot en Python que escucha conversaciones de Telegram.
- Extrae datos comerciales con OpenAI GPT-4o.
- Guarda leads e interacciones en Supabase.
- Tiene flujo de aclaraciones cuando faltan datos o hay ambiguedades.
- Soporta carga directa por privado con texto y audio, incluyendo transcripcion.
- Frontend en Next.js con pipeline, detalle de leads, metricas y analytics por comprador.
- Analytics es read-only y hoy vive tanto en Python como en TypeScript.
- Hay deuda tecnica de hackathon: `bot/handlers.py` legacy, `supabase/config.toml` con seed desalineado y mezcla de paginas demo y productivas.

Quiero que primero leas el codigo relevante antes de proponer cambios y que respetes la arquitectura existente.
```

## 11. Prompt para pedir una feature nueva

```text
Necesito implementar esta feature en Dilbert: [DESCRIBIR FEATURE].

Usa este contexto:
- El core del producto es Telegram -> OpenAI extraction -> Supabase -> dashboard Next.js.
- El flujo principal del bot esta en `bot/main.py` y `bot/intake.py`.
- La persistencia esta en `bot/db.py`.
- Si la feature toca analytics, revisar tambien `frontend/src/lib/analytics.ts` y `bot/analytics.py`.
- Si la feature toca UI, mantener el lenguaje visual y evitar inventar integraciones que no existan en backend.
- Si hay que elegir, priorizar consistencia con el flujo actual antes que agregar capas nuevas.

Quiero que:
1. identifiques los archivos a tocar
2. expliques el impacto en datos y flujo
3. implementes la solucion completa
4. verifiques con tests o checks locales si aplica
```

## 12. Prompt para debugging o refactor

```text
Quiero debuggear/refactorizar [PROBLEMA].

Antes de cambiar codigo:
- reconstrui el flujo real desde los archivos actuales
- distingui que es codigo vigente y que es legacy/demo
- no asumas que README o docs estan 100% sincronizados con el repo

En el resultado quiero:
- causa raiz
- archivos afectados
- solucion concreta alineada con la arquitectura actual
- riesgos o inconsistencias relacionadas que valga la pena corregir
```

## 13. Si el objetivo es sumar features grandes

Las features mas naturales por el estado actual del repo son:

- unificar acceso a datos del frontend
- endurecer la integracion HubSpot actual para volverla configurable y multi-company de verdad
- agregar canales nuevos reutilizando el patron de intake
- persistir analytics precomputado si hiciera falta performance
- mejorar matching de leads existentes
- versionar mejor prompts y contratos de extraccion
- agregar auth y multi-company de verdad

## 14. Resumen corto para humanos

Dilbert ya no es solo un bot de demo: hoy tiene un core funcional de captura comercial, guardado en CRM, detalle de interacciones y una capa analitica bastante avanzada. Pero sigue teniendo deuda de hackathon y partes de producto "dibujadas" en UI antes que implementadas en backend. Cualquier feature nueva conviene encararla respetando ese mapa: fortalecer lo que ya existe, no reescribir desde cero.
