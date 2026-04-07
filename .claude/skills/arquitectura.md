# Arquitectura Dilbert — Documento de Referencia

> **Versión:** 1.0
> **Estado:** En construcción activa
> **Última actualización:** Abril 2026
> Este documento es la fuente de verdad técnica del proyecto. Cualquier decisión de arquitectura que no esté acá, debe agregarse acá antes de implementarse.

---

## 1. Visión del Producto

Dilbert es un CRM con carga automática de datos. Se conecta a todos los canales de comunicación y conferencia de un equipo de ventas (WhatsApp, Gmail, Meet, Zoom, etc.) y vuelca la información relevante al CRM automáticamente, sin intervención manual del vendedor.

**Etapa actual:** Construcción del CRM base (esqueleto escalable).
**Etapa siguiente:** Integración de canales de comunicación.
**Etapa futura:** Agente AI que responde preguntas sobre los datos de clientes.

---

## 2. Stack Tecnológico

| Capa | Tecnología | Notas |
|---|---|---|
| Frontend | Next.js 14 (App Router) | Deployado en Netlify |
| Estilos | Tailwind CSS + shadcn/ui | Mantener estética existente |
| Auth | Supabase Auth | Google OAuth + Microsoft OAuth + Email/OTP |
| Base de datos | PostgreSQL (Supabase) | RLS para multi-tenant |
| Storage | Supabase Storage | Avatares, adjuntos |
| Emails transaccionales | Resend.dev | OTP, invitaciones, notificaciones |
| Edge Functions | Supabase Edge Functions | Lógica de negocio pesada, crons |
| Hosting | Netlify | dilbert.netlify.app |

---

## 3. Arquitectura General

Dilbert usa una arquitectura **modular orientada a dominios** (Domain-Driven Design simplificado), implementada inicialmente como un monolito modular dentro de Next.js, con la estructura preparada para extraer módulos como microservicios independientes en el futuro.

```
┌─────────────────────────────────────────────────────────┐
│                    dilbert.netlify.app                  │
│                                                         │
│  /              → Landing (estática)                    │
│  /app           → Auth (login / registro)               │
│  /app/crm       → CRM Core (protegido)                  │
│  /app/users     → Centro de Usuarios (solo Owner)       │
│  /app/integrations → Integraciones (solo Vendor)        │
│  /app/account   → Perfil de usuario                     │
│  /admin         → Super Admin Dilbert                   │
└────────────────────────┬────────────────────────────────┘
                         │ API Routes / Server Actions
                         ▼
┌─────────────────────────────────────────────────────────┐
│                    Módulos de dominio                   │
│                                                         │
│  auth/          → Autenticación, sesiones, roles        │
│  crm/           → Contactos, leads, pipeline, notas     │
│  users/         → Gestión de usuarios por empresa       │
│  integrations/  → Canales conectados (futuro)           │
│  notifications/ → Emails, alertas internas              │
│  admin/         → Super admin Dilbert                   │
│  ai-agent/      → Agente AI (futuro)                    │
└────────────────────────┬────────────────────────────────┘
                         │ Supabase Client / Service Role
                         ▼
┌─────────────────────────────────────────────────────────┐
│                    Supabase                             │
│                                                         │
│  Auth           → Usuarios, sesiones, OAuth             │
│  PostgreSQL     → Datos del negocio con RLS             │
│  Storage        → Archivos y adjuntos                   │
│  Edge Functions → Crons, webhooks, lógica pesada        │
│  Realtime       → Notificaciones en tiempo real (futuro)│
└─────────────────────────────────────────────────────────┘
```

### Estado actual de módulos

