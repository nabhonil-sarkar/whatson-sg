import { NextRequest, NextResponse } from "next/server";
import { pool } from "../../../lib/db";

// GET /api/events?category=music&search=jazz&limit=50
// Upcoming events, soonest first. Same contract as the old Express endpoint,
// now running as a Vercel serverless function inside the Next.js app.
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const category = searchParams.get("category");
  const search = searchParams.get("search");
  const limit = Math.min(Number(searchParams.get("limit")) || 50, 200);

  const conditions = ["starts_at >= now()"];
  const values: unknown[] = [];

  if (category && category !== "all") {
    values.push(category);
    conditions.push(`category = $${values.length}`);
  }
  if (search) {
    values.push(`%${search.toLowerCase()}%`);
    conditions.push(`(lower(title) like $${values.length} or lower(venue) like $${values.length})`);
  }
  values.push(limit);

  try {
    const { rows } = await pool.query(
      `select id, title, category, venue, address, latitude, longitude,
              starts_at, ends_at, price_min, price_max, currency,
              ticket_url, image_url, source
       from events
       where ${conditions.join(" and ")}
       order by starts_at asc
       limit $${values.length}`,
      values,
    );
    return NextResponse.json({ count: rows.length, events: rows });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "query failed" }, { status: 500 });
  }
}
