# Dilbert — Project Context

> Última actualización: 2026-05-27 — pivot a CRM inmobiliario.

## Qué es Dilbert hoy
**Anti-data-entry CRM para inmobiliarias.** El motor del agente IA captura
conversaciones (WhatsApp, Gmail, audios, reuniones) y las convierte en
contactos, búsquedas y actividades dentro del CRM, sin que el vendedor cargue
nada a mano.

- **ICP:** agencias y brokers inmobiliarios chicos/medianos en Argentina.
- **Wedge:** no competimos con Tokko/Zonaprop (inventario / portales). Capturamos
  la capa conversacional que vive en WhatsApp, audios y email, y la dejamos
  estructurada en el CRM.
- **Bot Meta Ads → vendedores:** próxima fase. Hoy el foco es el CRM 100%
  pulido para que cualquier inmobiliaria pueda operar.

## Stack
- **Frontend / app activa:** `frontend/` (Next.js 16 + Tailwind + shadcn/ui en
  Netlify). Workspace en `/app/*`.
- **Backend:** API routes de Next + Supabase (Postgres con RLS) como source of
  truth.
- **Agente:** `frontend/src/lib/agent/` (orchestrator → identity-resolver →
  data-extractor (GPT-4o-mini) → crm-writer → loop de revisión vía
  `agent_questions`).
- **Conectores CRM:** `frontend/src/lib/agent/crm/` con interfaz `CRMConnector`,
  `NativeSupabaseConnector` (default) y `HubSpotConnector` (reference para
  "bring your own CRM").
- **Vertical:** perfil `real_estate` en el extractor + columnas first-class en
  `leads` + zonas en `Configuración`.

## Modelo de datos clave
- `companies`, `users`, `authorized_emails`, `invite_links` — multi-tenant + auth.
- `contacts` — la persona (comprador / vendedor / propietario / inquilino).
- `leads` — una BÚSQUEDA o INTERÉS por una propiedad. Un contacto puede tener
  varios leads (varias búsquedas). Trae columnas first-class de real estate:
  `operation_type`, `client_role`, `property_type`, `zone`, `city`, `province`,
  `budget_min/max`, `budget_currency`, `rooms` (ambientes), `bedrooms`
  (dormitorios), `bathrooms`, `surface_total/covered`, `has_garage`, `urgency`,
  `timeline`, `listing_ref`, `visit_status`, `financing`.
- `pipelines` + `pipeline_stages` — Kanban configurable.
- `activities` — timeline (email/whatsapp/llamada/reunión), con `external_id`
  (idempotencia por canal) e índice único `(company_id, external_id)`.
- `notes` — notas manuales/automáticas.
- `agent_questions` — review queue (preguntas que el agente le hace al vendedor).
- `contact_channel_links` — índice cross-canal (teléfono ↔ email ↔ JID).
- `gmail_queue` — cola async (sync rápido sin IA → process con IA).
- `property_zones` — zonas que cubre la inmobiliaria (Configuración).
- `channel_credentials` — tokens de Gmail / Evolution (WhatsApp) / Fathom.

## Pantallas del workspace (`/app/*`)
- **CRM** (`/app/crm`): dashboard con KPIs + Kanban (`/app/crm/leads`) +
  Contactos (`/app/crm/contacts`).
- **Analytics** (`/app/crm/analytics`): KPIs, funnel por etapa, inteligencia
  inmobiliaria (próximas visitas, leads urgentes, leads por operación / zona /
  tipo de propiedad).
- **Agente IA** (`/app/agente`): inbox de revisión + carga manual de audio.
- **Integraciones** (`/app/integrations`): Gmail OAuth, WhatsApp (Evolution),
  Fathom.
- **Centro de Usuarios** (`/app/users`): owner agrega/revoca vendedores.
- **Configuración** (`/app/settings`, owner): gestor de zonas (`property_zones`).
- **Mi Perfil** (`/app/account`).
- **Admin** (`/app/admin`, super admin): crear empresas, impersonar.

## Canales conectados al agente
| Canal | Entrada | Estado |
|---|---|---|
| Gmail | OAuth + cola + cron 10min | OK |
| WhatsApp | webhook Evolution API | OK (auth débil — follow-up) |
| Fathom (reuniones) | webhook → `runAgent` | OK |
| Audio | upload + Whisper | OK |

## Configuración por tenant
- `companies.settings.vertical = "real_estate"` (default tras el pivot).
- `companies.settings.crm_connector = "hubspot"` opcional → activa el
  HubSpotConnector (mirror best-effort).
- `companies.settings.agent_context` — contexto libre que el owner inyecta al
  prompt del agente.

## Lo que NO está en alcance (por ahora)
- Inventario de propiedades / MLS / publicación en portales (lo cubren Tokko,
  Zonaprop, Argenprop).
- Bot de WhatsApp para recibir y distribuir leads de Meta Ads (próxima fase —
  no se está construyendo todavía).
- Sincronización bidireccional con CRMs externos.
- Outbound automation, telefonía integrada, analytics pesados.

## Deuda conocida prioritaria
- **Seguridad:** secrets que se vieron en chats antes (rotar antes del primer
  cliente real); auth débil en webhook de WhatsApp; RLS no habilitada en todas
  las tablas core.
- **Lead form:** el alta manual de lead todavía no expone las columnas
  inmobiliarias (queda como follow-up: que el vendedor pueda crear una búsqueda
  a mano con todos los campos).
- **Zonas en el extractor:** ya cargamos `property_zones`, falta usarlas para
  validar la zona extraída y marcar como sospechosa una zona que no cubrimos.
- **Capa de aprobación:** el review queue existe, pero no todo lo que escribe
  el agente pasa por ahí — para el primer piloto inmobiliario serio conviene
  forzar "review-everything" antes de auto-apply.
