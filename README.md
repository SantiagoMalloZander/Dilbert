# Dilbert

> Anti-data-entry CRM para inmobiliarias. El agente IA captura conversaciones
> (WhatsApp, Gmail, audios, reuniones) y las convierte en contactos, búsquedas
> y actividades dentro del CRM, sin que el vendedor cargue nada a mano.

**App:** https://dilvert.netlify.app

---

## Para qué sirve

Una agencia inmobiliaria pierde leads porque la conversación vive en WhatsApp,
audios y email — y al final del día nadie carga nada en el CRM. Dilbert resuelve
eso: conecta los canales del vendedor, lee las conversaciones, y deja la
información estructurada (cliente, qué busca, en qué zona, presupuesto, urgencia,
visita agendada, próximo paso) en el CRM automáticamente.

- **Multi-tenant:** una agencia = un tenant. Los vendedores ven lo suyo, el
  dueño ve todo.
- **Multi-canal:** Gmail, WhatsApp (Evolution), audios manuales o de WhatsApp,
  reuniones via Fathom.
- **Vertical inmobiliario nativo:** los leads tienen campos reales del rubro
  (operación, tipo de propiedad, zona, presupuesto, ambientes, urgencia, etc.).
- **Review queue:** cuando el agente no está seguro, le pregunta al vendedor en
  vez de inventar.
- **Bring your own CRM:** se puede operar contra el CRM nativo (Supabase) o
  espejar a HubSpot. El boundary permite agregar más conectores (AMS / CRMs)
  sin tocar el motor.

## Estructura del repo

| Carpeta | Qué es |
|---|---|
| `frontend/` | App Next.js deployada en Netlify (workspace `/app/*`) |
| `frontend/src/lib/agent/` | Motor del agente (orchestrator + extractor + connectors) |
| `frontend/src/modules/` | Lógica de dominio del CRM por bounded context |
| `supabase/migrations/` | Schema versionado |
| `bot/` | Bot Python legacy de la etapa de hackathon (NO deployado) |

## Cómo correrlo localmente

```bash
cd frontend
cp .env.example .env.local   # llenar con las creds del proyecto
npm install
npm run dev
```

## Documentación interna

- [`.claude/skills/PROJECT_CONTEXT.md`](.claude/skills/PROJECT_CONTEXT.md) — estado y modelo de datos actuales.
- [`.claude/skills/arquitectura.md`](.claude/skills/arquitectura.md) — documento arquitectónico de referencia.
- [`AUDITORIA.md`](AUDITORIA.md) — auditoría técnica del repo (abril 2026).
- [`Informe-Pipeline-CRM-Dilbert.docx`](Informe-Pipeline-CRM-Dilbert.docx) — informe del pipeline de data entry.
