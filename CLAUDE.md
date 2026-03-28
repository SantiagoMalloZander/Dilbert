# CLAUDE.md

## Proyecto

Agente de IA que vive en chats de Telegram entre vendedores y clientes. Lee conversaciones en tiempo real, extrae datos de ventas automáticamente y alimenta un CRM. Cuando hay ambigüedad, le pregunta al vendedor en el chat. El manager ve todo en un dashboard en tiempo real.

Hackathon: hackITBA 2026 — 36 horas — Categoría: AI & Automation.

## Stack

- **Bot**: Python 3.11+ / python-telegram-bot v20+ (async)
- **LLM**: OpenAI GPT-4o (JSON mode)
- **Backend/DB**: Supabase (PostgreSQL + Realtime + Edge Functions)
- **Frontend**: Next.js 14 (App Router) + Tailwind CSS + Shadcn/UI
- **Deploy**: Vercel (frontend) + Railway (bot Python)

## Estructura del repo

```
/
├── bot/                    # Bot de Telegram (Python)
│   ├── main.py             # Entry point
│   ├── handlers.py         # Message handlers
│   ├── buffer.py           # Buffer de mensajes por chat
│   ├── extractor.py        # Llamadas al LLM
│   ├── db.py               # Supabase inserts/upserts
│   ├── proactive.py        # Preguntas de confirmación
│   ├── config.py           # Variables de entorno
│   ├── prompts.py          # Prompts del LLM
│   └── requirements.txt
│
├── web/                    # Dashboard del manager (Next.js)
│   ├── app/                # App Router pages
│   │   ├── layout.tsx
│   │   ├── page.tsx        # Dashboard principal
│   │   └── leads/
│   │       └── page.tsx    # Vista detallada de leads
│   ├── components/         # Componentes reutilizables
│   │   ├── ui/             # Shadcn/UI components
│   │   ├── LeadCard.tsx
│   │   ├── Pipeline.tsx
│   │   ├── MetricsPanel.tsx
│   │   ├── ActivityFeed.tsx
│   │   ├── SellerTable.tsx
│   │   └── Sidebar.tsx
│   ├── lib/
│   │   ├── supabase.ts     # Supabase client
│   │   └── queries.ts      # Todas las queries a Supabase
│   ├── tailwind.config.ts
│   ├── package.json
│   └── .env.local
│
├── supabase/               # Migraciones y seeds
│   ├── migrations/
│   └── seed.sql
│
├── CLAUDE.md               # Este archivo
├── docker-compose.yml      # Para ejecución con un solo comando
└── README.md
```

## Base de datos (Supabase PostgreSQL)

```sql
companies(id UUID PK, name TEXT, created_at TIMESTAMPTZ)

sellers(id UUID PK, company_id UUID FK, name TEXT, telegram_user_id BIGINT UNIQUE, created_at TIMESTAMPTZ)

leads(id UUID PK, company_id UUID FK, seller_id UUID FK, client_name TEXT, client_company TEXT, status TEXT DEFAULT 'nuevo', estimated_amount DECIMAL, currency TEXT, product_interest TEXT, sentiment TEXT, next_steps TEXT, last_interaction TIMESTAMPTZ, created_at TIMESTAMPTZ)

interactions(id UUID PK, lead_id UUID FK, seller_id UUID FK, raw_messages TEXT, extracted_data JSONB, summary TEXT, created_at TIMESTAMPTZ)
```

Status enum: `nuevo`, `en_conversacion`, `propuesta`, `cerrado_ganado`, `cerrado_perdido`
Sentiment enum: `positivo`, `neutral`, `negativo`
Currency enum: `ARS`, `USD`

Realtime está habilitado en las tablas `leads` e `interactions`.

## Convenciones

### General
- No implementar auth. Todo hardcodeado para la demo con una empresa y 2-3 vendedores.
- No agregar features fuera del scope. Si no está en este documento, no se hace.
- Commits descriptivos en español.

### Python (bot/)
- Async everywhere. python-telegram-bot v20 es async.
- Type hints en todas las funciones.
- Clases para estado (no global state suelto).
- Manejo de errores con try/except en llamadas a APIs externas.
- Logging con el módulo `logging`, no prints.

### TypeScript (web/)
- Next.js App Router (no Pages Router).
- Componentes en /components, un archivo por componente.
- Shadcn/UI para componentes base (Card, Badge, Table, Button, Dialog).
- Solo Tailwind para estilos. CERO CSS custom, CERO CSS modules.
- Supabase client en /lib/supabase.ts con createBrowserClient.
- Queries en /lib/queries.ts, no queries inline en componentes.
- Supabase Realtime subscriptions en custom hooks o directamente en page components.
- Interfaces/types en el mismo archivo del componente si son locales, en /lib/types.ts si son compartidas.

### UI/Diseño
- Paleta de colores: un azul principal profesional + grises + acentos de color para estados.
- Sentimiento: verde (positivo), amarillo (neutral), rojo (negativo).
- Status: gris (nuevo), azul (en_conversacion), naranja (propuesta), verde (cerrado_ganado), rojo (cerrado_perdido).
- Tipografía: Inter o la default de Shadcn.
- El dashboard debe verse bien proyectado en pantalla grande. Fuentes legibles, contraste alto.

## Variables de entorno

### Bot (bot/.env)
```
TELEGRAM_BOT_TOKEN=
OPENAI_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
```

### Web (web/.env.local)
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

## Flujo del bot

1. Bot está en grupo de Telegram (vendedor + cliente).
2. Lee todos los mensajes, los acumula en buffer en memoria por chat_id.
3. Trigger de análisis cuando: 3+ min sin mensajes, 20+ mensajes acumulados, o comando /analizar.
4. Manda historial al LLM → recibe JSON con datos extraídos.
5. Si hay ambiguities → bot pregunta al vendedor en el chat → espera respuesta → re-analiza.
6. Si no hay ambiguities → upsert en leads + insert en interactions → manda confirmación sutil.
7. Supabase Realtime propaga el cambio al dashboard del manager.

## Comandos del bot
- `/analizar` — fuerza análisis del buffer
- `/resumen` — resumen de leads activos del vendedor
- `/status` — estado del bot y mensajes en buffer

## Lo que NO se hace
- Auth / login / registro
- Integración con WhatsApp Business API
- Integración con Salesforce / HubSpot
- Transcripción de audio (nice-to-have si sobra tiempo)
- Landing page (solo si sobra tiempo)
- App mobile
- Tests unitarios
- CI/CD
