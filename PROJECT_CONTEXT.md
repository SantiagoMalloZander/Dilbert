# PROJECT_CONTEXT.md

## Product
**Dilbert** is an AI sales agent that lives inside chat-based sales conversations and turns unstructured messaging activity into structured commercial intelligence.

The current MVP is centered on **Telegram group chats** where a seller and a prospect interact while the bot listens silently, extracts relevant sales data, resolves ambiguities when needed, and syncs everything into a CRM-backed dashboard.

The strategic product direction is larger than the hackathon MVP: the long-term vision is a **conversational CRM layer** for chat-first sales teams in Latin America, especially teams that sell through WhatsApp and other messaging channels rather than through email-heavy workflows.

## Core problem
Traditional CRMs create friction because they force sales reps to interrupt live selling activity and manually enter data after conversations. That creates:

- low CRM adoption
- incomplete or false records
- lost commercial context
- poor forecasting and weak visibility for managers
- operational drag on the highest-leverage people in the company

Dilbert solves that by adapting the CRM to the seller's real workflow instead of forcing the seller to adapt to the CRM.

## Core promise
Dilbert removes manual CRM data entry by capturing what already happens in commercial conversations and transforming it into structured, usable CRM data in real time.

The promise is:

- less admin work for sellers
- better CRM adoption
- cleaner and fresher data
- better visibility for managers
- a CRM experience designed for chat-native commerce

## Hackathon framing
For hackITBA 2026, Dilbert is positioned as an **AI + automation** product. The MVP demonstrates a full end-to-end flow:

1. a seller and prospect chat in Telegram
2. the bot reads and buffers messages
3. an LLM extracts structured sales information
4. the bot asks clarifying questions if critical data is ambiguous
5. leads and interactions are stored in Supabase
6. a live dashboard updates in real time for the manager

The repo and README show this clearly as the primary product narrative for the MVP.

## Current MVP scope
The codebase currently reflects a working or near-working hackathon MVP with these major parts:

### 1. Bot layer
Python bot using `python-telegram-bot`.

Responsibilities:
- receive messages from Telegram chats
- accumulate conversation context in buffers
- trigger analysis after inactivity, message count, or manual command
- send transcript/context to the extractor
- ask follow-up questions when ambiguities are detected
- persist extracted data into Supabase

### 2. Extraction layer
LLM-based extraction using GPT-4o in structured JSON mode.

Extracts fields such as:
- client name
- client company
- product interest
- estimated amount
- currency
- status
- sentiment
- next steps
- summary
- ambiguities
- returning client signal

### 3. Data layer
Supabase/PostgreSQL stores the commercial records.

Current core tables:
- `companies`
- `sellers`
- `leads`
- `interactions`

The migrations also show:
- seed demo data
- realtime enabled for `leads` and `interactions`
- source metadata fields on interactions

### 4. Frontend/dashboard layer
Next.js dashboard for managers.

The current product UI direction in the repo is a **manager-facing operational dashboard**, not a marketing site. It includes:
- lead views
- analytics views
- seller performance signals
- revenue/pipeline intelligence
- detail pages for individual records

### 5. Analytics module
The repo also includes a more advanced analytics layer (`DILBOT_ANALYTICS.md`) that interprets CRM data to generate customer-level priority signals and 30/90-day commercial predictions.

This module is useful because it expands Dilbert beyond passive data capture and toward decision support.

## Product roles
Across the broader project materials, Dilbert has two main roles:

### Manager
The manager is the buyer/user with visibility needs.

Expected responsibilities and value:
- see live pipeline and team activity
- track seller performance
- identify stalled or high-value leads
- choose between using Dilbert's CRM or integrating with an existing CRM
- configure channels, team members, and possibly inventory/product setup

### Seller / employee
The seller is the workflow user whose friction Dilbert removes.

Expected value:
- avoid manual data entry
- stay inside chat instead of switching tools
- clarify missing information only when necessary
- get automatic updates to CRM records without extra admin work

## Product positioning
Dilbert should be understood as **an AI agent first, CRM second**.

That distinction matters. The core innovation is not "another CRM dashboard." The core innovation is the intelligence layer that:
- lives in chat
- observes commercial conversations
- structures data automatically
- bridges informal selling behavior and formal pipeline management

This is especially strong for Latin American SMBs and mid-market teams where messaging channels dominate real commercial activity.

## Geographic and behavioral context
The project materials strongly frame Dilbert around Latin America and chat-first selling behavior.

Key assumptions:
- WhatsApp and messaging are the operational center of sales in LatAm
- many businesses still manage sales with fragmented systems, spreadsheets, or weak CRM usage
- traditional enterprise CRM flows are poorly adapted to chat-native teams
- an invisible or low-friction AI layer is more likely to be adopted than a heavy software process change

The MVP uses Telegram for speed and hackathon practicality, but the broader commercial narrative points toward multi-channel expansion, especially WhatsApp.

## Existing repo assets that should remain in the active workspace
These are useful and current:

- `README.md` — strong MVP summary and setup path
- `DILBOT_ANALYTICS.md` — useful product/analytics context
- `bot/` — active bot implementation
- `frontend/` — active dashboard implementation
- `supabase/` — schema and seed data
- `docker-compose.yml` — valuable for local execution/demo readiness
- `.env.example` — safe template for environment variables

## Things that should not drive the active workspace context
These should be ignored, archived, or treated as secondary:

- root `CLAUDE.md` — explicitly excluded
- `frontend/CLAUDE.md` — likely also excluded from active shared context unless manually rewritten later
- `frontend/README.md` — default Next.js boilerplate, low value for project reasoning
- any old prompts or instructions that describe previous names, previous IA prompts, or stale UI directions

## Current technical stack
- **Bot:** Python 3.11 + `python-telegram-bot`
- **LLM:** OpenAI GPT-4o
- **Database:** Supabase / PostgreSQL / Realtime
- **Frontend:** Next.js 16 + Tailwind CSS + Shadcn/UI
- **Deploy:** Vercel for frontend, Railway for bot, Supabase for DB
- **Containerization:** Docker Compose available

## What Dilbert is not
To keep future work focused, Dilbert should not be framed as:
- a generic chatbot
- a generic sales dashboard with no workflow intelligence
- a classical CRM replacement built around manual form entry
- an email-first sales automation product

## Recommended north star for future docs and design work
Dilbert is best described as:

> A conversational AI sales agent for chat-first teams that automatically converts live sales conversations into structured CRM intelligence and real-time management visibility.

That should be the anchor sentence for future landing pages, pitches, design prompts, and workspace instructions.
