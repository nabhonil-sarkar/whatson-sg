import { NormalizedEvent, classifyCategory } from "../../../../packages/core/src/event.js";

// Ticketmaster Discovery API — free key from developer.ticketmaster.com.
// Docs: https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/
const BASE = "https://app.ticketmaster.com/discovery/v2/events.json";

interface TMResponse {
  _embedded?: { events?: TMEvent[] };
  page?: { totalPages?: number };
}
interface TMEvent {
  id: string;
  name: string;
  url?: string;
  info?: string;
  dates?: { start?: { dateTime?: string } };
  images?: Array<{ url: string; width: number }>;
  priceRanges?: Array<{ min: number; max: number; currency: string }>;
  classifications?: Array<{ segment?: { name?: string }; genre?: { name?: string } }>;
  _embedded?: { venues?: Array<{
    name?: string; address?: { line1?: string };
    location?: { latitude?: string; longitude?: string };
  }> };
}

function pickImage(images?: TMEvent["images"]): string | undefined {
  if (!images?.length) return undefined;
  // Prefer the widest image for crisp cards.
  return [...images].sort((a, b) => b.width - a.width)[0]?.url;
}

export async function fetchEvents(): Promise<NormalizedEvent[]> {
  const key = process.env.TICKETMASTER_API_KEY;
  if (!key) {
    console.warn("[ticketmaster] no API key set, skipping");
    return [];
  }

  const params = new URLSearchParams({
    apikey: key,
    countryCode: "SG",
    sort: "date,asc",
    size: "100",
  });

  const res = await fetch(`${BASE}?${params}`);
  if (!res.ok) {
    console.error(`[ticketmaster] HTTP ${res.status}`);
    return [];
  }

  const data = (await res.json()) as TMResponse;
  const raw = data._embedded?.events ?? [];

  return raw.map((e): NormalizedEvent => {
    const venue = e._embedded?.venues?.[0];
    const cls = e.classifications?.[0];
    const genreText = [cls?.segment?.name, cls?.genre?.name].filter(Boolean).join(" ");

    return {
      title: e.name,
      description: e.info,
      category: classifyCategory(genreText),
      venue: venue?.name ?? "Venue TBA",
      address: venue?.address?.line1,
      latitude: venue?.location?.latitude ? Number(venue.location.latitude) : undefined,
      longitude: venue?.location?.longitude ? Number(venue.location.longitude) : undefined,
      startsAt: e.dates?.start?.dateTime ?? new Date().toISOString(),
      priceMin: e.priceRanges?.[0]?.min,
      priceMax: e.priceRanges?.[0]?.max,
      currency: e.priceRanges?.[0]?.currency ?? "SGD",
      ticketUrl: e.url,
      imageUrl: pickImage(e.images),
      source: "ticketmaster",
      sourceId: e.id,
    };
  });
}
