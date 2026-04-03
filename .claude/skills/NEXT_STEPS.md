# NEXT_STEPS.md

## Goal of this document
This document defines the most rational next steps for Dilbert after reviewing the current materials and repo. It is designed to help decide what belongs in the active workspace and what work should happen next.

## Immediate workspace cleanup
Before doing more design, prompts, or agent workflows, the active workspace should be cleaned.

### Keep in the active workspace
- `README.md`
- `DILBOT_ANALYTICS.md`
- `bot/`
- `frontend/`
- `supabase/`
- `docker-compose.yml`
- `.env.example`
- `PROJECT_CONTEXT.md`
- `MARKET_RESEARCH.md`
- `NEXT_STEPS.md`

### Remove from active reasoning context
- root `CLAUDE.md`
- `frontend/CLAUDE.md`
- `frontend/README.md` if it stays as generic Next.js boilerplate
- any outdated prompts, duplicate planning docs, or old naming experiments

### Archive instead of deleting if needed
Create an `archive/` folder for stale instructions or experiments you may want to revisit later without polluting the live workspace.

---

## Priority 1 — define the product story cleanly
Right now there are several overlapping narratives:
- hackathon MVP on Telegram
- long-term WhatsApp/LatAm vision
- "our CRM" vs "CRM integration"
- analytics expansion
- manager portal with many applications

These can coexist, but they need a clean hierarchy.

### Recommended product story
Use this hierarchy:

1. **Primary product:** AI agent that extracts sales intelligence from chat conversations.
2. **Current MVP:** Telegram bot + Supabase + live dashboard.
3. **Commercial direction:** multi-channel conversational CRM layer for LatAm, especially WhatsApp.
4. **Optional product expansion:** lightweight native CRM and advanced analytics.

### Action
Standardize this wording across:
- README
- landing page copy
- pitch deck/video
- future design docs
- workspace context docs

---

## Priority 2 — decide the core product position
You need to avoid trying to sell three products at once.

### Tension to resolve
Today the materials imply all of these:
- a CRM replacement
- a CRM integration layer
- a manager operating system with multiple apps
- a conversational intelligence agent

That is too much at once.

### Recommendation
For now, position Dilbert as:

**an AI conversational sales agent that can either feed your existing CRM or power a lightweight native CRM experience**

This keeps the agent at the center and stops the dashboard from becoming the entire identity of the product.

---

## Priority 3 — create the right design documents
Do not start from random prompts or scattered notes anymore.

### Minimum docs to keep current
- `PROJECT_CONTEXT.md`
- `MARKET_RESEARCH.md`
- `NEXT_STEPS.md`
- later: `DESIGN_DIRECTION.md`
- later: `LANDING_PAGE_SPEC.md`

### What should happen next
1. use current repo + research to generate a first strong landing page direction
2. create `DESIGN_DIRECTION.md` based on the visual prototype you liked
3. then create a more detailed `LANDING_PAGE_SPEC.md`
4. only then iterate with Stitch or similar design tools

This is the right order because it prevents vague prompt loops.

---

## Priority 4 — simplify the landing page scope
The landing page should not try to explain the full internal app ecosystem at once.

### What the landing page must communicate
- the problem: chat-first sales teams hate manual CRM updates
- the solution: Dilbert captures and structures data automatically from conversations
- the benefit: better seller productivity, better manager visibility
- the wedge: built for how sales really happen in LatAm
- the MVP proof: real-time dashboard + extracted leads + ambiguity resolution

### What the landing page should avoid
- too many app/module descriptions
- too much internal navigation detail
- turning into a product manual
- mixing manager onboarding, employee onboarding, pricing logic, channel settings, CRM modules, and analytics all above the fold

### Recommendation
Landing first. Product architecture second.

---

## Priority 5 — tighten the codebase messaging
The repo already has a decent base, but its visible docs should be made more coherent.

### Recommended edits
#### Root `README.md`
Keep it, but later improve:
- naming consistency
- product framing beyond hackathon language
- clarify Telegram as MVP and WhatsApp as larger strategic direction
- separate MVP reality from long-term roadmap

#### `DILBOT_ANALYTICS.md`
Keep it. It adds depth and helps show product expansion beyond raw extraction.

#### `frontend/README.md`
Either replace it with a real frontend-specific doc or remove it from the active workspace. Right now it is just boilerplate.

---

## Priority 6 — choose what to polish technically
From what is visible in the repo, the main technical value is already clear:
- conversation ingestion
- extraction
- storage
- realtime dashboard
- analytics direction

So the next technical work should likely focus on quality and demo clarity, not random features.

### Best technical priorities
1. improve extraction reliability and ambiguity handling
2. make lead updates and deduping more robust
3. ensure dashboard data clearly reflects real conversation state
4. refine analytics only if they strengthen the story rather than distract from it
5. improve demo resilience and local/dev execution

### Lower priority for now
- complex auth
- excessive module sprawl
- too many back-office configuration screens
- building a huge CRM suite before clarifying the main wedge

---

## Priority 7 — define the commercial roadmap in phases
This should stay explicit so the project doesn't feel scattered.

### Phase A — MVP / hackathon
- Telegram ingestion
- passive extraction
- ambiguity handling
- live dashboard
- basic analytics

### Phase B — early product
- better seller/manager UX
- stronger CRM data model
- cleaner dashboards
- polished landing page
- more persuasive product demo

### Phase C — commercial wedge
- WhatsApp or other major channel support
- CRM integrations with HubSpot, Salesforce, etc.
- production-grade permissions/compliance layer
- clearer pricing and packaging

### Phase D — platform
- advanced analytics
- follow-up intelligence
- seller coaching / alerts
- forecasting and prioritization
- multi-channel conversational operations

---

## Priority 8 — prepare the next file you actually need
The next file to create after these three is not another general note dump.
It should be one of these:

### Best next file
`DESIGN_DIRECTION.md`

This should include:
- brand positioning
- visual tone
- things to avoid in AI-looking landing pages
- section hierarchy
- typography direction
- component behavior
- inspiration translation into rules

Then:

### After that
`LANDING_PAGE_SPEC.md`

This should define:
- hero copy
- section order
- proof points
- screenshots/mockups needed
- CTA structure
- manager vs seller messaging
- pricing/explainer placement

---

## Summary of the smartest next move
Do this in order:

1. clean the workspace
2. keep only current repo assets and the three consolidated docs
3. standardize the product story around the AI agent
4. create `DESIGN_DIRECTION.md`
5. create `LANDING_PAGE_SPEC.md`
6. then iterate in Stitch or another design tool

## Final recommendation
The biggest risk right now is not technical failure. It is narrative sprawl.

Dilbert becomes strong when it stays centered on one idea:

**the AI agent that turns live chat conversations into structured CRM intelligence with almost no seller friction**

Every future design, prompt, repo edit, and landing page decision should reinforce that.
