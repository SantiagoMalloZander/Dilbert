# AUDITORIA — Estado Real del Repo Dilbert

> Fecha: 2026-04-06
> Alcance: repo completo (`frontend`, `dilbert-app`, `supabase`, `bot`)
> Fuente de verdad comparada: [`.claude/skills/arquitectura.md`](/Users/santi/Documents/GitHub/Dilbert/.claude/skills/arquitectura.md)

## Resumen Ejecutivo

El repo hoy tiene **tres sistemas conviviendo**:

1. `frontend/`: app activa y deployada en Netlify. Mezcla un **workspace multi-tenant nuevo** bajo `/app/*` con un **CRM legacy single-tenant** bajo `/dashboard`, `/analytics`, `/metricas`, `/configuracion`, `/crm/hubspot` y `/admin`.
2. `dilbert-app/`: segundo proyecto Next.js 14, muy parecido al workspace nuevo, pero **no es el que se deploya** hoy.
3. `bot/`: backend Python que sigue alimentando el CRM legacy usando el schema viejo (`sellers`, `leads`, `interactions`) y defaults demo.

Conclusión: **la arquitectura objetivo de `arquitectura.md` no está implementada todavía**. Lo que existe hoy es un producto híbrido:

- El módulo **auth/users/admin** del workspace nuevo está bastante avanzado.
- El módulo **crm** nuevo está casi vacío.
- El negocio real sigue corriendo sobre el **CRM legacy**.
- La base de datos quedó en una transición entre el modelo viejo Telegram-only y el modelo multi-tenant nuevo.

La prioridad no es agregar features nuevas. La prioridad es **cerrar la transición arquitectónica**, porque hoy hay dos productos, dos modelos de auth, dos modelos de CRM y un schema intermedio.

## Actualización 2026-04-06

### Tarea completada: reorganización estructural según `arquitectura.md` sección 7

Se completó la normalización del árbol de la app activa en `frontend/src`:

- Se creó `modules/` con scaffolding por dominio para `auth`, `crm`, `users` y `admin`.
- Se creó `lib/supabase/client.ts`, `lib/supabase/server.ts` y `lib/auth/permissions.ts`.
- Se introdujeron `components/layout`, `components/crm` y `components/shared`.
- El código con lugar incierto o claramente heredado fue movido a `frontend/src/legacy/` con wrappers de compatibilidad en sus paths originales.
- El route group escapado `frontend/src/app/app/\\(protected\\)` quedó archivado en `legacy/`.
- Los tests E2E existentes fueron actualizados para el comportamiento actual de la home y vuelven a pasar.

Esta tarea deja alineada la **estructura física** con la arquitectura objetivo, pero **no completa todavía la migración lógica**:

- La lógica viva sigue repartida entre `workspace-*` y `legacy/`.
- Las mutaciones siguen apoyándose en API Routes en vez de Server Actions.
- El CRM nuevo todavía no reemplaza al CRM legacy.

---

## 0. Hallazgos estructurales clave

- El proyecto deployado es `frontend/`, no `dilbert-app/`. Esto sale de [`netlify.toml`](/Users/santi/Documents/GitHub/Dilbert/netlify.toml).
- `arquitectura.md` define **Next.js 14 + monolito modular + Server Actions**, pero la app viva usa **Next.js 16.2.1 + API Routes + lógica en `src/lib/*`**. Ver [`frontend/package.json`](/Users/santi/Documents/GitHub/Dilbert/frontend/package.json) y [`frontend/src/app/app/api`](/Users/santi/Documents/GitHub/Dilbert/frontend/src/app/app/api).
- El repo contiene un `middleware.ts` en [`dilbert-app/middleware.ts`](/Users/santi/Documents/GitHub/Dilbert/dilbert-app/middleware.ts), pero la app activa usa [`frontend/src/proxy.ts`](/Users/santi/Documents/GitHub/Dilbert/frontend/src/proxy.ts).
- Existía un directorio duplicado accidental: [`frontend/src/app/app/\\(protected\\)`](/Users/santi/Documents/GitHub/Dilbert/frontend/src/app/app/%5C%28protected%5C%29) además del route group correcto [`frontend/src/app/app/(protected)`](/Users/santi/Documents/GitHub/Dilbert/frontend/src/app/app/%28protected%29). Ya fue retirado del árbol activo y archivado en `frontend/src/legacy/`.
- El dominio está inconsistente en docs/config:
  - `arquitectura.md`: `dilbert.netlify.app`
  - `frontend/.env.example`: `dilvert.netlify.app`
  - `README.md`: `dilverty.netlify.app`

