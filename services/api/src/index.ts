import "dotenv/config";
import express from "express";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? "postgres://localhost:5432/whatson",
  ssl: { rejectUnauthorized: false },
});

const app = express();
app.use((_, res, next) => { res.set("Access-Control-Allow-Origin", "*"); next(); });

// GET /api/events?category=music&search=jazz&limit=50
// Returns upcoming events, soonest first. This is the one endpoint the
// website and mobile app both call.
app.get("/api/events", async (req, res) => {
  const { category, search } = req.query;
  const limit = Math.min(Number(req.query.limit) || 50, 200);

  const conditions = ["starts_at >= now()"];
  const values: unknown[] = [];

  if (category && category !== "all") {
    values.push(category);
    conditions.push(`category = $${values.length}`);
  }
  if (search) {
    values.push(`%${String(search).toLowerCase()}%`);
    conditions.push(`(lower(title) like $${values.length} or lower(venue) like $${values.length})`);
  }
  values.push(limit);

  try {
    const { rows } = await pool.query(
      `select id, title, category, venue, starts_at, ends_at,
              price_min, price_max, currency, ticket_url, image_url, source
       from events
       where ${conditions.join(" and ")}
       order by starts_at asc
       limit $${values.length}`,
      values,
    );
    res.json({ count: rows.length, events: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "query failed" });
  }
});

app.get("/api/health", (_, res) => res.json({ ok: true }));

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`API on :${port}`));
