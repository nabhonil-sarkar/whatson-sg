"use client";

import { useEffect, useState } from "react";

interface Event {
  id: string;
  title: string;
  category: string;
  venue: string;
  starts_at: string;
  price_min: number | null;
  ticket_url: string | null;
  source: string;
}

const CATEGORIES = ["all", "music", "theatre", "art", "museum"] as const;
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-SG", {
    weekday: "short", day: "numeric", month: "short",
  });
}
function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-SG", {
    hour: "numeric", minute: "2-digit",
  });
}
function formatPrice(min: number | null): string {
  if (min === null) return "See listing";
  return min === 0 ? "Free" : `from $${min}`;
}

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [category, setCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams();
    if (category !== "all") params.set("category", category);
    if (search) params.set("search", search);

    setLoading(true);
    const t = setTimeout(() => {
      fetch(`${API}/api/events?${params}`)
        .then((r) => r.json())
        .then((d) => setEvents(d.events ?? []))
        .catch(() => setEvents([]))
        .finally(() => setLoading(false));
    }, 250); // debounce search typing
    return () => clearTimeout(t);
  }, [category, search]);

  return (
    <main className="page">
      <header className="header">
        <h1>What&apos;s On SG</h1>
        <p className="subtitle">Upcoming events across Singapore · updated daily</p>
      </header>

      <input
        className="search"
        placeholder="Search events, venues, artists"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="filters">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            className={`chip ${category === c ? "chip--active" : ""}`}
            onClick={() => setCategory(c)}
          >
            {c[0].toUpperCase() + c.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : events.length === 0 ? (
        <p className="muted">No events match. Try another category.</p>
      ) : (
        <ul className="list">
          {events.map((e) => (
            <li key={e.id} className="card">
              <div className={`datechip cat--${e.category}`}>
                <span className="day">{new Date(e.starts_at).getDate()}</span>
                <span className="mon">
                  {new Date(e.starts_at).toLocaleDateString("en-SG", { month: "short" })}
                </span>
              </div>
              <div className="body">
                <div className="titlerow">
                  <span className="title">{e.title}</span>
                  <span className={`tag cat--${e.category}`}>{e.category}</span>
                </div>
                <p className="venue">{e.venue}</p>
                <div className="meta">
                  <span>{formatDate(e.starts_at)} · {formatTime(e.starts_at)}</span>
                  <span>{formatPrice(e.price_min)}</span>
                </div>
              </div>
              {e.ticket_url && (
                <a className="cta" href={e.ticket_url} target="_blank" rel="noreferrer">
                  Tickets
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
