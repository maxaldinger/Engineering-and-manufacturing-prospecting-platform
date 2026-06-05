# Deployment & Development Guide

How to deploy the tool and the highest-value directions for extending it.

## Stack

- Next.js 14.2.18 (App Router)
- Deployed on Vercel
- AI generation via the Anthropic API (Claude)
- No database. The app is currently stateless and generates everything on demand.

## Environment variables

Set these in your Vercel project, or in `.env.local` for local development:

- `ANTHROPIC_API_KEY` (required). Powers brief generation and Sales Assist.
- `ADZUNA_APP_ID` and `ADZUNA_APP_KEY` (required for job-signal discovery). A free tier is available at the Adzuna developer site.
- `ZOOMINFO_*` (optional). Enables the ZoomInfo enrichment route. The tool runs without it, contact data is just thinner.

**Important:** this is a public repository. Never commit a real key. If a key is ever committed, treat it as compromised and rotate it immediately. Deleting the file is not enough once a key is in git history.

## Deploy

1. Fork or clone the repo.
2. Set the environment variables above in Vercel.
3. Configure your reseller and product catalog in `lib/brand.ts`.
4. Deploy. Vercel builds directly from the Next.js App Router setup.

## Architecture overview

The system is three layers:

1. **Discovery layer.** Takes a territory and product type and pulls public signals from multiple sources: job postings (Adzuna), Greenhouse boards, RSS news, federal contract awards (USAspending), company sites, and an optional ZoomInfo route. Results are deduplicated by a canonical company key, so the same company arriving from two sources collapses into one account.
2. **Scoring engine.** A frozen, deterministic classification and scoring layer. It's covered by golden snapshot tests, so any change that alters scoring output fails loudly. Treat it as stable and extend around it rather than inside it.
3. **Grounded brief layer.** Generates the per-account brief and the Sales Assist content. Every field carries provenance (detected, inferred, computed, curated, or pending). A validator (`validateProse`) runs over all generated text and strips unsupported numbers and customer names before output. This is the anti-fabrication guarantee. Preserve it in any change you make.

## Configuration

`lib/brand.ts` holds the reseller identity and product catalog. Set `BRAND.reseller` and the product list here. The briefs (the "Why [reseller]" case, the competitive angles) read from this config.

## Further development

In rough priority order.

### 1. Add a per-user database (highest leverage)

This is the single biggest upgrade. Today the app is stateless and forgets everything between sessions. A database unlocks deal tracking, saved account maps, account history, and persistent contact threading. It also re-enables features that were removed because they had nowhere to persist, such as marking accounts as pursued and saving accounts to a territory.

Recommended: Supabase (hosted Postgres with row-level security and auth), which fits the existing Vercel deployment cleanly.

Suggested schema:

```
users            (id, email, name, created_at)
accounts         (id, user_id, company_key, name, territory, product_type,
                  fit_score, last_mapped_at, raw_signals jsonb)
deals            (id, user_id, account_id, stage, value, close_date,
                  meddpicc jsonb, notes, updated_at)
contacts         (id, user_id, account_id, name, title, role, source, notes)
mapping_history  (id, user_id, account_id, mapped_at, snapshot jsonb)
```

Multi-tenant isolation: enable row-level security on every table and scope every row to `user_id`, or to an `org_id` if you want team-level sharing. The rule is that no query can return another user's rows. With Supabase, write RLS policies that check `auth.uid() = user_id` on select, insert, update, and delete. Never rely on client-side filtering for isolation.

What each table buys you:

- `mapping_history` is what turns the tool into a living account map. Each time a rep maps an account, snapshot the signals so they can see how that account has changed over time.
- `deals` with a `meddpicc` JSON column lets Sales Assist persist qualification state instead of re-deriving it every session.
- `contacts` persistence makes Threading stateful across sessions instead of in-session only.

### 2. Waterfall enrichment

Contact and account data quality is the main limiter. Currently ZoomInfo, Claude, and Adzuna run through proper API routes, and everything else is scraped. Build an enrichment chain that tries providers in order and falls through on a miss: for example ZoomInfo first, then a secondary provider such as Apollo or Clearbit, then scraping as the floor. Each layer should degrade gracefully and never fail the whole request on a single provider miss. This is the highest quality-per-effort improvement after the database.

### 3. Production deck export

The current deck output is basic. A real version that exports an actual `.pptx` (using a library such as pptxgenjs on the Node side, or python-pptx behind a route) is roughly a week of focused work. Documented here as a future enhancement.

### 4. General smoothing

This was a fast build. Expect rough edges in error states, loading states, and source coverage. The architecture is sound, the polish is where the remaining time goes.

## License

MIT. Free to use, modify, and build on.