---

## 1. Estado actual por módulo

### 1.1 Auth

#### Qué está implementado

- Workspace auth nuevo bajo [`/app/`](/Users/santi/Documents/GitHub/Dilbert/frontend/src/app/app/page.tsx).
- Flujo email-first en [`auth-screen.tsx`](/Users/santi/Documents/GitHub/Dilbert/frontend/src/components/auth-screen.tsx):
  - Paso email
  - Login con password
  - Registro con nombre + password
  - OTP por Resend
  - Google OAuth
  - Microsoft OAuth
- NextAuth configurado en [`workspace-auth.ts`](/Users/santi/Documents/GitHub/Dilbert/frontend/src/lib/workspace-auth.ts) y route handler en [`[...nextauth]/route.ts`](/Users/santi/Documents/GitHub/Dilbert/frontend/src/app/app/api/auth/%5B...nextauth%5D/route.ts).
- Sesión y guards de workspace:
  - [`requireSession()`](/Users/santi/Documents/GitHub/Dilbert/frontend/src/lib/workspace-auth.ts)
  - [`requireOwner()`](/Users/santi/Documents/GitHub/Dilbert/frontend/src/lib/workspace-auth.ts)
  - [`requireSuperAdmin()`](/Users/santi/Documents/GitHub/Dilbert/frontend/src/lib/workspace-auth.ts)
- Middleware/proxy con redirect por rol en [`frontend/src/proxy.ts`](/Users/santi/Documents/GitHub/Dilbert/frontend/src/proxy.ts).
- Pantalla de acceso pendiente en [`pending-access/page.tsx`](/Users/santi/Documents/GitHub/Dilbert/frontend/src/app/app/%28protected%29/pending-access/page.tsx).
- Soporte de impersonación para super admin.

#### Qué está hardcodeado o incompleto

- Fallbacks inseguros de secretos:
  - [`frontend/src/lib/auth.ts`](/Users/santi/Documents/GitHub/Dilbert/frontend/src/lib/auth.ts)
  - [`frontend/src/proxy.ts`](/Users/santi/Documents/GitHub/Dilbert/frontend/src/proxy.ts)
  - [`frontend/src/lib/workspace-auth.ts`](/Users/santi/Documents/GitHub/Dilbert/frontend/src/lib/workspace-auth.ts)
  - [`frontend/src/lib/workspace-auth-flow.ts`](/Users/santi/Documents/GitHub/Dilbert/frontend/src/lib/workspace-auth-flow.ts)
- Email de super admin con fallback hardcodeado a `dilbert@gmail.com` en:
  - [`frontend/src/lib/workspace-roles.ts`](/Users/santi/Documents/GitHub/Dilbert/frontend/src/lib/workspace-roles.ts)
  - [`frontend/src/proxy.ts`](/Users/santi/Documents/GitHub/Dilbert/frontend/src/proxy.ts)
  - [`frontend/src/components/auth-screen.tsx`](/Users/santi/Documents/GitHub/Dilbert/frontend/src/components/auth-screen.tsx)
- El repo mantiene un **auth legacy paralelo** con credenciales hardcodeadas en [`frontend/src/lib/auth.ts`](/Users/santi/Documents/GitHub/Dilbert/frontend/src/lib/auth.ts) y login en [`frontend/src/app/login/page.tsx`](/Users/santi/Documents/GitHub/Dilbert/frontend/src/app/login/page.tsx).
- `auth-screen.tsx` intenta limpiar cookies con nombres incorrectos (`browser-session`, `last-activity`, `remember-me`, `impersonation`) en lugar de los nombres reales `dilbert-*`.
- `verify-otp` tiene un bug funcional:
  - [`verify-otp/route.ts`](/Users/santi/Documents/GitHub/Dilbert/frontend/src/app/app/api/auth/register/verify-otp/route.ts) devuelve `pending_access` **sin `sessionToken`**
  - [`auth-screen.tsx`](/Users/santi/Documents/GitHub/Dilbert/frontend/src/components/auth-screen.tsx) intenta usar `data.sessionToken`
  - Resultado: el flujo post-registro sin empresa no queda consistente.

