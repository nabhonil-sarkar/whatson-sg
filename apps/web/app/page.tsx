"use client";

import { useEffect, useState } from "react";

interface Event {
  id: string;
  title: string;
  description: string | null;
  category: string;
  venue: string;
  address: string | null;
  starts_at: string;
  ends_at: string | null;
  price_min: number | null;
  price_max: number | null;
  currency: string | null;
  ticket_url: string | null;
  source: string;
}

const CATEGORIES = ["all", "music", "theatre", "art", "museum"] as const;
const API = "";

// Pull a short locality from a full address for the editorial "venue, area"
// line. Ticketmaster addresses are inconsistent, so this is best-effort:
// take the last meaningful comma-separated part that isn't a postal code.
function neighbourhood(address: string | null): string | null {
  if (!address) return null;
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  const last = parts[parts.length - 1];
  // Drop pure postal-code / "Singapore 123456" tails.
  if (/singapore/i.test(last) || /^\d+$/.test(last)) {
    return parts.length >= 3 ? parts[parts.length - 2] : null;
  }
  return last;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-SG", {
    hour: "numeric", minute: "2-digit",
  });
}
function formatPrice(min: number | null): string {
  if (min === null) return "";
  return min === 0 ? "Free" : `from $${min}`;
}

// Fuller date line for the expanded panel, e.g. "Friday, 3 July 2026".
function formatFullDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-SG", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

// Full price range for the panel: "$48 – $120", "Free", or "" when unknown.
function formatPriceRange(min: number | null, max: number | null): string {
  if (min === null) return "";
  if (min === 0 && (max === null || max === 0)) return "Free";
  if (max && max > min) return `$${min} – $${max}`;
  return `from $${min}`;
}

// A Google search that reliably surfaces the official page, reviews, etc.
// Always works, even when we have no ticket link for the event.
function googleSearchUrl(e: Event): string {
  const q = encodeURIComponent(`${e.title} ${e.venue} Singapore`);
  return `https://www.google.com/search?q=${q}`;
}

