# What's On SG

A Singapore events aggregator. One backend feeds both a website and a mobile app.

## Architecture

```
Sources → Aggregator (daily cron) → Database → API → Web + Mobile apps
```

The **database is the seam**. The aggregator only writes; the apps only read.
Each piece runs and deploys independently.

```
whatson-sg/
├── db/schema.sql              Postgres schema (the events table)
├── packages/core/             Shared Event type + normalization logic
├── services/
│   ├── aggregator/            Fetches from sources, dedupes, upserts (the "auto-update" engine)
│   │   └── src/sources/       One module per source — add venues here
│   └── api/                   Read-only REST API the apps call
└── apps/web/                  Next.js website (mobile app reuses the same API)
```

## Quick start

```bash
# 1. Install
npm install

# 2. Set up the database
cp .env.example .env          # fill in DATABASE_URL
npm run db:init               # creates the events table

# 3. Run the aggregator once (works with zero API keys — uses the mock source)
npm run aggregate

# 4. Start the API
npm run api                   # http://localhost:3001/api/events

# 5. Start the website
npm run web                   # http://localhost:3000
```

## Adding a real source

1. Create `services/aggregator/src/sources/yoursource.ts` exporting
   `fetchEvents(): Promise<NormalizedEvent[]>`.
2. Register it in `services/aggregator/src/index.ts` (one import + one array entry).
3. Convert the source's payload into `NormalizedEvent`. That's it — dedup,
   validation, and category classification are handled for you.

Real adapters to add, in rough priority order:
- **Ticketmaster** (included, needs a free API key) — concerts, big shows
- **Eventbrite** (API) — community and smaller events
- **SISTIC** (scrape) — the big SG ticketing site; theatre and arts
- **Esplanade / National Gallery / ArtScience** (scrape) — exhibits

## Making it auto-update

The aggregator is a plain script. Schedule it however you deploy:

```cron
# Daily at 4am Singapore time
0 4 * * *  cd /path/to/whatson-sg && npm run aggregate >> /var/log/whatson.log 2>&1
```

On serverless: a Supabase Edge Function or a GitHub Action on a schedule
works just as well. The aggregator is idempotent, so running it more often
is always safe — it never creates duplicates.

## The mobile app

The website talks to the API over plain HTTP/JSON. A React Native (Expo) app
calls the exact same `/api/events` endpoint and renders the same data — so
you reuse all the backend work. Start the app once the web version feels right.

## One honest note on coverage

"All upcoming events" is a goal, not a starting state. APIs cover the ticketed
mainstream cleanly; small gallery openings and indie gigs need per-venue
scrapers added over time. Launch with the APIs, grow coverage from there. A
"submit an event" form is a cheap way to fill gaps early.