#### Qué falta completamente

- Password reset / forgot password.
- Rate limiting explícito en endpoints de login/OTP.
- 2FA.
- Invalidación consistente de sesión en cambio de rol/empresa.
- Confirmación de email nativa de Supabase alineada con el flujo propio.

---

### 1.2 CRM

#### Qué está implementado

- **CRM nuevo**:
  - [`/app/crm`](/Users/santi/Documents/GitHub/Dilbert/frontend/src/app/app/%28protected%29/crm/page.tsx) existe
  - Tiene dashboard placeholder, navegación por rol y shell de workspace
- **CRM legacy**:
  - Dashboard operativo en [`frontend/src/app/dashboard/page.tsx`](/Users/santi/Documents/GitHub/Dilbert/frontend/src/app/dashboard/page.tsx)
  - Detalle de lead en [`frontend/src/app/leads/[id]/page.tsx`](/Users/santi/Documents/GitHub/Dilbert/frontend/src/app/leads/%5Bid%5D/page.tsx)
  - Alta manual de leads en [`add-lead-dialog.tsx`](/Users/santi/Documents/GitHub/Dilbert/frontend/src/components/add-lead-dialog.tsx)
  - Analytics en [`frontend/src/app/analytics/page.tsx`](/Users/santi/Documents/GitHub/Dilbert/frontend/src/app/analytics/page.tsx) y [`frontend/src/lib/analytics.ts`](/Users/santi/Documents/GitHub/Dilbert/frontend/src/lib/analytics.ts)
  - Métricas legacy en [`frontend/src/app/metricas/page.tsx`](/Users/santi/Documents/GitHub/Dilbert/frontend/src/app/metricas/page.tsx)
  - HubSpot sync UI en [`frontend/src/app/crm/hubspot/page.tsx`](/Users/santi/Documents/GitHub/Dilbert/frontend/src/app/crm/hubspot/page.tsx)
  - Config de canales demo/Telegram en [`frontend/src/app/configuracion/page.tsx`](/Users/santi/Documents/GitHub/Dilbert/frontend/src/app/configuracion/page.tsx)

#### Qué está hardcodeado o incompleto

- El CRM real sigue siendo **single-tenant demo-first**:
  - `DEMO_COMPANY_ID` hardcodeado en [`dashboard/page.tsx`](/Users/santi/Documents/GitHub/Dilbert/frontend/src/app/dashboard/page.tsx)
  - `DEMO_COMPANY_ID` hardcodeado en [`leads/[id]/page.tsx`](/Users/santi/Documents/GitHub/Dilbert/frontend/src/app/leads/%5Bid%5D/page.tsx)
  - `DEMO_SELLER_ID` hardcodeado en [`add-lead-dialog.tsx`](/Users/santi/Documents/GitHub/Dilbert/frontend/src/components/add-lead-dialog.tsx)
  - analytics server-side usan [`getAnalyticsCompanyId()`](/Users/santi/Documents/GitHub/Dilbert/frontend/src/lib/supabase-server.ts), no la empresa de la sesión
- El CRM nuevo `/app/crm` **no consume datos reales**.
- El CRM legacy sigue usando `sellers` en vez de `users`.
- El bot sigue escribiendo a `leads` e `interactions` con el modelo viejo desde [`bot/db.py`](/Users/santi/Documents/GitHub/Dilbert/bot/db.py).
- HubSpot sync legacy sigue contra `leads + sellers` demo-only en [`frontend/src/app/api/hubspot/sync/route.ts`](/Users/santi/Documents/GitHub/Dilbert/frontend/src/app/api/hubspot/sync/route.ts).

#### Qué falta completamente

- Contacts.
- Pipelines.
- Pipeline stages.
- Activities.
- Notes.
- Asignación real por `assigned_to`.
- Leads filtrados por rol dentro del workspace nuevo.
- CRUD completo de leads/contactos dentro de `/app/crm`.
- Migración del bot al modelo multi-tenant nuevo.

