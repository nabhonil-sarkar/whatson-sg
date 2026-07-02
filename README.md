# What's On SG

A live, self-updating guide to events in Singapore — concerts, theatre, art, and museum exhibitions — aggregated from multiple sources into one searchable feed. It refreshes itself daily with no manual involvement.

## Architecture

```
Sources → Aggregator (daily) → Postgres (Supabase) → Next.js app (API + UI)
```

The database is the seam: a scheduled aggregator writes to it, the web app only reads. Sources and front end evolve independently. Each source is a self-contained adapter that normalises its payload into a shared `NormalizedEvent` type, so adding one is a single new file plus a line in the registry. The aggregator is idempotent — safe to run repeatedly on a schedule.

## Sources

- **Ticketmaster Discovery API** — commercial concerts and touring shows, via the official API.
- **SG Culture Pass** — local arts and heritage events, which commercial ticketing misses. This source has no published API; I found its search endpoint by inspecting the site's network traffic, reverse-engineered its AWS Kendra-style response schema, and replicated the browser headers needed to pass its CloudFront checks.

## Cross-source de-duplication

The `(source, source_id)` constraint stops duplicates within a source, but the same event on two platforms has two different ids. So after fetching, the aggregator runs a fuzzy pass: normalise titles, score them by token (Jaccard) similarity, and treat two events as one only when similarity is high **and** they share a date — keeping the richer record. The conservative threshold errs toward keeping a borderline duplicate over hiding a distinct event.

## Stack

TypeScript throughout. Next.js (App Router) for the UI and API routes, PostgreSQL via Supabase. Deployed on Vercel; daily aggregation runs as a scheduled GitHub Action.

## Features

- Daily auto-update via GitHub Action
- Editorial interface, events grouped by date
- Responsive two-column desktop layout, single column on mobile
- Light and dark mode
- Date strip for filtering to a single day
- Expandable detail panel with ticket, map, and search links
- Search and filtering by category, day, and free text

## Setup

Requires Node.js (LTS) and PostgreSQL (I use Supabase; any Postgres works).

```bash
git clone https://github.com/nabhonil-sarkar/whatson-sg.git
cd whatson-sg
npm install
```

Create the schema from `db/schema.sql`, then set credentials in two places:

```
# .env (aggregator)
DATABASE_URL=your_postgres_connection_string
TICKETMASTER_API_KEY=your_key        # optional

# apps/web/.env.local (web app)
DATABASE_URL=your_postgres_connection_string
```

```bash
npm run aggregate   # populate the database
npm run web         # start UI + API on :3000
```

A `mock` sample source is included as a no-credentials fallback; it's unregistered in normal operation.

## Deployment

The web app deploys to Vercel (root directory `apps/web`, `DATABASE_URL` as an env var). Daily aggregation runs independently as a GitHub Action (`.github/workflows/aggregate.yml`) reading its secrets from the repo.

## Project layout

```
apps/web/            Next.js app — UI and API routes
db/schema.sql        Database schema
packages/core/       Shared types, normalisation, and dedup logic
services/aggregator/ Source adapters and the aggregation job
.github/workflows/   Scheduled aggregation
```

`services/api/` holds the original standalone API, kept for reference; the live API now runs inside the Next.js app.

## Roadmap

- Broader coverage from more arts and community sources
- Improved venue extraction where location is embedded in free text
- Separate views for distinct content types (events, things to do)
- A React Native client reusing the same API
