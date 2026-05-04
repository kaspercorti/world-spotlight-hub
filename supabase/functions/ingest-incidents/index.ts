// Ingests real-world incidents from GDELT (Doc API + Events 2.0) and classifies via Lovable AI.
// Public function (no JWT). Triggered by cron every 5 minutes.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const ALLOWED_TYPES = [
  "war", "airstrike", "explosion", "shooting", "terror",
  "protest", "civil", "robbery", "kidnapping", "arson", "cyber",
] as const;

type IncidentType = typeof ALLOWED_TYPES[number];
type Severity = "low" | "tension" | "active" | "war";

interface NormalizedIncident {
  external_id: string;
  title: string;
  summary: string;
  type: IncidentType;
  severity: Severity;
  lat: number;
  lng: number;
  location: string | null;
  country: string | null;
  source: string | null;
  source_url: string | null;
  occurred_at: string;
  content_hash: string;
}

// Deterministic fingerprint to collapse duplicates of the same event reported
// by many outlets. Combines normalized title + ~10km grid (1 decimal lat/lng).
async function makeContentHash(title: string, lat: number, lng: number): Promise<string> {
  const normTitle = (title || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  const key = `${normTitle}:${lat.toFixed(1)}:${lng.toFixed(1)}`;
  const buf = new TextEncoder().encode(key);
  const hashBuf = await crypto.subtle.digest("SHA-1", buf);
  return Array.from(new Uint8Array(hashBuf)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

// Extract a stable article ID from GDELT article URLs (e.g. ".../news/national/26064793.foo-bar/")
// so the same article syndicated to many local sites collapses into one row.
function gdeltArticleKey(url: string): string {
  const m = url.match(/(\d{7,})/);
  if (m) return `art-${m[1]}`;
  return url;
}

// =====================================================================
// GDELT Doc API (article search)
// =====================================================================
async function fetchOneGdelt(q: string, attempt = 0): Promise<any[]> {
  const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(q + ' sourcelang:eng')}&mode=ArtList&format=json&maxrecords=20&sort=DateDesc&timespan=24H`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "lovable-conflict-map/1.0" } });
    if (res.status === 429 && attempt < 2) {
      await new Promise((r) => setTimeout(r, 2500 * (attempt + 1)));
      return fetchOneGdelt(q, attempt + 1);
    }
    if (!res.ok) { console.error("GDELT doc fetch failed", q, res.status); return []; }
    const text = await res.text();
    try {
      const data = JSON.parse(text);
      return data.articles ?? [];
    } catch {
      console.error("GDELT non-JSON for query", q, ":", text.slice(0, 120));
      return [];
    }
  } catch (e) {
    if (attempt < 2) {
      await new Promise((r) => setTimeout(r, 1500));
      return fetchOneGdelt(q, attempt + 1);
    }
    console.error("GDELT request error", q, e instanceof Error ? e.message : e);
    return [];
  }
}

async function fetchGdeltDoc(): Promise<any[]> {
  // Broader violence/unrest keyword coverage.
  const queries = [
    '(shooting OR "shot dead" OR "opened fire")',
    '(bombing OR explosion OR blast OR detonation)',
    '(airstrike OR "air strike" OR missile OR drone strike)',
    '(protest OR riot OR "civil unrest" OR demonstration)',
    '(kidnapping OR hostage OR abduction OR abducted)',
    '(arson OR "set on fire" OR torched)',
    '(attack OR raid OR ambush OR clash OR siege)',
    '(stabbing OR "knife attack" OR "knife crime")',
    '(terror OR terrorist OR militant OR insurgent)',
    '("gang violence" OR cartel OR "drive-by")',
    '(hijacking OR sabotage OR cyberattack OR ransomware)',
  ];
  const all: any[] = [];
  for (const q of queries) {
    const articles = await fetchOneGdelt(q);
    all.push(...articles);
    await new Promise((r) => setTimeout(r, 600));
  }
  const seen = new Set<string>();
  return all.filter((a) => {
    if (!a.url || seen.has(a.url)) return false;
    seen.add(a.url);
    return true;
  });
}

function parseSeenDate(s: string): string | null {
  const m = s?.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`;
}

// =====================================================================
// GDELT Events 2.0 (geo-exact, CAMEO-coded)
// http://data.gdeltproject.org/gdeltv2/lastupdate.txt
// Each row is the latest 15-min export of CAMEO events with lat/lng.
// =====================================================================

// GDELT Events 2.0 removed — CAMEO codes were too unreliable (wrong classifications, unrelated articles).
// All incident classification now goes through Doc API + AI.

// =====================================================================
// AI classification for Doc API articles
// =====================================================================
async function classifyBatch(items: { id: string; title: string; snippet: string; country?: string }[]) {
  if (items.length === 0) return [];
  const sys =
    "You classify real-world incident headlines. ONLY include events where physical violence, destruction, or a direct physical threat occurred or is actively occurring RIGHT NOW. " +
    "REJECT (set type to null) ALL of the following: court cases, trials, sentencing, legal proceedings, lawsuits, indictments, convictions, executions by the state, arrests (unless during an active violent event), " +
    "political debates, legislation, policy changes, opinion pieces, editorials, retrospectives, anniversaries, memorials, " +
    "accidents (car crashes, fires without arson, natural disasters), sports, entertainment, celebrity news, " +
    "cybersecurity vulnerabilities/patches (only actual attacks with real damage count as 'cyber'), " +
    "missing persons (unless confirmed kidnapping), drug seizures, routine police activity. " +
    "Allowed types: war, airstrike, explosion, shooting, terror, protest, civil, robbery, kidnapping, arson, cyber. " +
    "Severity scale: low, tension, active, war. Use 'war' only for active armed conflict between military forces. " +
    "CRITICAL: 'event_city' MUST be the MAJOR city where the incident physically occurred (use the main city name, NOT suburbs/neighborhoods like 'Golders Green' — use 'London' instead). If you cannot determine a specific city from the headline, set type to null. " +
    "CRITICAL: 'event_country' MUST be the country where the incident PHYSICALLY OCCURRED, NOT the news outlet's country. " +
    "CRITICAL: 'event_key' is a SHORT canonical identifier for the unique real-world event. Multiple articles about the SAME event MUST produce the SAME event_key. Format: lowercase, no spaces, pattern: 'what-where-YYYYMMDD'. Examples: 'stabbing-london-20260501', 'bombing-kyiv-20260430', 'protest-paris-20260501'. If multiple headlines describe the same incident (e.g. 'Man charged after stabbing Jewish men in London' and 'UK police charge man for London stabbings'), they MUST get the same event_key. " +
    "Use official English country names from this list: United States, Mexico, Canada, United Kingdom, France, Germany, Sweden, Norway, Denmark, Finland, Russia, Ukraine, Poland, Israel, Palestine, Lebanon, Syria, Iraq, Iran, Yemen, Saudi Arabia, Egypt, Turkey, Sudan, South Sudan, Ethiopia, Somalia, Kenya, Nigeria, Mali, Burkina Faso, Niger, Libya, DR Congo, Congo, Cameroon, South Africa, Mozambique, India, Pakistan, Afghanistan, Bangladesh, Sri Lanka, Nepal, China, Japan, South Korea, North Korea, Taiwan, Philippines, Indonesia, Thailand, Vietnam, Myanmar, Malaysia, Australia, New Zealand, Brazil, Argentina, Colombia, Venezuela, Peru, Chile, Ecuador, Bolivia, Haiti, Italy, Spain, Greece, Belgium, Netherlands, Switzerland, Austria, Czech Republic, Hungary, Romania, Bulgaria, Serbia, Bosnia and Herzegovina, Kosovo. " +
    "If you cannot determine the country, set event_country to null.";

  const user = JSON.stringify(items);
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: sys },
        { role: "user", content: `Classify each item. Input:\n${user}` },
      ],
      tools: [{
        type: "function",
        function: {
          name: "classify_incidents",
          description: "Return classification for each input item.",
          parameters: {
            type: "object",
            properties: {
              results: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    type: { type: ["string", "null"], enum: [...ALLOWED_TYPES, null] },
                    severity: { type: "string", enum: ["low", "tension", "active", "war"] },
                    short_summary: { type: "string" },
                    event_city: { type: ["string", "null"], description: "Major city where the incident occurred. Use main city name, not neighborhoods." },
                    event_country: { type: ["string", "null"], description: "Country where the event occurred" },
                    event_key: { type: "string", description: "Canonical event identifier. Same real-world event = same key. Format: what-where-YYYYMMDD e.g. stabbing-london-20260501" },
                    event_lat: { type: ["number", "null"], description: "Approximate latitude of the city where the event occurred. Use your knowledge of world geography. E.g. Orlando FL = 28.54, London = 51.51, Kyiv = 50.45" },
                    event_lng: { type: ["number", "null"], description: "Approximate longitude of the city where the event occurred. E.g. Orlando FL = -81.38, London = -0.13, Kyiv = 30.52" },
                  },
                  required: ["id", "type", "severity", "short_summary", "event_city", "event_country", "event_key", "event_lat", "event_lng"],
                  additionalProperties: false,
                },
              },
            },
            required: ["results"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "classify_incidents" } },
    }),
  });
  if (!resp.ok) { console.error("AI classify failed", resp.status, await resp.text()); return []; }
  const data = await resp.json();
  const call = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!call) return [];
  try { return JSON.parse(call.function.arguments).results ?? []; }
  catch (e) { console.error("Failed to parse AI args", e); return []; }
}