| Módulo | Estado actual | Alcance implementado | Falta principal |
|---|---|---|---|
| `auth` | En producción | Email-first, login con contraseña, OTP, OAuth, sesiones SSR, pending-access | Endurecer monitoreo y observabilidad del flujo |
| `crm/leads` | En producción | Dashboard, Kanban, detalle lateral, mutaciones base, KPIs server-side | Automatizaciones, borrado y reporting avanzado |
| `crm/contacts` | En producción | Tabla paginada, búsqueda, detalle lateral, create/update, lead inline | Importación masiva y custom fields avanzados |
| `users` | En producción | Centro de Usuarios, cupo de vendedores, revoke access, invite links | Auditoría visible en UI y notificaciones al Owner |
| `integrations` | Base operativa | Grid vendor, vista owner, placeholders, persistencia `pending` | Conexiones reales a canales y validación de credenciales |
| `admin` | En producción | Alta/baja de empresas, impersonación, vendor management | Billing, salud por tenant y soporte operativo |
| `notifications` | Parcial | OTP, emails de alta/invitación y confirmaciones transaccionales | Centro de notificaciones interno |
| `ai-agent` | No iniciado | Sin implementación | Integraciones, extracción de datos y asistente AI |

---

## 4. Multi-tenancy

Dilbert es **100% multi-tenant**. Cada empresa cliente es un tenant completamente aislado.

**Estrategia:** Schema compartido con Row Level Security (RLS).
Todas las tablas de negocio tienen `company_id` (uuid) como columna de aislamiento.

**Reglas:**
- Ningún usuario puede ver datos de otra empresa, ni siquiera por error.
- El Super Admin (`dilbert@gmail.com`) tiene acceso a todos los tenants usando el `service_role` key de Supabase (bypasea RLS).
- Toda query del lado del servidor debe incluir el `company_id` del usuario autenticado.
- En el frontend nunca se expone el `service_role` key.

---

## 5. Roles y Permisos

| Rol | Código | Descripción | Límite |
|---|---|---|---|
| Super Admin | `super_admin` | Dilbert (Santiago). Acceso total a todos los tenants. | 1 (hardcodeado) |
| Owner | `owner` | Dueño/gerente de la empresa cliente. Configuración total del tenant. | 1 por empresa |
| Analista | `analyst` | Solo lectura. Ve dashboards, KPIs y reportes. | Ilimitado |
| Vendedor | `vendor` | Conecta canales, carga datos, ve sus leads. | **Limitado por plan** |

**Importante:** Solo los Vendedores tienen límite. El plan de cada empresa define cuántos Vendedores puede tener. Los Analistas son ilimitados. Por eso el negocio cobra por Vendedor.

### Matriz de permisos por módulo

| Módulo | Super Admin | Owner | Analista | Vendedor |
|---|---|---|---|---|
| CRM — Ver todos los leads | ✅ | ✅ | ✅ | Solo los propios |
| CRM — Crear/editar leads | ✅ | ✅ | ❌ | ✅ (propios) |
| CRM — Eliminar leads | ✅ | ✅ | ❌ | ❌ |
| Centro de Usuarios | ✅ | ✅ | ❌ | ❌ |
| Integraciones | ✅ | Ver | ❌ | ✅ (propias) |
| /admin | ✅ | ❌ | ❌ | ❌ |
| KPIs globales | ✅ | ✅ | ✅ | Solo propios |

---

## 6. Modelo de Datos

### Entidades principales

