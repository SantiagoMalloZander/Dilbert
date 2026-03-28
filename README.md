# Dilbert CRM

> AI agent that lives inside Telegram chats between sellers and clients. Reads conversations in real time, extracts sales data automatically, and feeds a CRM. The manager sees everything on a live dashboard.

**hackITBA 2026 — AI & Automation category**

---

## Live demo

| Service | URL |
|---------|-----|
| Dashboard | https://frontend-one-swart-63.vercel.app |
| Supabase project | `ivimeffceopwzlkoqoyd` |

---

## Architecture

```
Telegram chat
     │
     ▼
┌─────────────┐    GPT-4o     ┌──────────────┐
│  Bot Python │ ────────────► │  Extractor   │
│  (Railway)  │               │  (JSON mode) │
└─────────────┘               └──────┬───────┘
     │                               │
     │ upsert                        │
     ▼                               ▼
┌──────────────────────────────────────────┐
│           Supabase PostgreSQL            │
│  companies / sellers / leads /           │
│  interactions  +  Realtime               │
└──────────────────────┬───────────────────┘
                       │ Realtime push
                       ▼
              ┌─────────────────┐
              │  Next.js 16     │
              │  Dashboard      │
              │  (Vercel)       │
              └─────────────────┘
```

## Stack

| Layer | Tech |
|-------|------|
| Bot | Python 3.11 + python-telegram-bot v21 |
| LLM | OpenAI GPT-4o (JSON mode) |
| DB | Supabase (PostgreSQL + Realtime) |
| Frontend | Next.js 16 + Tailwind CSS + Shadcn/UI |
| Deploy (frontend) | Vercel |
| Deploy (bot) | Railway |

---

## Run locally — 1 command

### Prerequisites

- Docker + Docker Compose
- A Telegram bot token (`@BotFather`)
- An OpenAI API key
- A Supabase project (free tier works)

### 1. Clone and configure

```bash
git clone https://github.com/SantiagoMalloZander/Dilbert.git
cd Dilbert
```

Create `bot/.env`:

```env
TELEGRAM_BOT_TOKEN=your-telegram-token
OPENAI_API_KEY=your-openai-key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
```

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 2. Apply database migrations

```bash
supabase link --project-ref your-project-ref
supabase db push
```

### 3. Start everything

```bash
docker compose up
```

- Frontend → http://localhost:3000
- Bot → polling Telegram

---

## Bot commands

| Command | Description |
|---------|-------------|
| `/analizar` | Force analysis of current message buffer |
| `/status` | Show bot status and buffer count |

**Auto-trigger:** analysis fires automatically after 3 min of inactivity or 20 messages accumulated.

---

## Bot flow

1. Bot is added to a Telegram group (seller + client).
2. Reads all messages and accumulates them in an in-memory buffer per `chat_id`.
3. Triggers analysis when: 3+ min of inactivity, 20+ messages, or `/analizar`.
4. Sends transcript to GPT-4o → receives structured JSON.
5. If ambiguities detected → asks seller in chat → waits for reply → re-analyzes with context.
6. Upserts `leads` + inserts `interactions` in Supabase.
7. Supabase Realtime propagates changes to the manager dashboard instantly.

---

## Dashboard features

- **Leads tab** — live table with status, sentiment, seller, amount. Clicks through to lead detail with full interaction history.
- **Analytics tab** — funnel, sentiment distribution, revenue by product, seller performance, and 30d/90d revenue predictions.
- **Realtime** — dashboard updates instantly when the bot saves new data (no refresh needed).

---

## Database schema

```sql
companies(id, name, created_at)
sellers(id, company_id, name, telegram_user_id, created_at)
leads(id, company_id, seller_id, client_name, client_company,
      status, estimated_amount, currency, product_interest,
      sentiment, next_steps, last_interaction, created_at)
interactions(id, lead_id, seller_id, raw_messages,
             extracted_data JSONB, summary, created_at)
```

Status values: `new` `contacted` `negotiating` `closed_won` `closed_lost`

---

## Repo structure

```
/
├── bot/                  # Telegram bot (Python)
│   ├── main.py           # Entry point + handlers
│   ├── buffer.py         # In-memory message buffer per chat
│   ├── extractor.py      # GPT-4o extraction
│   ├── db.py             # Supabase upsert logic
│   ├── proactive.py      # Clarification question tracking
│   ├── prompts.py        # LLM prompts
│   ├── config.py         # Env vars
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/             # Manager dashboard (Next.js)
│   ├── src/app/          # App Router pages + API routes
│   ├── src/components/   # UI components
│   └── src/lib/          # Supabase client + queries + types
├── supabase/
│   └── migrations/       # SQL migrations
├── docker-compose.yml
└── README.md
```

---

*Built in 36 hours at hackITBA 2026.*