---

### 1.3 Users

#### Qué está implementado

- Centro de Usuarios en [`/app/users`](/Users/santi/Documents/GitHub/Dilbert/frontend/src/app/app/%28protected%29/users/page.tsx).
- Lógica en [`workspace-users.ts`](/Users/santi/Documents/GitHub/Dilbert/frontend/src/lib/workspace-users.ts).
- API routes para:
  - agregar usuario
  - cambiar rol
  - quitar acceso
  - obtener/regenerar invite link
- Invite links con expiración y rotación.
- Regla de límite de vendedores tanto en app como en trigger SQL.

#### Qué está hardcodeado o incompleto

- El estado `pending` no representa bien la realidad cuando el owner agrega un usuario:
  - [`addCompanyUser()`](/Users/santi/Documents/GitHub/Dilbert/frontend/src/lib/workspace-users.ts) crea `auth.users` y `public.users` inmediatamente
  - por lo tanto, muchos “invitados” aparecen ya como activos aunque nunca hayan ingresado
- Se envían contraseñas temporales por email en texto claro.
- No hay paginación real ni búsqueda.
- No hay auditoría de cambios de rol o revocaciones.

#### Qué falta completamente

- Soft delete / suspensión de usuarios.
- Historial de cambios.
- Invitación masiva.
- Política clara de “activo” vs “habilitado” vs “logueado por primera vez”.

---

### 1.4 Integrations

#### Qué está implementado

- Vista vendor y owner en [`/app/integrations`](/Users/santi/Documents/GitHub/Dilbert/frontend/src/app/app/%28protected%29/integrations/page.tsx).
- Definiciones y persistencia placeholder en [`workspace-integrations.ts`](/Users/santi/Documents/GitHub/Dilbert/frontend/src/lib/workspace-integrations.ts).
- API route para conectar/desconectar en [`frontend/src/app/app/api/integrations/route.ts`](/Users/santi/Documents/GitHub/Dilbert/frontend/src/app/app/api/integrations/route.ts).
- `channel_credentials.status` con `pending`/`connected`.

#### Qué está hardcodeado o incompleto

- Las conexiones son **placeholders**. No hay OAuth real ni webhooks reales desde el workspace.
- Las credenciales se guardan en `jsonb` sin cifrado aplicativo.
- `channel_credentials` no guarda `company_id`, así que depende siempre del `user_id`.
- El catálogo de canales no coincide con `arquitectura.md`:
  - arquitectura define `whatsapp_business`, `meet`, `fathom`
  - el código usa `whatsapp`, `whatsapp_personal`, `meet` y no tiene `fathom` como canal separado
- Owner ve estado por vendedor, pero no existe sincronización real de estado contra sistemas externos.

#### Qué falta completamente

- Conexiones reales con Gmail, Instagram, Zoom, Teams, WhatsApp Business.
- Encriptación de secretos.
- `last_sync_at`.
- Manejo de errores de conexión.
- Reintentos y salud de integraciones.
- Edge Functions / webhooks alineados con este módulo.

---

### 1.5 Admin

#### Qué está implementado

- Panel nuevo en [`/app/admin`](/Users/santi/Documents/GitHub/Dilbert/frontend/src/app/app/%28protected%29/admin/page.tsx).
- Alta de empresa + owner en [`workspace-admin.ts`](/Users/santi/Documents/GitHub/Dilbert/frontend/src/lib/workspace-admin.ts).
- Impersonación en [`frontend/src/app/app/api/admin/impersonation/route.ts`](/Users/santi/Documents/GitHub/Dilbert/frontend/src/app/app/api/admin/impersonation/route.ts).
- Cambio de vendor limit.
- Baja lógica de empresa.

#### Qué está hardcodeado o incompleto

- No hay `slug`, `plan`, `settings`, `status = suspended`.
- No hay transacción real entre creación de empresa, auth user, `users` y `authorized_emails`.
- Los lookups de usuarios de auth escanean páginas de `listUsers()` en vez de usar una estrategia estable.
- El email de provisioning envía password temporal.
- Convive además un **admin legacy** en [`frontend/src/app/admin/page.tsx`](/Users/santi/Documents/GitHub/Dilbert/frontend/src/app/admin/page.tsx) que resetea demo data con el auth viejo.