```
companies
├── id (uuid, PK)
├── name (text)
├── slug (text, unique) — para URLs amigables
├── vendor_limit (int) — máximo de vendedores contratados
├── status (enum: active, inactive, suspended)
├── plan (enum: starter, pro, enterprise) — para futuro billing
├── settings (jsonb) — configuraciones del tenant
└── created_at, updated_at

users
├── id (uuid, PK) — mismo que Supabase Auth uid
├── company_id (uuid, FK → companies)
├── email (text, unique)
├── name (text)
├── avatar_url (text)
├── role (enum: owner, analyst, vendor)
├── department (text)
├── phone (text)
├── is_active (bool)
└── created_at, updated_at

authorized_emails
├── id (uuid, PK)
├── company_id (uuid, FK → companies)
├── email (text)
├── role (enum: analyst, vendor) — rol que tendrá al registrarse
├── added_by (uuid, FK → users)
└── created_at

invite_links
├── id (uuid, PK)
├── company_id (uuid, FK → companies)
├── token (text, unique)
├── expires_at (timestamp) — regenera cada 24hs
└── created_at

contacts
├── id (uuid, PK)
├── company_id (uuid, FK → companies)
├── assigned_to (uuid, FK → users, nullable)
├── first_name, last_name (text)
├── email (text)
├── phone (text)
├── company_name (text) — empresa del contacto (no el tenant)
├── position (text)
├── source (enum: manual, whatsapp, gmail, instagram, zoom, meet, import)
├── tags (text[])
├── custom_fields (jsonb) — campos personalizables por tenant
└── created_at, updated_at, created_by

leads
├── id (uuid, PK)
├── company_id (uuid, FK → companies)
├── contact_id (uuid, FK → contacts)
├── assigned_to (uuid, FK → users)
├── pipeline_id (uuid, FK → pipelines)
├── stage_id (uuid, FK → pipeline_stages)
├── title (text)
├── value (numeric) — valor estimado de la oportunidad
├── currency (text, default: 'ARS')
├── probability (int) — 0-100
├── expected_close_date (date)
├── status (enum: open, won, lost, paused)
├── lost_reason (text, nullable)
├── source (enum: manual, whatsapp, gmail, instagram, zoom, meet, import)
├── metadata (jsonb) — datos extra cargados por el agente AI futuro
└── created_at, updated_at, created_by

pipelines
├── id (uuid, PK)
├── company_id (uuid, FK → companies)
├── name (text)
├── is_default (bool)
└── created_at

pipeline_stages
├── id (uuid, PK)
├── pipeline_id (uuid, FK → pipelines)
├── company_id (uuid, FK → companies)
├── name (text)
├── color (text) — hex color
├── position (int) — orden de la etapa
├── is_won_stage (bool)
├── is_lost_stage (bool)
└── created_at

activities
├── id (uuid, PK)
├── company_id (uuid, FK → companies)
├── lead_id (uuid, FK → leads, nullable)
├── contact_id (uuid, FK → contacts, nullable)
├── user_id (uuid, FK → users)
├── type (enum: call, email, meeting, note, task, whatsapp, instagram)
├── title (text)
├── description (text)
├── scheduled_at (timestamp, nullable)
├── completed_at (timestamp, nullable)
├── source (enum: manual, automatic) — automatic = cargado por el agente
└── created_at

notes
├── id (uuid, PK)
├── company_id (uuid, FK → companies)
├── lead_id (uuid, FK → leads, nullable)
├── contact_id (uuid, FK → contacts, nullable)
├── user_id (uuid, FK → users)
├── content (text)
├── source (enum: manual, automatic)
└── created_at, updated_at

channel_credentials
├── id (uuid, PK)
├── user_id (uuid, FK → users)
├── company_id (uuid, FK → companies)
├── channel (enum: whatsapp_business, whatsapp_personal, gmail, instagram, meet, zoom, teams, fathom)
├── credentials (jsonb) — encriptado
├── status (enum: connected, disconnected, error, pending)
├── last_sync_at (timestamp)
└── created_at, updated_at

audit_log (trazabilidad)
├── id (uuid, PK)
├── company_id (uuid, FK → companies)
├── user_id (uuid, FK → users)
├── action (text) — ej: 'lead.created', 'contact.updated', 'user.removed'
├── entity_type (text)
├── entity_id (uuid)
├── changes (jsonb) — {before: {}, after: {}}
└── created_at
```

### Relaciones clave

```
Company 1 ──< Users (N)
Company 1 ──< Contacts (N)
Company 1 ──< Leads (N)
Company 1 ──< Pipelines (N)
Pipeline 1 ──< Pipeline_Stages (N)
Contact 1 ──< Leads (N)
Lead 1 ──< Activities (N)
Lead 1 ──< Notes (N)
User (vendor) 1 ──< Channel_Credentials (N)
```

---

## 7. Estructura de Carpetas del Proyecto

