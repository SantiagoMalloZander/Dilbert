# DILBERT CRM — BRAND GUIDE
### *No grid required.*

---

## 01. BRAND PHILOSOPHY

Dilbert is not a tool. Dilbert is a **character** — slightly unhinged, deeply competent, and allergic to corporate boredom. Every design decision should feel like it was made by someone who genuinely hates generic SaaS and wants to do something about it.

> *"If you don't love your CRM, your CRM won't love your data."*
> — Probably a bot.

**Three brand tensions to always hold:**
- **Logic vs. Chaos** — the product is rigorous, but the presentation is wild.
- **Playful vs. Powerful** — it looks like a toy, it performs like a weapon.
- **Bot vs. Human** — automated to the bone, but weirdly personal.

---

## 02. VOICE & TONE

### Personality Traits
| Trait | What it means in copy |
|---|---|
| **Sarcastic but warm** | Jokes at the industry's expense, never the user's |
| **Confident without ego** | Doesn't oversell; lets the absurdity speak |
| **Slightly unhinged** | Unexpected metaphors, weird internal logic |
| **Technically fluent** | Can go deep without being dry |

### Voice Rules
- **Write like a smart person texting**, not like a startup pitch deck.
- Use **unexpected verbs**. Don't "integrate" — "hook into." Don't "analyze" — "distill."
- **Embrace the parenthetical.** (It's a vibe thing.)
- Avoid: synergy, streamline, robust, cutting-edge, leverage, seamless.
- Embrace: parasite (friendly kind), chaos, vibes, freak, unleashed, distill.

### Copy Examples
| ❌ Generic | ✅ Dilbert |
|---|---|
| "Automate your CRM workflows" | "Fields fill themselves. Invoices draft themselves." |
| "AI-powered sales insights" | "Turning 'Uhh' into 'Closing Probability.'" |
| "Connect your tools" | "Hooks into your Slack, WhatsApp, and Zoom like a sophisticated digital parasite. But the friendly kind." |
| "Get started free" | "Hire Dilbert Now. 14 days free. No credit card. Just vibes." |

---

## 03. COLOR PALETTE

### Primary Colors
```
--dilbert-cream:     #F5F0E8   /* Background — warm off-white, never pure white */
--dilbert-orange:    #D4420A   /* Hero text, CTA buttons, dominant accent */
--dilbert-teal:      #1A7A6E   /* Phase 02 cards, footer, trust elements */
--dilbert-yellow:    #F5D53F   /* Hero blob, Phase 03 card, energy accent */
--dilbert-dark:      #1A1A1A   /* Body text, headings on light BG */
```

### Secondary / UI Colors
```
--dilbert-orange-dark:  #8B2A00   /* Card borders, shadows, depth */
--dilbert-teal-dark:    #0F4A42   /* Footer BG, deep teal moments */
--dilbert-card-border:  #2A1A0A   /* Thick borders on cards — key to the aesthetic */
--dilbert-muted:        #6B6B6B   /* Captions, subtext */
--dilbert-label:        #8A7A5A   /* Phase labels, status labels */
```

### Usage Rules
- **Background is always cream** (`#F5F0E8`), never white, never gray.
- **Orange is the dominant action color** — CTAs, hero text, underlines.
- **Teal is for trust/depth** — it appears where you want the user to slow down and read.
- **Yellow is energy** — use it for things that should feel alive or urgent.
- **Borders are thick and dark** — cards have `3–4px solid #2A1A0A` borders. This is non-negotiable.
- Never use gradients between primary colors. Colors are used in solid blocks.

### Color Combinations
| Combo | Use case |
|---|---|
| Orange BG + Cream text | Phase 01 / Intercept cards |
| Teal BG + Cream text | Phase 02 / Distill cards, footer |
| Yellow BG + Dark text | Phase 03 / Automation cards |
| Cream BG + Orange text | Hero section, headings |
| Cream BG + Dark text | Body copy, feature descriptions |

---

## 04. TYPOGRAPHY

### Type Scale

**Display / Hero:**
- Font: `Anton` or a condensed heavy slab (fallback: `Impact`)
- Weight: 900 / Black
- Case: ALL CAPS
- Usage: Hero title "DILBERT", section headers "HOW LOGIC FLOWS"

**Heading / Subheader:**
- Font: `Space Grotesk` Bold or `DM Sans` ExtraBold
- Weight: 700–800
- Case: Sentence case, occasionally title case
- Usage: Card headlines, section intros

**Body:**
- Font: `DM Sans` Regular or `Inter` (exception to the rule — body needs legibility)
- Weight: 400
- Size: 14–16px
- Usage: Descriptions, feature copy

**Labels / Tags:**
- Font: Monospace — `JetBrains Mono` or `IBM Plex Mono`
- Weight: 400–500
- Case: ALL CAPS
- Letter-spacing: 0.1em
- Usage: "PHASE 01 // INTERCEPT", "STATUS: EXTRACTING VIBES", "LOGIC: ZERO GRID GRID"

### Typography Rules
- **Italics are for emphasis moments only** — "actually does the work", "DASHBOARD", "LOGIC". Use sparingly.
- **Size contrast is extreme** — hero text is huge, labels are tiny. No medium sizes in hero areas.
- Underlines can be colored (orange) for emphasis on key phrases in body copy.
- Mixing weights within a headline is intentional and encouraged.

---

## 05. LAYOUT & COMPOSITION

### Core Layout Principles
- **No clean grids** — elements overlap, blobs float freely, cards are offset.
- **Generous negative space** on the cream background, but cards are dense.
- **Cards break the horizontal flow** — they sit at angles or are staggered vertically in alternating left/right positions.
- **Blob shapes** (organic, rounded) are used as decorative background elements in cream or teal tones.
- **Sections are not separated by lines** — they're separated by color blocks or just space.

### Card Anatomy
Every feature/phase card follows this structure:
```
┌─────────────────────────────────────────┐  ← thick dark border (3–4px)
│  PHASE 01 // INTERCEPT                  │  ← monospace label, small, muted
│                                         │
│  Card headline that punches hard.       │  ← 22–28px, bold
│  It can be two lines.                   │
│                                         │
│  Supporting copy that explains the      │  ← 13–14px, muted, max 2 lines
│  headline without dulling it.           │
└─────────────────────────────────────────┘
  ↑ Card BG is solid colored (orange / teal / yellow)
  ↑ Card has an offset shadow in a darker tone of same family
```

### Spacing System
```
--space-xs:   4px
--space-sm:   8px
--space-md:   16px
--space-lg:   32px
--space-xl:   64px
--space-2xl:  96px
--space-3xl:  128px
```
- Section padding: `80–128px` vertical on desktop, `48–64px` on mobile.
- Card padding: `24–32px` internal.
- Never use `margin: auto` centering for hero content — let it breathe left-aligned or use intentional centering with visible intent.

---

## 06. COMPONENTS

### Navigation
- Logo: "DILBERT" in orange, bold condensed
- Nav links: small, uppercase, with underline on active
- CTA Button: "LAUNCH BOT" — orange BG, cream text, rounded pill, no shadow
- Sticky, minimal — never adds visual weight

### Buttons
```css
/* Primary CTA */
background: #D4420A;
color: #F5F0E8;
border-radius: 100px;       /* pill shape */
padding: 12px 28px;
font-weight: 700;
font-size: 14px;
letter-spacing: 0.03em;
border: none;

/* Secondary / Ghost */
background: transparent;
color: #D4420A;
border: 2px solid #D4420A;
border-radius: 100px;
/* same padding as primary */

/* On dark BG (teal/orange sections) */
background: #F5F0E8;
color: #1A1A1A;
```

### Status / Label Chips
```css
background: transparent;
border: 1.5px solid rgba(255,255,255,0.3);   /* or dark equivalent */
border-radius: 100px;
padding: 4px 12px;
font-family: monospace;
font-size: 11px;
letter-spacing: 0.08em;
text-transform: uppercase;
```
Example content: `● EXTRACTING VIBES` / `ZERO GRID GRID` / `PHASE 01 // INTERCEPT`

### Dashboard Mockup (UI Illustration)
- Rendered as a flat illustration, not a real UI
- Light card with colored inner elements (orange blocks, teal panels)
- Shows "VELOCITY SCORE: 9,000" — metrics are intentionally absurd
- "METRIC BASED ON PURE VIBES" as fine print
- Outer container: cream BG, rounded corners, thick border, subtle shadow

---

## 07. IMAGERY & ILLUSTRATION

### Photography Style
- **Black & white or duotone** — never full-color photography
- **Organic cutout shapes** (oval/blob masks) — images never sit in rectangles
- **Human moments** — conversation, connection, real work — not stock-photo-perfect
- Label overlays on images: small white chips with text like "HUMAN ELEMENT."

### Illustration Style
- **Flat, geometric, slightly cartoonish**
- Dashboard mockups are illustrated, not real screenshots
- Icons are simple, single-weight, slightly chunky
- The Dilbert mascot/logo mark: circle face with geometric features on yellow blob

### Decorative Elements
- **Blobs**: Organic rounded shapes used as background accents. Colors: cream, teal (low opacity), yellow.
- **Dots/textures**: Subtle grid of dots used as section backgrounds (see: dark sections with dot matrix)
- **Lightning bolt**: Used as a background motif in CTA sections
- No photography in hero — the type IS the visual.

---

## 08. MOTION & INTERACTION

### Principles
- Motion should feel **slightly glitchy, confident, and intentional** — not smooth corporate.
- Entrances are **fast** (200–300ms) with a slight overshoot or snap.
- Never animate everything — pick the **one moment that matters** per section.

### Key Animations
| Element | Animation |
|---|---|
| Hero title | Reveal from bottom, slight scale up, fast |
| Status chips | Pulse glow on the dot indicator |
| Phase cards | Stagger in on scroll, slight Y offset |
| CTA button | Scale 1.03 on hover, instant |
| Nav items | Underline slides in from left on hover |

### CSS Motion Tokens
```css
--ease-snap:    cubic-bezier(0.34, 1.56, 0.64, 1);   /* slight overshoot */
--ease-out:     cubic-bezier(0.16, 1, 0.3, 1);        /* fast out */
--duration-fast: 180ms;
--duration-mid:  300ms;
--duration-slow: 500ms;
```

---

## 09. NAMING & CONTENT CONVENTIONS

### Section Naming Pattern
Dilbert sections are named like internal systems, not marketing sections:
- ❌ "Features" → ✅ "HOW LOGIC FLOWS"
- ❌ "Pricing" → ✅ "HIRE DILBERT"
- ❌ "About" → ✅ "THE HUMAN ELEMENT"
- ❌ "Dashboard" → ✅ "THE DASHBOARD OF CHAOS"
- ❌ "Testimonials" → ✅ "FIELD REPORTS"

### Metric & Stats Style
Numbers should feel slightly unhinged but backed by logic:
- "2,000+ sales teams"
- "VELOCITY SCORE: 9,000"
- "METRIC BASED ON PURE VIBES"
- "14 DAYS FREE. NO CREDIT CARD. JUST VIBES."

### Footer Convention
- Brand statement + ironic quote
- Navigation labeled "NAVIGATION" in monospace caps
- Footer links in ALL CAPS: "THE GALLERY / KINETIC STATS / BOT LOGIC / PRIVACY CHAOS"
- Copyright: `©2024 DILBERT CRM. NO GRID REQUIRED.`
- Social links: minimal text only (TWITTER / ARENA / MIRROR)

---

## 10. DON'TS

| ❌ Never | Why |
|---|---|
| Pure white background | Kills the warmth and analog feel |
| Purple or blue gradients | Generic SaaS energy |
| Rounded cards without thick borders | Loses the editorial punch |
| Stock photography in full color | Too polished, breaks the character |
| Generic sans-serif for headlines | Must be condensed/display weight |
| Soft drop shadows | Use hard offset shadows instead |
| "Seamless", "robust", "leverage" | Brand-killing corporate words |
| Center-aligning body copy in long blocks | Hurts readability |
| Animations that loop indefinitely | Distracting, low class |
| More than 4 colors in one section | Palette discipline is key |

---

## 11. QUICK REFERENCE CARD

```
BRAND IN 6 WORDS:   Chaotic. Competent. Funny. Warm. Bold. Weird.

FONTS:              Anton (display) + DM Sans (body) + JetBrains Mono (labels)

COLORS:             Cream #F5F0E8 · Orange #D4420A · Teal #1A7A6E · Yellow #F5D53F

BORDERS:            Always thick, always dark (#2A1A0A), always present on cards

COPY VOICE:         Smart person texting, not startup pitch deck

LAYOUT:             Staggered, overlapping, no grid, blob accents

CTA:                Pill-shaped, orange, always ends with a vibe
                    ("Just vibes." / "No grid required." / "Probably a bot.")

AVOID:              Purple, blue, gradients, Inter headlines, corporate copy
```

---

*DILBERT CRM. NO GRID REQUIRED.*
