# What's On SG

An aggregator for live events in Singapore — concerts, theatre, art, and museum exhibitions — pulled from multiple ticketing sources into a single, searchable feed. One backend powers both a web and (planned) mobile client.

I built this to solve a real gap: there's no single place to see everything happening across the city, since the data is scattered across ticketing platforms and individual venue sites.

## Architecture

The database is the seam between two independent halves. A scheduled aggregator writes to it; the API and web client only read from it. That decoupling means sources and clients can change without touching each other.

```
Sources → Aggregator → Postgres (Supabase) → API → Web client
```

- **Aggregator** — fetches from each source, normalises to a common shape, deduplicates, and upserts. Idempotent, so it's safe to run on a schedule.
- **API** — read-only REST endpoint with category filtering and search.
- **Web** — Next.js front end that renders the feed.

Each source is a self-contained adapter, so adding a new venue or platform is one file plus one line in the registry.

## Stack

TypeScript throughout. Next.js (web), Express (API), PostgreSQL via Supabase, `pg` for database access. Ticketmaster Discovery API as the first live source.

## Setup

Requires Node.js (LTS) and a PostgreSQL database. I use Supabase, but any Postgres works.

```bash
git clone https://github.com/nabhonil-sarkar/whatson-sg.git
cd whatson-sg
npm install
```

Create a `.env` file in the project root:

```
DATABASE_URL=your_postgres_connection_string
TICKETMASTER_API_KEY=your_key        # optional — runs on sample data without it
NEXT_PUBLIC_API_URL=http://localhost:3001
```

Create the schema by running the contents of `db/schema.sql` against your database (the Supabase SQL editor works, or `psql`).

## Running it

```bash
npm run aggregate   # fetch events into the database
npm run api         # start the API on :3001
npm run web         # start the web client on :3000
```

Run the aggregator once to populate the database, then start the API and web client in separate terminals. Without a Ticketmaster key the aggregator falls back to sample data, so the app is runnable out of the box.

## Project layout

```
db/                  Database schema
packages/core/       Shared types and normalisation logic
services/aggregator/ Source adapters and the aggregation job
services/api/        REST API
apps/web/            Next.js front end
```

## Roadmap

- Additional sources (Eventbrite, SISTIC, direct venue scrapers)
- Scheduled aggregation in the cloud for hands-off daily updates
- Deployment and a React Native client sharing the same API
