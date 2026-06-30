import "dotenv/config";
import { Pool } from "pg";
import {
  NormalizedEvent, contentHash, isValid, dedupeAcrossSources,
} from "../../../packages/core/src/event.js";

import * as ticketmaster from "./sources/ticketmaster.js";
import * as sgculturepass from "./sources/sgculturepass.js";
import * as mock from "./sources/mock.js";

// Register every source here. Adding a new venue = one import + one line.
const SOURCES: Array<{ name: string; fetchEvents: () => Promise<NormalizedEvent[]> }> = [
  { name: "ticketmaster",   fetchEvents: ticketmaster.fetchEvents },
  { name: "sgculturepass",  fetchEvents: sgculturepass.fetchEvents },
  { name: "mock",           fetchEvents: mock.fetchEvents },
];

const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? "postgres://localhost:5432/whatson",
  ssl: { rejectUnauthorized: false },
});

// Upsert one event. ON CONFLICT keeps us idempotent: re-running the
// aggregator never creates duplicates, and only rewrites when content changed.
async function upsert(e: NormalizedEvent): Promise<"inserted" | "updated" | "unchanged"> {
  const hash = contentHash(e);
  const { rows } = await pool.query(
    `insert into events (
       title, description, category, venue, address, latitude, longitude,
       starts_at, ends_at, is_recurring, price_min, price_max, currency,
       ticket_url, image_url, source, source_id, content_hash, last_seen_at
     ) values (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18, now()
     )
     on conflict (source, source_id) do update set
       title = excluded.title, starts_at = excluded.starts_at,
       ends_at = excluded.ends_at, price_min = excluded.price_min,
       price_max = excluded.price_max, ticket_url = excluded.ticket_url,
       content_hash = excluded.content_hash, last_seen_at = now()
     where events.content_hash <> excluded.content_hash
     returning (xmax = 0) as inserted`,
    [
      e.title, e.description ?? null, e.category, e.venue, e.address ?? null,
      e.latitude ?? null, e.longitude ?? null, e.startsAt, e.endsAt ?? null,
      e.isRecurring ?? false, e.priceMin ?? null, e.priceMax ?? null,
      e.currency ?? "SGD", e.ticketUrl ?? null, e.imageUrl ?? null,
      e.source, e.sourceId, hash,
    ],
  );
  if (rows.length === 0) return "unchanged";
  return rows[0].inserted ? "inserted" : "updated";
}

export async function runAggregation(): Promise<void> {
  const tally = { inserted: 0, updated: 0, unchanged: 0, dropped: 0, errors: 0 };

  // Phase 1: gather all events from every source.
  const all: NormalizedEvent[] = [];
  for (const src of SOURCES) {
    try {
      const events = await src.fetchEvents();
      console.log(`[${src.name}] fetched ${events.length}`);
      for (const e of events) {
        if (!isValid(e)) { tally.dropped++; continue; }
        all.push(e);
      }
    } catch (err) {
      tally.errors++;
      console.error(`[${src.name}] failed:`, err instanceof Error ? err.message : err);
      // One source failing must not abort the others.
    }
  }

  // Phase 2: collapse the same real-world event appearing in multiple sources.
  const { events: deduped, removed } = dedupeAcrossSources(all);
  console.log(`Cross-source dedup: removed ${removed} duplicate(s), ${deduped.length} remain`);

  // Phase 3: write the survivors.
  for (const e of deduped) {
    const result = await upsert(e);
    tally[result]++;
  }

  console.log("Aggregation complete:", tally);
}

runAggregation()
  .then(() => pool.end())
  .catch((e) => { console.error(e); process.exit(1); });