```
/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Grupo de rutas públicas
│   │   └── app/                  # /app — pantalla de login/registro
│   ├── (protected)/              # Grupo de rutas protegidas
│   │   ├── app/
│   │   │   ├── crm/              # CRM principal
│   │   │   │   ├── leads/        # Vista Kanban y lista de leads
│   │   │   │   ├── contacts/     # Gestión de contactos
│   │   │   │   ├── pipeline/     # Configuración del pipeline
│   │   │   │   └── page.tsx      # Dashboard con KPIs
│   │   │   ├── users/            # Centro de usuarios (solo Owner)
│   │   │   ├── integrations/     # Canales (solo Vendor)
│   │   │   └── account/          # Perfil de usuario
│   │   └── admin/                # Super admin (solo dilbert@gmail.com)
│   ├── api/                      # API Routes
│   │   ├── auth/                 # Endpoints de auth
│   │   ├── crm/                  # Endpoints del CRM
│   │   ├── users/                # Endpoints de usuarios
│   │   └── admin/                # Endpoints del admin
│   └── layout.tsx
│
├── modules/                      # Módulos de dominio (lógica de negocio)
│   ├── auth/
│   │   ├── actions.ts            # Server Actions de auth
│   │   ├── queries.ts            # Queries de Supabase
│   │   └── types.ts
│   ├── crm/
│   │   ├── contacts/
│   │   │   ├── actions.ts
│   │   │   ├── queries.ts
│   │   │   └── types.ts
│   │   ├── leads/
│   │   │   ├── actions.ts
│   │   │   ├── queries.ts
│   │   │   └── types.ts
│   │   └── pipeline/
│   │       ├── actions.ts
│   │       ├── queries.ts
│   │       └── types.ts
│   ├── users/
│   ├── integrations/
│   ├── notifications/
│   └── admin/
│
├── components/                   # Componentes reutilizables
│   ├── ui/                       # shadcn/ui base components
│   ├── layout/                   # Sidebar, Header, etc.
│   ├── crm/                      # Componentes específicos del CRM
│   │   ├── KanbanBoard.tsx
│   │   ├── LeadCard.tsx
│   │   ├── ContactTable.tsx
│   │   └── PipelineStage.tsx
│   └── shared/                   # Componentes compartidos
│
├── lib/                          # Utilidades y configuración
│   ├── supabase/
│   │   ├── client.ts             # Browser client
│   │   ├── server.ts             # Server client (con service role)
│   │   └── middleware.ts
│   ├── auth/
│   │   └── permissions.ts        # Helpers de permisos por rol
│   └── utils.ts
│
├── supabase/
│   ├── migrations/               # Migraciones SQL versionadas
│   ├── functions/                # Supabase Edge Functions
│   │   ├── rotate-invite-tokens/ # Cron: rota tokens cada 24hs
│   │   └── audit-logger/         # Trigger: registra cambios en audit_log
│   └── seed.sql                  # Datos de prueba
│
├── middleware.ts                 # Protección de rutas
├── arquitectura.md               # Este archivo
└── .env.example
```

---

## 8. Convenciones de Código

### Naming
- Componentes React: `PascalCase` (ej: `LeadCard.tsx`)
- Funciones y variables: `camelCase`
- Constantes globales: `UPPER_SNAKE_CASE`
- Archivos no-componentes: `kebab-case`
- Tablas de DB: `snake_case` en plural (ej: `pipeline_stages`)
- Columnas de DB: `snake_case`

### Server Actions vs API Routes
- **Server Actions**: Mutaciones (crear, editar, eliminar). Se llaman desde formularios y botones.
- **API Routes**: Solo para webhooks externos y endpoints que consumen servicios de terceros.
- **Server Components**: Lectura de datos. Nunca en Client Components.

### Tipos TypeScript
- Cada módulo tiene su propio `types.ts`
- Los tipos de DB se generan automáticamente con `supabase gen types typescript`
- No usar `any`. Siempre tipar explícitamente.

### Errores
- Usar el patrón `Result<T, E>` en Server Actions: `{ data: T | null, error: string | null }`
- Nunca exponer stack traces al cliente
- Loguear errores del servidor en console.error + audit_log cuando aplique

