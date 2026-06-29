import { NormalizedEvent } from "../../../../packages/core/src/event.js";

// A stand-in source so the whole pipeline runs end-to-end with zero API keys.
// Delete once real sources are wired up. Dates are generated relative to today
// so the "upcoming" filter always has something to show.
function daysFromNow(n: number, hour = 19): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(hour, 30, 0, 0);
  return d.toISOString();
}

export async function fetchEvents(): Promise<NormalizedEvent[]> {
  return [
    {
      title: "Singapore Symphony: Mahler 5", category: "music",
      venue: "Esplanade Concert Hall", startsAt: daysFromNow(3),
      priceMin: 48, priceMax: 120, ticketUrl: "https://example.com/sso",
      source: "mock", sourceId: "mock-001",
    },
    {
      title: "Yayoi Kusama: Infinite Mirrors", category: "museum",
      venue: "National Gallery Singapore", startsAt: daysFromNow(1, 10),
      endsAt: daysFromNow(60, 19), isRecurring: true, priceMin: 25,
      source: "mock", sourceId: "mock-002",
    },
    {
      title: "Hamlet — restaged", category: "theatre",
      venue: "Victoria Theatre", startsAt: daysFromNow(4, 20),
      priceMin: 55, priceMax: 95, source: "mock", sourceId: "mock-003",
    },
    {
      title: "Future World: Art Meets Science", category: "art",
      venue: "ArtScience Museum", startsAt: daysFromNow(0, 10),
      endsAt: daysFromNow(90, 19), isRecurring: true, priceMin: 21,
      source: "mock", sourceId: "mock-004",
    },
    {
      title: "Charlie Lim live", category: "music",
      venue: "Capitol Theatre", startsAt: daysFromNow(5, 20),
      priceMin: 68, source: "mock", sourceId: "mock-005",
    },
    {
      title: "Emerging Voices: group show", category: "art",
      venue: "STPI Creative Workshop", startsAt: daysFromNow(2, 11),
      endsAt: daysFromNow(23, 18), priceMin: 0,
      source: "mock", sourceId: "mock-006",
    },
  ];
}
