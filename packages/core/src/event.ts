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

// ---- Cross-source de-duplication ----
// The same real-world event can appear in two sources (e.g. a concert listed
// on both Ticketmaster and SG Culture Pass) with different ids, titles, and
// prices. The (source, source_id) constraint can't catch these, so we match
// fuzzily: two events are "the same" only when their titles are very similar
// AND they fall on the same day. Both conditions are required, deliberately
// conservative — wrongly hiding a real event is worse than keeping a dupe.

// Normalise a title for comparison: lowercase, drop punctuation, collapse
// spaces, and strip filler words that vary between sources.
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\b(the|a|an|presents?|by|live|in|concert|tour|2025|2026)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Token-based similarity: share of distinct words the two titles have in
// common (Jaccard index). Robust to word order and minor extra words.
function titleSimilarity(a: string, b: string): number {
  const ta = new Set(normalizeTitle(a).split(" ").filter(Boolean));
  const tb = new Set(normalizeTitle(b).split(" ").filter(Boolean));
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const w of ta) if (tb.has(w)) shared++;
  return shared / (ta.size + tb.size - shared);
}

function sameDay(a: NormalizedEvent, b: NormalizedEvent): boolean {
  const da = new Date(a.startsAt), db = new Date(b.startsAt);
  return (
    da.getUTCFullYear() === db.getUTCFullYear() &&
    da.getUTCMonth() === db.getUTCMonth() &&
    da.getUTCDate() === db.getUTCDate()
  );
}

// "Richness" score — when two records duplicate, we keep the higher one, so we
// don't lose ticket links or descriptions.
function richness(e: NormalizedEvent): number {
  let score = 0;
  if (e.ticketUrl) score += 3;
  if (e.venue && e.venue !== "See listing") score += 2;
  if (e.description) score += 1;
  if (e.priceMin != null) score += 1;
  if (e.imageUrl) score += 1;
  return score;
}

const SIMILARITY_THRESHOLD = 0.6; // tuned conservatively

// Collapse cross-source duplicates, keeping the richer record of each pair.
// Returns the deduped list plus a count of how many were removed.
export function dedupeAcrossSources(
  events: NormalizedEvent[],
): { events: NormalizedEvent[]; removed: number } {
  const kept: NormalizedEvent[] = [];
  let removed = 0;

  for (const e of events) {
    const dupIndex = kept.findIndex(
      (k) =>
        k.source !== e.source && // only dedupe across different sources
        sameDay(k, e) &&
        titleSimilarity(k.title, e.title) >= SIMILARITY_THRESHOLD,
    );
    if (dupIndex === -1) {
      kept.push(e);
    } else {
      removed++;
      // Replace the kept one if the new event is richer.
      if (richness(e) > richness(kept[dupIndex])) kept[dupIndex] = e;
    }
  }

  return { events: kept, removed };
}

