import crypto from "node:crypto";

export type Category = "music" | "theatre" | "art" | "museum" | "other";

// The canonical shape every source must produce. Sources convert their
// own messy payloads into this; everything downstream speaks only this.
export interface NormalizedEvent {
  title: string;
  description?: string;
  category: Category;
  venue: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  startsAt: string;          // ISO 8601
  endsAt?: string;
  isRecurring?: boolean;
  priceMin?: number;
  priceMax?: number;
  currency?: string;
  ticketUrl?: string;
  imageUrl?: string;
  source: string;
  sourceId: string;
}

// Map a free-text genre/segment from a source onto our fixed categories.
// Keep this list small and intentional — it's the taxonomy users filter by.
// Order matters: more specific rules first. "musical" must beat "music",
// so theatre is checked before music, and the music rule uses word
// boundaries to avoid matching "musical".
const CATEGORY_RULES: Array<[RegExp, Category]> = [
  [/theatre|theater|\bplay\b|musical|drama|\bstage\b|opera/i, "theatre"],
  [/concert|\bmusic\b|\bgig\b|\bband\b|\bdj\b|symphony|orchestra|jazz/i, "music"],
  [/gallery|\bart\b|exhibition|painting|sculpture|installation/i, "art"],
  [/museum|heritage|exhibit|history/i, "museum"],
];

export function classifyCategory(raw: string | undefined): Category {
  if (!raw) return "other";
  for (const [pattern, cat] of CATEGORY_RULES) {
    if (pattern.test(raw)) return cat;
  }
  return "other";
}

// A stable hash of the fields that can change between syncs. If the hash
// is unchanged we skip the write; if it changed we update the row.
export function contentHash(e: NormalizedEvent): string {
  const material = [
    e.title, e.startsAt, e.endsAt ?? "", e.venue,
    e.priceMin ?? "", e.priceMax ?? "", e.ticketUrl ?? "",
  ].join("|");
  return crypto.createHash("sha256").update(material).digest("hex").slice(0, 16);
}

// Defensive: drop events with no title or date, trim whitespace.
export function isValid(e: NormalizedEvent): boolean {
  return Boolean(e.title?.trim() && e.startsAt && e.venue?.trim());
}