#### Qué falta completamente

- Dashboard de super admin con métricas.
- Billing/planes.
- Auditoría de acciones de admin.
- Suspensión real de tenants.
- Herramientas de soporte multi-tenant más allá de impersonación.

---

## 2. Deuda técnica detectada

### 2.1 Seguridad

#### Crítico

- **Coexisten dos sistemas de auth**:
  - workspace nuevo con NextAuth/Supabase
  - legacy auth con cookie JWT propia y usuarios hardcodeados
  - eso abre superficie innecesaria y dificulta el enforcement uniforme
- **La revocación de sesión del workspace no está garantizada en steady-state**.
  - En [`frontend/src/proxy.ts`](/Users/santi/Documents/GitHub/Dilbert/frontend/src/proxy.ts), si el JWT ya tiene `companyId` y `role`, se omiten las consultas a Supabase
  - eso también omite el chequeo de `session_revoked_at`
  - consecuencia: un usuario con JWT “completo” puede seguir navegando aunque le hayan quitado acceso
- **El CRM legacy sigue leyendo desde el browser con clave pública y tablas sin RLS visible**.
  - [`dashboard/page.tsx`](/Users/santi/Documents/GitHub/Dilbert/frontend/src/app/dashboard/page.tsx)
  - [`leads/[id]/page.tsx`](/Users/santi/Documents/GitHub/Dilbert/frontend/src/app/leads/%5Bid%5D/page.tsx)
  - si `leads/interactions/sellers` no tienen RLS activo, el aislamiento multi-tenant no existe
- **Hay credenciales y accesos sensibles documentados en claro** en [`README.md`](/Users/santi/Documents/GitHub/Dilbert/README.md).
- **`bot/.env` está presente en el repo**. Aunque no expongo su contenido, un archivo `.env` trackeado es una alerta de seguridad seria.

#### Alto

- Fallbacks de secretos por defecto en código productivo.
- Passwords temporales enviadas por email.
- `SUPABASE_SERVICE_KEY` se usa en muchos helpers ad hoc y no detrás de un único boundary de dominio.
- `auth.email.enable_confirmations = false` en [`supabase/config.toml`](/Users/santi/Documents/GitHub/Dilbert/supabase/config.toml).

#### Medio

- Limpieza de cookies inconsistente en [`auth-screen.tsx`](/Users/santi/Documents/GitHub/Dilbert/frontend/src/components/auth-screen.tsx).
- `authorized_emails.role` usa `user_role`, lo que permite `owner` aunque la arquitectura espera solo `analyst/vendor`.
- `channel_credentials.credentials` sin cifrado.

---

### 2.2 Performance

- `findAuthUserByEmail()` y variantes hacen paginado de `listUsers()` de Supabase por cada operación administrativa o de auth.
- [`frontend/src/proxy.ts`](/Users/santi/Documents/GitHub/Dilbert/frontend/src/proxy.ts) hace fetch server-to-server desde middleware en algunos casos.
- [`workspace-admin.listAdminCompanies()`](/Users/santi/Documents/GitHub/Dilbert/frontend/src/lib/workspace-admin.ts) carga todas las empresas y todos los usuarios sin paginación.
- [`workspace-users.getUsersCenterData()`](/Users/santi/Documents/GitHub/Dilbert/frontend/src/lib/workspace-users.ts) resuelve datos agregando múltiples queries por request.
- [`frontend/src/lib/analytics.ts`](/Users/santi/Documents/GitHub/Dilbert/frontend/src/lib/analytics.ts) calcula analytics completos en memoria a partir de todas las interacciones y leads en cada request.
- El dashboard legacy carga leads e interacciones completos en cliente, no por streaming ni con query incremental.

---

### 2.3 Desvíos respecto de `arquitectura.md`