// FIPS country code -> centroid (for Doc API fallback)
const COUNTRY_CENTROIDS: Record<string, [number, number]> = {
  "United States": [39.8, -98.6], "Mexico": [23.6, -102.5], "Canada": [56, -106],
  "United Kingdom": [54, -2], "France": [46.2, 2.2], "Germany": [51, 10],
  "Sweden": [62, 16], "Norway": [62, 10], "Denmark": [56, 10], "Finland": [64, 26],
  "Russia": [61, 100], "Ukraine": [49, 32], "Poland": [52, 19],
  "Israel": [31.5, 34.8], "Palestine": [31.9, 35.2], "Lebanon": [33.9, 35.9],
  "Syria": [35, 38], "Iraq": [33, 44], "Iran": [32, 53], "Yemen": [15.5, 48],
  "Saudi Arabia": [24, 45], "Egypt": [27, 30], "Turkey": [39, 35],
  "Sudan": [15.5, 32.5], "South Sudan": [7, 30], "Ethiopia": [9, 40],
  "Somalia": [5, 46], "Kenya": [-1, 38], "Nigeria": [10, 8], "Mali": [17, -4],
  "Burkina Faso": [12, -1], "Niger": [17, 8], "Libya": [26, 17],
  "DR Congo": [-2, 23], "Congo": [-1, 15], "Cameroon": [6, 12],
  "South Africa": [-29, 24], "Mozambique": [-18, 35],
  "India": [21, 78], "Pakistan": [30, 70], "Afghanistan": [33, 65],
  "Bangladesh": [24, 90], "Sri Lanka": [7, 81], "Nepal": [28, 84],
  "China": [35, 105], "Japan": [36, 138], "South Korea": [36, 128],
  "North Korea": [40, 127], "Taiwan": [23.7, 121],
  "Philippines": [13, 122], "Indonesia": [-2, 118], "Thailand": [15, 100],
  "Vietnam": [16, 107], "Myanmar": [21, 96], "Malaysia": [4, 102],
  "Australia": [-25, 134], "New Zealand": [-41, 174],
  "Brazil": [-14, -51], "Argentina": [-38, -63], "Colombia": [4, -73],
  "Venezuela": [8, -66], "Peru": [-9, -75], "Chile": [-30, -71],
  "Ecuador": [-1, -78], "Bolivia": [-16, -65], "Haiti": [19, -72],
  "Italy": [42, 12], "Spain": [40, -3], "Greece": [39, 22],
  "Belgium": [50, 4], "Netherlands": [52, 5], "Switzerland": [47, 8],
  "Austria": [47, 14], "Czech Republic": [49.7, 15.4], "Hungary": [47, 19],
  "Romania": [45, 25], "Bulgaria": [42, 25], "Serbia": [44, 21],
  "Bosnia and Herzegovina": [44, 18], "Kosovo": [42.6, 21],
};

