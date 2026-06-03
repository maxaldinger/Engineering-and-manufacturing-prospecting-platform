# Portfolio Prospecting

Territory intelligence and AI sales engineering for multi-product reseller reps. Prospects, signals, and recommendations are organized by **product type** across the full portfolio — CAD, CAM, Simulation, Electrical, Design Automation, Additive, and Manufacturing Services — not by industry vertical (industry is a secondary signal).

The product line names themselves (SOLIDWORKS, CAMWorks, DriveWorks, Markforged, …) are the catalog the tool helps resell. The application carries no specific reseller's brand — rebranding is a one-line change in `lib/brand.ts`.

This repo has **no synthetic prospect data**. Everything below is real data or AI run on real data.

## What's live

### Territory Signal Feed (`/`)

Type a US state or Canadian province; the feed aggregates real signals and groups them by company. Every signal is classified by **product type** — the primary filter (7 chips). A secondary software/competitor filter is **scoped to the active product types**, and an always-visible, independently-toggled **Unclassified** bucket guarantees that signals with no detected product type are never silently hidden.

Sources (`lib/signal-sources/aggregate.ts`), blended automatically:

- **ZoomInfo** — territory company discovery, firmographics, installed-technology detection (competitor + portfolio tools across all product types), and real decision-maker contacts. Primary source; requires credentials (optional).
- **USAspending.gov** — federal manufacturing contract awards. Free, no auth.
- **Greenhouse public boards** — CNC / engineering / manufacturing job postings. Free, no auth.
- **Trade-press RSS** (Modern Machine Shop, IndustryWeek, American Machinist, AM&D) — news mentions. Free, no auth.

The three free sources work out of the box. When ZoomInfo credentials are absent it is reported as a **skipped** source and the free sources still populate the feed. Each source's status (`ok` / `error` / `skipped`) and count are surfaced in the feed, and degraded fetches log what's missing and why.

### Sales Assist (`/sales-assist`)

Email, LOU, Product Fit, Objections, Threading, Proposal, Deck, and MEDDPICC builders run against the Anthropic API on whatever the rep types. The system prompt and the per-prospect replacement mapping are **derived from the product catalog** (`lib/sales-context.ts`), so they stay in sync with the portfolio.

## Product-type catalog (the core data model)

`productType` is the first-class dimension. The catalog (`lib/catalog/`) holds the 7 product types — each with the products we sell, relevance keywords, and a flat list of competitors tagged with `productTypes`. Detection, filtering, scoring, ranking, and the AI prompts all derive from it.

`productTypes` is multi-category: a suite tool such as NX spans `["cad","cam","simulation"]` without being duplicated.

**Adding an 8th product type is a data change, not new code:** add an id to `ProductTypeId`, one entry to `PRODUCT_TYPES`, and tag competitors with it. Nothing hardcodes the seven.

### Draft / unvalidated competitive claims

CAM competitor fit reasons are real and assertable. The other product types are seeded with `draft: true` competitors whose specific differentiators are **not** validated. `fitForPrompt` **structurally withholds** draft reasons from every prompt: a draft competitor is framed as a category offering ("our *X* offering, worth a conversation"), never an asserted replacement. No unvalidated competitive claim can reach the model — the prompt rule is only a backstop.

## Setup

```bash
npm install
cp .env.example .env.local
# add ANTHROPIC_API_KEY (required) and ZoomInfo credentials (optional) to .env.local
npm run dev
```

App runs on `http://localhost:3000`.

## Testing

```bash
npm test   # vitest
```

- **Detection golden snapshot** — `lib/catalog/detection.test.ts`. A frozen snapshot of CAM detection output; guards against any detection regression now that the legacy oracle is gone.
- **Scoring + ranking characterization** — `lib/signal-sources/scoring-characterization.test.ts`. CAM-only and empty inputs score and rank identically; non-CAM types contribute additively (one tunable weight config in `lib/catalog/weights.ts`).
- **Feed filter** — `components/signal-feed/apply-filters.test.ts`. Unclassified survives all product-type combinations; software is scoped; empty selection shows all.
- **Structural draft guard** — `components/dossier/brief.test.ts`. Draft (non-CAM) competitors never inject specific reasons into a prompt.