- La estructura base ya existe (`modules/`, `components/layout|crm|shared`, `lib/supabase`, `lib/auth/permissions`), pero la **lógica todavía no fue migrada completamente** desde `workspace-*` y `legacy/` hacia esos módulos.
- Mutaciones internas usan **API Routes**, no Server Actions.
- Lecturas de negocio suceden en Client Components en el CRM legacy.
- No se usa patrón `Result<T, E>`.
- No hay tipos generados de Supabase; persisten tipos manuales legacy en [`frontend/src/lib/types.ts`](/Users/santi/Documents/GitHub/Dilbert/frontend/src/lib/types.ts) ahora como wrapper hacia `legacy/`.
- El proyecto deployado no es Next 14 sino Next 16.
- Existe una codebase duplicada `dilbert-app/` que replica parte del workspace con stack distinto.

---

## 3. Schema actual vs schema definido en `arquitectura.md`

## 3.1 Tablas que sí existen hoy

- `companies`
- `users`
- `authorized_emails`
- `invite_links`
- `channel_credentials`
- `leads`
- `interactions`
- `sellers`
- `pending_registrations`
- `demos`

## 3.2 Tablas faltantes respecto de arquitectura

- `contacts`
- `pipelines`
- `pipeline_stages`
- `activities`
- `notes`
- `audit_log`

## 3.3 Tablas extra no contempladas en arquitectura

- `sellers`
- `interactions` como entidad principal del CRM legacy
- `pending_registrations`
- `demos`

## 3.4 Columnas faltantes o mal tipadas

### `companies`

Faltan:
- `slug`
- `updated_at`
- `plan`
- `settings`

Desvíos:
- `status` actual solo soporta `active | inactive`
- arquitectura pide `active | inactive | suspended`

### `users`

Faltan:
- `is_active`
- `updated_at`

Desvíos:
- `company_id` hoy es nullable
- `role` hoy es nullable
- arquitectura los espera como datos estructurales del usuario operativo

### `authorized_emails`

Existe `role`, pero:
- fue agregado en dos migraciones distintas
- usa enum `user_role`, por lo que acepta `owner`
- arquitectura espera solo `analyst | vendor`

### `invite_links`

Está razonablemente alineada.

### `channel_credentials`

Faltan:
- `company_id`
- `last_sync_at`
- `created_at`
- `updated_at`

Desvíos:
- `channel_type` no coincide con el catálogo de arquitectura
- `status` solo soporta `pending | connected`
- arquitectura pide `connected | disconnected | error | pending`

### `leads`

Desvíos grandes:
- hoy tiene `seller_id`
- arquitectura pide `assigned_to`
- no existe `contact_id`
- no existe `pipeline_id`
- no existe `stage_id`
- no existe `title`
- no existe `value`
- no existe `probability`
- no existe `expected_close_date`
- no existe `lost_reason`
- no existe `source`
- no existe `metadata`
- no existe `updated_at`
- no existe `created_by`

Además:
- el enum de `status` actual es el viejo funnel Telegram-only (`new`, `contacted`, `negotiating`, `closed_won`, `closed_lost`)
- no coincide con `open | won | lost | paused`

### `interactions`

No coincide con arquitectura.

Faltan:
- `company_id`
- `user_id`
- `type`
- `title`
- `description`
- `scheduled_at`
- `completed_at`
- `source`

En la práctica esta tabla debería migrar a `activities` o convivir formalmente como otra entidad, pero hoy está en un limbo.

## 3.5 RLS policies faltantes

RLS visibles hoy:
- `companies`
- `users`
- `authorized_emails`
- `invite_links`
- `channel_credentials`

RLS faltantes o no evidenciadas:
- `leads`
- `sellers`
- `interactions`
- `pending_registrations`
- `demos`

Observación importante:
- La arquitectura exige que **todas las tablas de negocio** estén aisladas por `company_id`.
- Hoy justo las tablas que sostienen el CRM legacy (`sellers`, `leads`, `interactions`) no aparecen protegidas en las migraciones leídas.

## 3.6 Problemas de migraciones

