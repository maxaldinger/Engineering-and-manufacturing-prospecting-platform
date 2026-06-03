# Portfolio Prospecting

Territory intelligence and AI sales engineering for multi-product reseller reps, organized by product type across the full portfolio.

## What's live

This repo has **no synthetic prospect data**. Earlier builds shipped with mock companies and contacts; those were removed because reps were starting to mistake fabricated names for real intelligence. Everything below is real data or AI run on real data.

### Sales Assist (live)

Email, LOU, Product Fit, Objections, Threading, Proposal, Deck, and MEDDPICC builders run against the Anthropic API on whatever the rep types in. No fake content, no hallucinated companies. The MEDDPICC scorecard parses the model's structured response into the 8 criteria, and the follow-up chat carries the current scorecard into the system prompt so answers stay grounded in what the rep documented.

### Territory Signal Feed (live)

`app/api/signals/route.ts` aggregates real signals for a US state or Canadian province:

- **ZoomInfo** — territory company discovery, firmographics, installed CAM/CAD technology detection, and real decision-maker contacts (emails, direct phones, LinkedIn). Primary source. Requires credentials (see below).
- **USAspending.gov** — federal manufacturing contract awards. Free, no auth.
- **Greenhouse public boards** — CNC / CAM / machinist job postings. Free, no auth.
- **Trade-press RSS** (Modern Machine Shop, IndustryWeek, American Machinist, AM&D) — news mentions. Free, no auth.

The three free sources work out of the box. ZoomInfo is what turns the feed from public-signal scraps into real account + contact intelligence. When ZoomInfo credentials are absent it is reported as a **skipped** source and the free sources still populate the feed — nothing breaks.

## Setup

```bash
npm install
cp .env.example .env.local
# add ANTHROPIC_API_KEY (required) and ZoomInfo credentials (optional) to .env.local
npm run dev
```

App runs on `http://localhost:3000`.

## ZoomInfo integration

### Credentials

ZoomInfo's Enterprise API issues a JWT valid ~60 minutes. The app caches and auto-refreshes it. Two auth modes are supported and **auto-detected** from the environment:

| Mode | Env vars | Notes |
| --- | --- | --- |
| **PKI** (recommended) | `ZOOMINFO_USERNAME` + `ZOOMINFO_CLIENT_ID` + `ZOOMINFO_PRIVATE_KEY` | Most secure. Store the PEM key on one line with literal `\n` for newlines. |
| **Basic** | `ZOOMINFO_USERNAME` + `ZOOMINFO_PASSWORD` | Simpler to set up. |

Token generation uses ZoomInfo's official [`zoominfo-api-auth-client`](https://www.npmjs.com/package/zoominfo-api-auth-client) package (a dependency in `package.json`). Basic auth also has a dependency-free fallback.

Verify your setup any time:

```bash
curl http://localhost:3000/api/zoominfo/status?check=1
# { "configured": true, "mode": "pki", "auth": "ok", ... }   <- never returns secrets
```

### API routes

| Route | What it does |
| --- | --- |
| `GET /api/zoominfo/status[?check=1]` | Report config + auth mode. `check=1` performs a live auth probe. |
| `GET /api/zoominfo/companies?location=Michigan` | Territory company discovery → `Signal[]` with contacts attached. |
| `GET /api/zoominfo/contacts?companyId=123` <br> `GET /api/zoominfo/contacts?company=Acme%20Machining` | Ranked, enriched decision-maker contacts for one company. |
| `POST /api/zoominfo/enrich` | On-demand enrich. Body: `{ "type": "company"\|"contact", "ids": ["..."] }`. |

The main `GET /api/signals?location=...` feed blends ZoomInfo with the free sources automatically.

### How it maps to the feed

Per territory pull, ZoomInfo runs: `/search/company` (manufacturers in the state, SIC-filtered) → `/enrich/company` (firmographics + tech stack) → `/search/contact` + `/enrich/contact` (decision-makers at the top-fit companies). Each company becomes a `Signal` (`signalType: "Tech Adoption"`) carrying its detected CAM/CAD stack and real contacts. CAM detections (Mastercam, Esprit, GibbsCAM, etc.) are scored as displacement targets; SOLIDWORKS/CAD shops as warm.

### Cost + tuning

ZoomInfo bills per enriched record, so the fan-out is capped and tunable via env (no code changes):

| Var | Default | Effect |
| --- | --- | --- |
| `ZOOMINFO_MAX_COMPANIES` | 25 | Companies discovered + enriched per search (max 25). |
| `ZOOMINFO_FETCH_CONTACTS` | true | Set `false` to skip contact enrichment and save credits. |
| `ZOOMINFO_CONTACT_COMPANIES` | 8 | Top-fit companies that get contact enrichment. |
| `ZOOMINFO_CONTACTS_PER_COMPANY` | 5 | Contacts enriched per company. |
| `ZOOMINFO_MIN_EMPLOYEES` | 0 | Skip companies smaller than this. |
| `ZOOMINFO_SIC_CODES` | manufacturing set | Override industry targeting (comma-separated SIC codes). |
| `ZOOMINFO_NAICS_CODES` | — | Target by NAICS instead of SIC. |
| `ZOOMINFO_BASE_URL` | `https://api.zoominfo.com` | Override the API base URL. |

> Field availability (e.g. `companyTechnologies`) depends on your ZoomInfo subscription/entitlements. The integration requests an extended field set and automatically falls back to a guaranteed-core set if your account rejects it, so it works across tiers. Verify field coverage against your account and adjust `lib/zoominfo/endpoints.ts` if needed.

## Stack

- Next.js 14 App Router
- TypeScript strict mode
- Tailwind CSS
- shadcn-style primitives
- Lucide icons
- Anthropic SDK with streaming
- ZoomInfo Enterprise API

## Project structure

```
app/
  page.tsx                  signal feed (landing)
  sales-assist/page.tsx     AI sales engineer (live)
  api/
    signals/route.ts        aggregated feed (ZoomInfo + free sources)
    assist/route.ts         Anthropic streaming endpoint
    zoominfo/
      status/route.ts       config + live auth check
      companies/route.ts    territory company discovery
      contacts/route.ts      contacts for a company
      enrich/route.ts        on-demand company/contact enrich
components/
  layout/                   sidebar + header
  signal-feed/              territory input, filters, card, empty state
  dossier/                  company dossier (AI brief + real contacts)
  sales-assist/             tabs, selectors, builders
  ui/                       primitives
lib/
  zoominfo/
    client.ts               auth, token cache, authorized request helper
    endpoints.ts            search/enrich wrappers + normalizers
    types.ts                request/response shapes
  signal-sources/
    zoominfo.ts             territory pull -> Signal[] (discovery + contacts)
    usaspending.ts          federal contracts (free)
    greenhouse-jobs.ts      CNC job postings (free)
    rss-news.ts             trade-press news (free)
    aggregate.ts            blends all sources
  cam-software.ts           CAM software list (real)
  hrs-context.ts            Sales Assist system prompt
  product-fit.ts            competitor to HRS replacement map
types/                      signal, contact, software
```

## Deploy

```bash
vercel deploy
```

Set environment variables in the host's project settings:

- `ANTHROPIC_API_KEY` (required)
- ZoomInfo: `ZOOMINFO_USERNAME` + (`ZOOMINFO_CLIENT_ID` + `ZOOMINFO_PRIVATE_KEY`) or `ZOOMINFO_PASSWORD`
- Optional ZoomInfo tuning vars (see table above)

The ZoomInfo routes use the Node.js runtime (set in each route via `export const runtime = "nodejs"`), so they run on any Node host (Vercel, a container, etc.).
