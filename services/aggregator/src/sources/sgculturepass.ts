import { NormalizedEvent, Category, classifyCategory } from "../../../../packages/core/src/event.js";

// SG Culture Pass — an undocumented but openly reachable search API backing
// the government's arts & heritage events site. Discovered via the site's own
// network calls. Returns rich local arts coverage that Ticketmaster misses.
//
// The endpoint sits behind CloudFront and rejects "naked" requests, so we send
// browser-like headers (Origin/Referer/User-Agent) to mimic a legitimate call.
const BASE = "https://api.sgculturepass.gov.sg/v1/search";
const SITE = "https://www.sgculturepass.gov.sg";

interface SCPItem {
  documentId: string;
  url?: string;
  title: string;
  content?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  price?: number;
  keywords?: string[];
}
interface SCPResponse {
  data?: {
    resultItems?: SCPItem[];
    totalNumberOfResults?: number;
  };
}

// Their keyword taxonomy → our categories. Fall back to title classification.
const KEYWORD_MAP: Record<string, Category> = {
  music: "music",
  theatre: "theatre",
  dance: "theatre",
  visualArts: "art",
  literaryArts: "art",
  films: "art",
  heritage: "museum",
};

function mapCategory(item: SCPItem): Category {
  for (const k of item.keywords ?? []) {
    if (KEYWORD_MAP[k]) return KEYWORD_MAP[k];
  }
  return classifyCategory(item.title);
}

// There's no structured venue field; the venue is embedded in the prose.
// Best-effort: pull the text after "at the"/"at " up to the next sentence
// break. Falls back to a neutral label when nothing is found.
function extractVenue(content: string | undefined): string {
  if (!content) return "See listing";
  const m = content.match(/\bat (?:the )?([A-Z][^.,;]{3,60}?)(?:[.,;]| on | from )/);
  return m ? m[1].trim() : "See listing";
}

// The content blob is English followed by a Chinese translation. Keep a short
// English snippet for the description: cut at the first long run of CJK chars.
function englishSnippet(content: string | undefined): string | undefined {
  if (!content) return undefined;
  const cut = content.search(/[\u4e00-\u9fff]/);
  const english = (cut > 40 ? content.slice(0, cut) : content).trim();
  if (!english) return undefined;
  return english.length > 400 ? english.slice(0, 397) + "…" : english;
}

async function fetchPage(page: number): Promise<SCPResponse> {
  const url = `${BASE}?searchText=&page=${page}&pageSize=50`;
  const res = await fetch(url, {
    headers: {
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "en-SG,en;q=0.9",
      "Origin": SITE,
      "Referer": `${SITE}/`,
      "sec-ch-ua": '"Google Chrome";v="149", "Chromium";v="149", "Not)A;Brand";v="24"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"',
      "Sec-Fetch-Dest": "empty",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "same-site",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as SCPResponse;
}

export async function fetchEvents(): Promise<NormalizedEvent[]> {
  const out: NormalizedEvent[] = [];
  const MAX_PAGES = 6; // 50 per page → up to ~300 events, plenty for daily sync

  for (let page = 1; page <= MAX_PAGES; page++) {
    let data: SCPResponse;
    try {
      data = await fetchPage(page);
    } catch (err) {
      console.error(`[sgculturepass] page ${page} failed:`, err instanceof Error ? err.message : err);
      break; // stop paginating on error; keep what we have
    }

    const items = data.data?.resultItems ?? [];
    if (items.length === 0) break; // no more results

    for (const item of items) {
      if (!item.startDate || !item.title) continue;
      out.push({
        title: item.title,
        description: englishSnippet(item.content) || item.description || undefined,
        category: mapCategory(item),
        venue: extractVenue(item.content),
        startsAt: item.startDate,
        endsAt: item.endDate,
        priceMin: typeof item.price === "number" ? item.price : undefined,
        currency: "SGD",
        ticketUrl: item.url,
        source: "sgculturepass",
        sourceId: item.documentId,
      });
    }

    // Be gentle: small pause between page requests.
    await new Promise((r) => setTimeout(r, 300));
  }

  return out;
}
