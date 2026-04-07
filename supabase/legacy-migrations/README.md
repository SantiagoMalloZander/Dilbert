## Legacy Migrations

Estas migraciones quedaron archivadas para preservar el historial del schema híbrido anterior.

No forman parte de la línea base activa porque mezclaban:
- el CRM legacy (`sellers`, `leads`, `interactions`)
- una transición incompleta al modelo multi-tenant nuevo
- cambios duplicados/incompatibles en `authorized_emails`

La línea activa y verificable para desarrollo local ahora es:
- `001_initial_schema.sql`
- `002_rls_policies.sql`
- `003_default_data.sql`

