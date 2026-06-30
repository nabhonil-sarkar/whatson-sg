# What's On SG

A live, self-updating guide to events in Singapore — concerts, theatre, art, and museum exhibitions — aggregated from ticketing sources into a single, searchable feed.

I built this to solve a real gap: there's no single place to see everything happening across the city, since the data is scattered across ticketing platforms and individual venue sites. The site refreshes itself daily with no manual involvement.

## Architecture

The database is the seam. A scheduled aggregator writes to it; the web app only reads from it. That decoupling means sources and the front end evolve independently.

```
Sources → Aggregator (daily) → Postgres (Supabase) → Next.js app (API routes + UI)
```

- **Aggregator** — fetches from each source, normalises to a common shape, classifies into categories, deduplicates, and upserts. Idempotent, so running it repeatedly never creates duplicates and it's safe on a schedule.
- **Next.js app** — serves both the read-only API (as a route handler) and the user interface from one deployable unit. The API supports category filtering and full-text search over titles and venues.

Each source is a self-contained adapter that converts the provider's payload into a common `NormalizedEvent` type, so adding a venue or platform is one new file plus one line in the source registry.

## Stack

TypeScript throughout. Next.js (App Router) for the web app and its API routes, PostgreSQL via Supabase with the `pg` driver, and the Ticketmaster Discovery API as the first live source. Deployed on Vercel; daily aggregation runs as a scheduled GitHub Action.

## Features

- **Daily auto-update** — a GitHub Action runs the aggregator every morning, so the live site stays current without anyone touching it.
- **Editorial interface** — events grouped under date headings (Today, Tomorrow, then by weekday), with a serif/sans typographic pairing.
- **Light and dark mode** — light by default, with a toggle.
- **Expandable detail** — clicking an event opens an in-place panel with full date, location, price range, and links out to tickets, a map, and a web search.
- **Search and filtering** — by category, and by free-text over event titles and venues.

## Setup

Requires Node.js (LTS) and a PostgreSQL database. I use Supabase, but any Postgres works.

```bash
git clone https://github.com/nabhonil-sarkar/whatson-sg.git
cd whatson-sg
npm install
```

Create the database schema by running the contents of `db/schema.sql` against your database (the Supabase SQL editor works, or `psql`).

Then provide credentials in two places:

Project root `.env` — used by the aggregator:

```
DATABASE_URL=your_postgres_connection_string
TICKETMASTER_API_KEY=your_key        # optional — runs on sample data without it
```

`apps/web/.env.local` — used by the Next.js app's API routes:

```
DATABASE_URL=your_postgres_connection_string
```

## Running it

```bash
npm run aggregate   # fetch events into the database
npm run web         # start the app (UI + API) on :3000
```

Run the aggregator once to populate the database, then start the web app. Without a Ticketmaster key the aggregator falls back to sample data, so the app is runnable out of the box.

## Deployment

The web app deploys to Vercel from this repo, with the root directory set to `apps/web` and `DATABASE_URL` provided as an environment variable. Daily aggregation runs separately as a scheduled GitHub Action (`.github/workflows/aggregate.yml`), which reads `DATABASE_URL` and `TICKETMASTER_API_KEY` from repository secrets — keeping the always-on refresh independent of the web host.

## Project layout

```
apps/web/                 Next.js app — UI and API routes
  app/page.tsx            The events interface
  app/api/events/         Read-only events API (route handler)
  lib/db.ts               Shared database pool
db/schema.sql             Database schema
packages/core/            Shared types and normalisation logic
services/aggregator/      Source adapters and the aggregation job
  src/sources/            One adapter per source
.github/workflows/        Scheduled aggregation
```

Note: `services/api/` contains the original standalone API and is retained for reference; the live API now runs inside the Next.js app.

## Roadmap

- Broader coverage from arts-focused sources (SISTIC and direct venue listings), which need scraping or a data feed rather than a public API
- A responsive desktop layout that uses wider screens fully
- A React Native client reusing the same API