// Google Maps search for the venue — uses the full address when we have it,
// otherwise the venue name. Lets people see the location and get directions.
function googleMapsUrl(e: Event): string {
  const place = e.address ? `${e.venue}, ${e.address}` : `${e.venue}, Singapore`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`;
}

// Group events under human date headings like "Today", "Tomorrow",
// then "Thursday, 3 July". The date grouping is the editorial spine.
function dateKey(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate());
  const diffDays = Math.round(
    (startOfDay(d).getTime() - startOfDay(now).getTime()) / 86400000,
  );
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  return d.toLocaleDateString("en-SG", {
    weekday: "long", day: "numeric", month: "long",
  });
}

// A stable per-day key in local time (YYYY-MM-DD) for matching the strip
// selection against each event's date.
function dayKeyOf(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [category, setCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Default to light mode. Visitors switch to dark with the toggle.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (category !== "all") params.set("category", category);
    if (search) params.set("search", search);
    params.set("limit", "300");

    setLoading(true);
    const t = setTimeout(() => {
      fetch(`${API}/api/events?${params}`)
        .then((r) => r.json())
        .then((d) => setEvents(d.events ?? []))
        .catch(() => setEvents([]))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [category, search]);

  // Build the date strip spanning from today to the last loaded event, so its
  // length matches the data we actually have — every day shown is real. Capped
  // so a stray far-future event can't create an enormous strip.
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const daysWithEvents = new Set(events.map((e) => dayKeyOf(e.starts_at)));

  let lastEventDate = todayStart;
  for (const e of events) {
    const d = new Date(e.starts_at);
    if (d > lastEventDate) lastEventDate = d;
  }
  const spanDays = Math.min(
    Math.max(
      14,
      Math.round((lastEventDate.getTime() - todayStart.getTime()) / 86400000) + 1,
    ),
    120,
  );

  const stripDays = Array.from({ length: spanDays }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
    const key = dayKeyOf(d);
    return {
      key,
      weekday: d.toLocaleDateString("en-SG", { weekday: "short" }),
      date: d.getDate(),
      month: d.toLocaleDateString("en-SG", { month: "short" }),
      isFirst: d.getDate() === 1 || i === 0,
      hasEvents: daysWithEvents.has(key),
    };
  });

  // Apply the day filter (if any) before grouping.
  const visibleEvents = selectedDay
    ? events.filter((e) => dayKeyOf(e.starts_at) === selectedDay)
    : events;

  // Build ordered date groups.
  const groups: { key: string; items: Event[] }[] = [];
  for (const e of visibleEvents) {
    const key = dateKey(e.starts_at);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(e);
    else groups.push({ key, items: [e] });
  }

  return (
    <main className="page">
      <div className="sidebar">
      <header className="masthead">
        <div className="masthead-top">
          <span className="eyebrow">Singapore</span>
          <button
            className="theme-toggle"
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
          >
            {theme === "light" ? (
              <svg className="toggle-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            ) : (
              <svg className="toggle-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
              </svg>
            )}
            <span>{theme === "light" ? "Dark mode" : "Light mode"}</span>
          </button>
        </div>
        <h1 className="wordmark">What&rsquo;s On</h1>
        <p className="standfirst">
          A living guide to concerts, theatre, exhibitions and shows across the
          island. Updated every day.
        </p>
      </header>

      <div className="controls">
        <input
          className="search"
          placeholder="Search by name, venue or artist"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <nav className="filters" aria-label="Categories">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              className={`filter ${category === c ? "filter--on" : ""}`}
              onClick={() => setCategory(c)}
            >
              {c === "all" ? "Everything" : c[0].toUpperCase() + c.slice(1)}
            </button>
          ))}
        </nav>
      </div>
      </div>

      <div className="content">
      {!loading && events.length > 0 && (
        <div className="datestrip" role="group" aria-label="Filter by day">
          <button
            className={`day-chip day-chip--all ${selectedDay === null ? "day-chip--on" : ""}`}
            onClick={() => setSelectedDay(null)}
          >
            <span className="day-wd">All</span>
            <span className="day-num">★</span>
          </button>
          {stripDays.map((d, i) => (
            <span className="day-cell" key={d.key}>
              {d.date === 1 && i !== 0 && (
                <span className="month-marker">{d.month}</span>
              )}
              <button
                className={`day-chip ${selectedDay === d.key ? "day-chip--on" : ""} ${!d.hasEvents ? "day-chip--empty" : ""}`}
                onClick={() => setSelectedDay(selectedDay === d.key ? null : d.key)}
                disabled={!d.hasEvents}
              >
                <span className="day-wd">{d.weekday}</span>
                <span className="day-num">{d.date}</span>
              </button>
            </span>
          ))}
        </div>
      )}
      {loading ? (
        <p className="state">Gathering what&rsquo;s on…</p>
      ) : groups.length === 0 ? (
        <p className="state">Nothing on this day. Try another.</p>
      ) : (
        <div className="listings">
          {groups.map((g) => (
            <section className="daygroup" key={g.key}>
              <h2 className="dayhead">
                <span>{g.key}</span>
                <span className="daycount">{g.items.length}</span>
              </h2>
              <ul className="events">
                {g.items.map((e) => {
                  const area = neighbourhood(e.address);
                  const price = formatPrice(e.price_min);
                  const open = expandedId === e.id;
                  return (
                    <li className={`event ${open ? "event--open" : ""}`} key={e.id}>
                      <button
                        className="event-row"
                        onClick={() => setExpandedId(open ? null : e.id)}
                        aria-expanded={open}
                      >
                        <span className="event-time">{formatTime(e.starts_at)}</span>
                        <span className="event-main">
                          <span className="event-title">{e.title}</span>
                          <span className="event-where">
                            {e.venue}
                            {area && <span className="event-area"> · {area}</span>}
                          </span>
                        </span>
                        <span className="event-meta">
                          <span className={`cat cat--${e.category}`}>{e.category}</span>
                          {price && <span className="event-price">{price}</span>}
                          <span className={`event-chevron ${open ? "event-chevron--up" : ""}`}>
                            ↓
                          </span>
                        </span>
                      </button>

                      {open && (
                        <div className="event-detail">
                          <dl className="detail-facts">
                            <div>
                              <dt>When</dt>
                              <dd>
                                {formatFullDate(e.starts_at)}, {formatTime(e.starts_at)}
                                {e.ends_at &&
                                  formatFullDate(e.ends_at) !== formatFullDate(e.starts_at) &&
                                  ` – ${formatFullDate(e.ends_at)}`}
                              </dd>
                            </div>
                            <div>
                              <dt>Where</dt>
                              <dd>{e.address ? `${e.venue}, ${e.address}` : e.venue}</dd>
                            </div>
                            {formatPriceRange(e.price_min, e.price_max) && (
                              <div>
                                <dt>Price</dt>
                                <dd>{formatPriceRange(e.price_min, e.price_max)}</dd>
                              </div>
                            )}
                          </dl>

                          {e.description && (
                            <p className="detail-desc">{e.description}</p>
                          )}

                          <div className="detail-links">
                            {e.ticket_url && (
                              <a
                                className="detail-link detail-link--primary"
                                href={e.ticket_url}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Get tickets ↗
                              </a>
                            )}
                            <a
                              className="detail-link"
                              href={googleMapsUrl(e)}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Search map ↗
                            </a>
                            <a
                              className="detail-link"
                              href={googleSearchUrl(e)}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Search the web ↗
                            </a>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
      </div>

      <footer className="colophon">
        <span>What&rsquo;s On SG</span>
        <span>Event data via Ticketmaster and partners</span>
      </footer>
    </main>
  );
}
