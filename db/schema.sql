-- What's On SG — events database schema
-- Works with plain Postgres or Supabase.

create table if not exists events (
  id            uuid primary key default gen_random_uuid(),

  -- Core display fields
  title         text not null,
  description   text,
  category      text not null check (category in
                  ('music','theatre','art','museum','other')),
  venue         text not null,
  address       text,
  latitude      double precision,
  longitude     double precision,

  -- Timing. starts_at is the canonical sort key.
  starts_at     timestamptz not null,
  ends_at       timestamptz,
  is_recurring  boolean not null default false,

  -- Commercial
  price_min     numeric,
  price_max     numeric,
  currency      text default 'SGD',
  ticket_url    text,
  image_url     text,

  -- Provenance + dedup
  source        text not null,          -- 'ticketmaster' | 'eventbrite' | 'sistic' | ...
  source_id     text not null,          -- the event's id within that source
  content_hash  text not null,          -- hash of mutable fields, to detect changes

  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),

  -- A given external event appears once. Re-runs upsert by this key.
  unique (source, source_id)
);

-- Fast "upcoming events, soonest first" — the main app query.
create index if not exists idx_events_upcoming
  on events (starts_at);

create index if not exists idx_events_category on events (category);

-- Full-text search over title + venue for the search box.
create index if not exists idx_events_search
  on events using gin (to_tsvector('english', title || ' ' || venue));