### Seguridad
- Nunca usar `SUPABASE_SERVICE_ROLE_KEY` en el cliente
- Toda mutación del servidor debe verificar el rol del usuario antes de ejecutar
- Las queries de negocio siempre filtran por `company_id` del usuario autenticado

---

## 9. KPIs y Métricas del CRM (MVP)

Métricas que el dashboard debe mostrar desde el día uno:

| KPI | Descripción | Visible para |
|---|---|---|
| Leads totales | Total de leads abiertos | Owner, Analyst |
| Leads ganados (mes) | Cerrados como "Won" en el mes actual | Owner, Analyst |
| Tasa de conversión | Won / Total leads * 100 | Owner, Analyst |
| Valor del pipeline | Suma de `value` de leads abiertos | Owner, Analyst |
| Leads por etapa | Cantidad de leads en cada stage | Owner, Analyst, Vendor |
| Mis leads (Vendor) | Leads asignados al Vendor activo | Vendor |
| Actividades pendientes | Tareas/llamadas sin completar | Vendor |
| Fuente de leads | Distribución por `source` | Owner, Analyst |

---

## 10. Preparación para el Agente AI (Futuro)

El esquema actual ya contempla la llegada del agente AI:

- `leads.source` distingue entre entrada manual y automática
- `activities.source` distingue entre lo que cargó un humano y lo que cargó el agente
- `leads.metadata (jsonb)` permite guardar datos no estructurados que el agente extrae de conversaciones
- `contacts.custom_fields (jsonb)` permite campos que el agente descubre en conversaciones
- `audit_log` permite que el agente explique qué cambió, cuándo y por qué
- `channel_credentials` ya está diseñado para conectar todos los canales que el agente leerá

Cuando se implemente el agente, se agrega el módulo `ai-agent/` sin modificar el esquema existente.

---

## 11. Variables de Entorno

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Auth
NEXTAUTH_SECRET=
NEXTAUTH_URL=

# OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=

# Emails
RESEND_API_KEY=

# App
NEXT_PUBLIC_APP_URL=
SUPER_ADMIN_EMAIL=dilbert@gmail.com
```

---

## 12. Decisiones de Arquitectura Registradas

| Fecha | Decisión | Razón |
|---|---|---|
| Abril 2026 | Multi-tenant con RLS en schema compartido | Más simple de operar que schemas separados, Supabase lo maneja nativamente |
| Abril 2026 | Módulos de dominio dentro del monolito | Permite extraer microservicios cuando el volumen lo justifique sin reescribir |
| Abril 2026 | jsonb para metadata y custom_fields | Permite extensibilidad sin migraciones para el agente AI futuro |
| Abril 2026 | audit_log como tabla propia | Trazabilidad completa para el agente AI y debugging de producción |
| Abril 2026 | Server Actions para mutaciones | Reduce la superficie de API pública, mejor DX con Next.js 14 |
| Abril 2026 | Cobro por Vendedor, Analistas ilimitados | Los Vendedores son los que generan valor (conectan canales y cargan datos) |
| Abril 2026 | Auth del workspace sobre Supabase SSR con cookies PKCE | Evita race conditions de sesión y unifica middleware + server components |
| Abril 2026 | `requireAuth()` + helpers puros de permisos como perímetro obligatorio | Centraliza autorización y reduce desvíos entre módulos |
| Abril 2026 | Impersonación del Super Admin por cookie dedicada y override de `company_id` | Permite soporte multi-tenant sin romper el aislamiento del producto |
| Abril 2026 | Dashboard y Kanban con fetch server-side y `Suspense` por sección | Mejora percepción de velocidad y evita bloquear el layout completo |
| Abril 2026 | Índices compuestos para Kanban/KPIs y búsqueda trigram de contactos | Mantiene latencia razonable al crecer el volumen de leads y contactos |
| Abril 2026 | Side panels de Lead/Contact cargados con lazy loading | Baja el JS inicial en las vistas CRM más usadas |
| Abril 2026 | Headers de seguridad en Netlify (`CSP`, `XFO`, `nosniff`) | Baseline mínimo antes del primer cliente real |
