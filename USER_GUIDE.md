# Territory & Product Prospecting — User Guide

A prospecting tool that surfaces live buying signals for the accounts in your territory, tailored to the product line you sell.

## What it does

You give it two things:

1. Your territory (a region, metro, or area).
2. The product type you're prospecting for.

It returns a ranked list of accounts in that territory that are showing signals relevant to that product, then generates a grounded sales brief for any account you open. The results are specific to the product you chose. The same territory will surface different accounts depending on what you're selling.

## Quick start

1. Open the app.
2. Enter your territory and select a product type.
3. Review the ranked accounts. Each row shows the account, its fit score, and the signals that triggered it.
4. Click an account to open its full brief.
5. Use Sales Assist on any account to draft outreach, map contacts, or pressure-test the deal against your notes.

## Reading a brief

Each brief is built from real signals, not generated guesses. To make that visible, every field carries a provenance badge so you always know where a claim came from:

- **DETECTED**: pulled directly from a source such as a job posting, a contract award, or a news item. Traceable to where it was found.
- **INFERRED**: a reasoned conclusion drawn from detected signals. The reasoning is shown.
- **COMPUTED**: a calculated value. The fit score is the main one. Recomputable from its inputs.
- **CURATED**: a known, deliberately entered fact.
- **PENDING**: a placeholder where curated content (such as a battlecard) hasn't been added yet. It tells you it's missing rather than filling the gap with a guess.

### The fit score

The fit score is the one computed number in the brief. It's calculated from the signals and the product you selected, and it can be recomputed from its inputs at any time. It is not an AI opinion. It's a formula.

### Brief sections

- **Why it's a fit**: the account-specific case for the product.
- **Executive summary**: the short read on the account.
- **Related signals**: other signals tied to the same account.
- **Pain points**: each with a severity level and the discipline it touches.
- **Talking points**: framed as the questions a customer might raise and how to answer them.
- **Competitive displacement**: angles against incumbents, where known.
- **Key contacts**: tagged with how each was sourced.
- **Outreach sequence**: a multi-touch plan with email, LinkedIn, and call steps across roughly two weeks.

## The grounding promise

The tool is built so the AI cannot invent statistics, customer names, or specific numbers that aren't in the source data. A validator runs over every generated brief and strips anything unsupported before you see it. If the tool doesn't have a fact, it says so. This is deliberate: a brief you can trust in front of a customer is worth more than an impressive one that's quietly wrong.

## Sales Assist

Each account has a Sales Assist panel for working the deal. It's grounded in the notes you enter, so it won't invent details you didn't provide. Modes:

- **Ask Anything**: freeform questions about the account or deal.
- **Email**: drafts outreach grounded in the account and your notes.
- **Mutual Action Plan**: a shared, editable plan of next steps you can export.
- **Product Fit**: analyzes your notes against the product and returns a fit read.
- **Threading**: maps the buying committee from the contacts you enter and flags role gaps.
- **MEDDPICC**: runs the qualification framework against your notes and shows what's known and what's missing.

## Limitations (read this)

This is an early build. The core works and the grounding is reliable, but:

- It doesn't remember anything between sessions yet. Each search and brief is generated fresh, and there's no saved deal history. The deployment guide explains how to add a database that fixes this.
- Enrichment depth depends on which data sources are configured. Some signals come from scraping and can be patchy.
- It's tuned for a configured product catalog and reseller, which your administrator sets.

## Configuration

The reseller name and product catalog are set in a single config file (`lib/brand.ts`). Your administrator configures these before deployment.