- [`20260402020000_auth_onboarding_support.sql`](/Users/santi/Documents/GitHub/Dilbert/supabase/migrations/20260402020000_auth_onboarding_support.sql) agrega `authorized_emails.role if not exists`
- [`20260402221303_add_role_to_authorized_emails.sql`](/Users/santi/Documents/GitHub/Dilbert/supabase/migrations/20260402221303_add_role_to_authorized_emails.sql) vuelve a hacer `ADD COLUMN role` sin guardia
- esa segunda migración además agrega un `UNIQUE(company_id, email)` sin `if not exists`
- en una base fresca esto es candidato a fallar

Además:
- [`supabase/config.toml`](/Users/santi/Documents/GitHub/Dilbert/supabase/config.toml) declara `sql_paths = ["./seed.sql"]`
- `supabase/seed.sql` no existe en el repo

---

## 4. Lista priorizada de lo que hay que arreglar antes de avanzar

### Prioridad 0 — Cortar riesgos

1. Unificar el producto sobre **una sola app**. La activa debe ser `frontend/`; `dilbert-app/` hay que archivarla o eliminarla del camino de producción.
2. Eliminar o aislar el **auth legacy** y el **admin legacy**:
   - [`frontend/src/lib/auth.ts`](/Users/santi/Documents/GitHub/Dilbert/frontend/src/lib/auth.ts)
   - [`frontend/src/app/login/page.tsx`](/Users/santi/Documents/GitHub/Dilbert/frontend/src/app/login/page.tsx)
   - [`frontend/src/app/admin/page.tsx`](/Users/santi/Documents/GitHub/Dilbert/frontend/src/app/admin/page.tsx)
3. Corregir la **revocación de sesión** en [`frontend/src/proxy.ts`](/Users/santi/Documents/GitHub/Dilbert/frontend/src/proxy.ts) para que consulte `session_revoked_at` también con JWT completos.
4. Sacar credenciales públicas de [`README.md`](/Users/santi/Documents/GitHub/Dilbert/README.md) y dejar de trackear `bot/.env`.

### Prioridad 1 — Cerrar multi-tenancy real

1. Agregar RLS y aislamiento efectivo a `leads`, `interactions` y `sellers`, o migrarlos formalmente al nuevo modelo.
2. Dejar de usar `DEMO_COMPANY_ID` y `DEMO_SELLER_ID` en frontend y bot.
3. Migrar el CRM del modelo `sellers` al modelo `users`.
4. Atar analytics y hubspot sync a la empresa del usuario autenticado o moverlos fuera del producto hasta que estén listos.

### Prioridad 2 — Corregir el schema

1. Resolver la deuda de migraciones duplicadas de `authorized_emails.role`.
2. Definir si `interactions`:
   - se renombra a `activities`
   - o convive como tabla legacy temporal con plan explícito de salida
3. Crear las tablas faltantes mínimas para el CRM target:
   - `contacts`
   - `pipelines`
   - `pipeline_stages`
4. Agregar a `channel_credentials`:
   - `company_id`
   - `last_sync_at`
   - timestamps completos
   - estados `disconnected` y `error`

### Prioridad 3 — Cerrar consistencia de producto

1. Arreglar el bug de `pending_access` en OTP.
2. Corregir el estado real de usuarios “pendientes” vs “activos”.
3. Normalizar dominio y URLs:
   - `dilbert`
   - `dilvert`
   - `dilverty`
4. Migrar la lógica viva de `workspace-*` y `legacy/` hacia `modules/` para que la nueva estructura no sea solo organizativa sino también de ownership.

### Prioridad 4 — Recién ahí avanzar con features

1. Implementar CRM real dentro de `/app/crm`.
2. Migrar bot e ingestión a entidades nuevas.
3. Implementar integraciones reales.
4. Recién después agregar AI agent y analytics más profundos.

---

## Veredicto

El repo **no está listo para seguir creciendo sin ordenar la transición**.

Lo más sano hoy es asumir esta realidad:

- `auth/users/admin` del workspace nuevo son la base buena.
- `crm` real todavía vive en legacy.
- la DB es híbrida.
- el bot sigue casado con el modelo viejo.

Si se sigue construyendo arriba de esto sin consolidar, Dilbert va a quedar con:

- dos productos,
- dos auth layers,
- dos modelos de datos,
- y un multi-tenant sólo parcial.

La próxima etapa correcta no es “sumar más pantallas”; es **cerrar la migración al modelo único**.