async function processDocApi(supabase: any): Promise<number> {
  const articles = await fetchGdeltDoc();
  console.log(`GDELT Doc returned ${articles.length} articles`);
  if (articles.length === 0) return 0;

  // Collapse syndicated copies of the same article (same GDELT article ID across many local sites).
  const byArticleKey = new Map<string, any>();
  for (const a of articles) {
    if (!a.url) continue;
    const key = gdeltArticleKey(a.url);
    if (!byArticleKey.has(key)) byArticleKey.set(key, a);
  }
  const unique = Array.from(byArticleKey.values());
  console.log(`Doc unique articles after syndication-dedup: ${unique.length}`);

  const candidates = unique.slice(0, 80).map((a: any, i: number) => ({
    id: `gdelt-${gdeltArticleKey(a.url) || btoa(a.url).slice(0, 24) || i}`,
    title: (a.title ?? "").slice(0, 240),
    snippet: (a.title ?? "").slice(0, 240),
    country: a.sourcecountry,
    url: a.url,
    seendate: a.seendate,
    domain: a.domain,
  }));

  const ids = candidates.map((c) => c.id);
  const { data: existing } = await supabase.from("incidents").select("external_id").in("external_id", ids);
  const existingSet = new Set((existing ?? []).map((r: any) => r.external_id));
  const fresh = candidates.filter((c) => !existingSet.has(c.id));
  console.log(`Doc fresh after dedup: ${fresh.length}`);
  if (fresh.length === 0) return 0;

  const classified: any[] = [];
  for (let i = 0; i < fresh.length; i += 25) {
    const chunk = fresh.slice(i, i + 25).map((c) => ({
      id: c.id, title: c.title, snippet: c.snippet, country: c.country,
    }));
    const results = await classifyBatch(chunk);
    classified.push(...results);
  }

  const byId = new Map(classified.map((r: any) => [r.id, r]));
  const rows: NormalizedIncident[] = [];
  for (const c of fresh) {
    const cls = byId.get(c.id);
    if (!cls || !cls.type) continue;
    if (!ALLOWED_TYPES.includes(cls.type)) continue;
    const eventCountry: string | null = cls.event_country ?? null;
    if (!eventCountry) continue;
    const eventCity: string | null = cls.event_city ?? null;
    if (!eventCity) continue; // Require specific city — no country-level pins
    const centroid = COUNTRY_CENTROIDS[eventCountry];
    if (!centroid) continue;
    // Use AI-provided coordinates if available, otherwise fall back to country centroid
    const aiLat = typeof cls.event_lat === "number" && isFinite(cls.event_lat) ? cls.event_lat : null;
    const aiLng = typeof cls.event_lng === "number" && isFinite(cls.event_lng) ? cls.event_lng : null;
    const jitter = () => (Math.random() - 0.5) * 0.15; // Small jitter to avoid exact overlap
    const lat = (aiLat ?? centroid[0]) + jitter();
    const lng = (aiLng ?? centroid[1]) + jitter();
    const occurred = parseSeenDate(c.seendate) ?? new Date().toISOString();
    const eventKey = cls.event_key || `${cls.type}:${eventCity}:${eventCountry}`;
    // Use stable coords for hash (AI coords or centroid, no jitter)
    const content_hash = await makeContentHash(eventKey, aiLat ?? centroid[0], aiLng ?? centroid[1]);
    rows.push({
      external_id: c.id,
      title: c.title || "Untitled incident",
      summary: cls.short_summary ?? "",
      type: cls.type,
      severity: cls.severity ?? "tension",
      lat,
      lng,
      location: eventCity,
      country: eventCountry,
      source: c.domain ?? "GDELT",
      source_url: c.url ?? null,
      occurred_at: occurred,
      content_hash,
    });
  }

  if (rows.length === 0) return 0;
  // Dedup within batch on content_hash — keep first, collect extra sources
  const seen = new Map<string, NormalizedIncident>();
  const extraSources: { content_hash: string; source_name: string | null; source_url: string }[] = [];
  for (const r of rows) {
    if (!seen.has(r.content_hash)) {
      seen.set(r.content_hash, r);
    } else if (r.source_url) {
      extraSources.push({ content_hash: r.content_hash, source_name: r.source, source_url: r.source_url });
    }
  }
  const uniqueRows = Array.from(seen.values());
  const { error, data: upserted } = await supabase.from("incidents").upsert(uniqueRows, { onConflict: "content_hash", ignoreDuplicates: false }).select("id, content_hash, source, source_url");
  if (error) { console.error("Doc insert failed:", error); return 0; }

  // Insert sources into incident_sources table
  if (upserted && upserted.length > 0) {
    const hashToId = new Map<string, string>();
    for (const row of upserted) hashToId.set(row.content_hash, row.id);

    const sourcesToInsert: { incident_id: string; source_name: string | null; source_url: string }[] = [];
    // Primary sources from upserted rows
    for (const row of upserted) {
      if (row.source_url) sourcesToInsert.push({ incident_id: row.id, source_name: row.source, source_url: row.source_url });
    }
    // Extra sources from duplicate rows
    for (const es of extraSources) {
      const incId = hashToId.get(es.content_hash);
      if (incId) sourcesToInsert.push({ incident_id: incId, source_name: es.source_name, source_url: es.source_url });
    }
    if (sourcesToInsert.length > 0) {
      const { error: srcErr } = await supabase.from("incident_sources").upsert(sourcesToInsert, { onConflict: "incident_id,source_url", ignoreDuplicates: true });
      if (srcErr) console.error("Source insert failed:", srcErr);
    }
  }
  return uniqueRows.length;
}

// =====================================================================
// Main handler
// =====================================================================
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  const job = (async () => {
    try {
      const docCount = await processDocApi(supabase).catch((e) => { console.error("doc pipeline error", e); return 0; });
      console.log(`Ingest complete: doc=${docCount}`);
    } catch (e) {
      console.error("Background ingest error:", e);
    }
  })();

  // @ts-ignore EdgeRuntime is provided by Supabase Edge runtime.
  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
    // @ts-ignore
    EdgeRuntime.waitUntil(job);
  }

  return new Response(
    JSON.stringify({ status: "accepted", message: "Ingestion running in background." }),
    { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