Dev tool (not part of the build): `npx tsx scripts/test-brief.ts` runs a live dossier generation on a synthetic Mastercam + Ansys prospect and prints `whyFit` / `portfolioFit`. Reads `ANTHROPIC_API_KEY` from `.env.local`.

## ZoomInfo integration

ZoomInfo's Enterprise API issues a ~60-minute JWT; the app caches and auto-refreshes it. Two auth modes are **auto-detected** from the environment:

| Mode | Env vars | Notes |
| --- | --- | --- |
| **PKI** (recommended) | `ZOOMINFO_USERNAME` + `ZOOMINFO_CLIENT_ID` + `ZOOMINFO_PRIVATE_KEY` | Store the PEM key on one line with literal `\n` for newlines. |
| **Basic** | `ZOOMINFO_USERNAME` + `ZOOMINFO_PASSWORD` | Simpler to set up. |

Verify any time: `curl http://localhost:3000/api/zoominfo/status?check=1` (never returns secrets).

| Route | What it does |
| --- | --- |
| `GET /api/zoominfo/status[?check=1]` | Report config + auth mode; `check=1` does a live auth probe. |
| `GET /api/zoominfo/companies?location=Michigan` | Territory company discovery → `Signal[]` with contacts attached. |
| `GET /api/zoominfo/contacts?companyId=123` | Ranked, enriched decision-maker contacts for one company. |
| `POST /api/zoominfo/enrich` | On-demand enrich. Body: `{ "type": "company"\|"contact", "ids": ["..."] }`. |

Per territory pull, ZoomInfo runs `/search/company` (SIC/NAICS-filtered) → `/enrich/company` (firmographics + tech stack) → `/search/contact` + `/enrich/contact`. Each company becomes a `Signal` carrying its detected stack (classified by product type) and real contacts. Field availability depends on your subscription; the integration requests an extended field set and falls back to a guaranteed-core set if rejected (logging the degradation), so it works across tiers.

Spend is bounded and env-tunable (no code changes): `ZOOMINFO_MAX_COMPANIES`, `ZOOMINFO_FETCH_CONTACTS`, `ZOOMINFO_CONTACT_COMPANIES`, `ZOOMINFO_CONTACTS_PER_COMPANY`, `ZOOMINFO_MIN_EMPLOYEES`, `ZOOMINFO_SIC_CODES`, `ZOOMINFO_NAICS_CODES`, `ZOOMINFO_BASE_URL`. See `.env.example`.

## Stack

- Next.js 14 App Router
- TypeScript strict mode
- Tailwind CSS + shadcn-style primitives, Lucide icons
- Anthropic SDK with streaming
- ZoomInfo Enterprise API
- vitest

## Project structure

```
app/
  page.tsx                  signal feed (landing)
  sales-assist/page.tsx     AI sales engineer
  api/
    signals/route.ts        aggregated feed (ZoomInfo + free sources)
    assist/route.ts         Anthropic streaming endpoint
    zoominfo/...             status / companies / contacts / enrich
components/
  signal-feed/              territory input, product-type + software filters,
                            apply-filters (pure, tested), rows
  dossier/                  company dossier + brief.ts (pure prompt logic)
  sales-assist/             tabs, selectors, builders
  ui/                       primitives
lib/
  brand.ts                  product name / tagline / User-Agent (rebrand here)
  catalog/                  productType catalog: types, competitors, weights,
                            detection, fit (draft-aware), golden detection test
  sales-context.ts          Sales Assist system prompt (catalog-derived)
  signal-grouping.ts        Signal[] -> CompanyGroup[]
  signal-sources/           zoominfo / usaspending / greenhouse / rss + extract
types/                      signal, contact, product
scripts/test-brief.ts       dev-only live brief runner (excluded from the build)
```

## Deploy

```bash
vercel deploy
```

Set environment variables in the host's project settings: `ANTHROPIC_API_KEY` (required); ZoomInfo vars (optional) and tuning vars (above). The ZoomInfo routes use the Node.js runtime (`export const runtime = "nodejs"`), so they run on any Node host.
