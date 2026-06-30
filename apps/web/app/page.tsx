"use client";

import { useEffect, useState } from "react";

interface Event {
  id: string;
  title: string;
  category: string;
  venue: string;
  address: string | null;
  starts_at: string;
  price_min: number | null;
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

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [category, setCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  // Match the visitor's system setting on first load, and respond if it changes.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setTheme(mq.matches ? "dark" : "light");
    const onChange = (e: MediaQueryListEvent) => setTheme(e.matches ? "dark" : "light");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (category !== "all") params.set("category", category);
    if (search) params.set("search", search);
    params.set("limit", "100");

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

  // Build ordered date groups.
  const groups: { key: string; items: Event[] }[] = [];
  for (const e of events) {
    const key = dateKey(e.starts_at);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(e);
    else groups.push({ key, items: [e] });
  }

  return (
    <main className="page">
      <header className="masthead">
        <div className="masthead-top">
          <span className="eyebrow">Singapore</span>
          <button
            className="theme-toggle"
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
          >
            {theme === "light" ? "Dark" : "Light"}
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

      {loading ? (
        <p className="state">Gathering what&rsquo;s on…</p>
      ) : events.length === 0 ? (
        <p className="state">Nothing here yet. Try another category.</p>
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
                  return (
                    <li className="event" key={e.id}>
                      <div className="event-time">{formatTime(e.starts_at)}</div>
                      <div className="event-main">
                        <h3 className="event-title">{e.title}</h3>
                        <p className="event-where">
                          {e.venue}
                          {area && <span className="event-area"> · {area}</span>}
                        </p>
                      </div>
                      <div className="event-meta">
                        <span className={`cat cat--${e.category}`}>{e.category}</span>
                        {price && <span className="event-price">{price}</span>}
                        {e.ticket_url && (
                          <a
                            className="event-link"
                            href={e.ticket_url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Tickets ↗
                          </a>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      <footer className="colophon">
        <span>What&rsquo;s On SG</span>
        <span>Event data via Ticketmaster and partners</span>
      </footer>
    </main>
  );
}
