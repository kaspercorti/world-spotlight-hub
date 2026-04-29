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

// Strict CAMEO -> our taxonomy. Only specific violent sub-codes, not entire roots, to filter noise.
function cameoToType(eventCode: string): { type: IncidentType; severity: Severity } | null {
  if (!eventCode) return null;
  const c = eventCode;
  // 145* = riot / violent demonstration
  if (c.startsWith("145")) return { type: "protest", severity: "active" };
  // NOTE: 173* (arrest/detain) deliberately EXCLUDED — too noisy (every drink-driving arrest matched).
  // 175 = use tactics of violent repression
  if (c.startsWith("175")) return { type: "shooting", severity: "active" };
  // 18* ASSAULT (physical)
  if (c === "180" || c === "181" || c.startsWith("181")) return { type: "shooting", severity: "active" };
  if (c === "182" || c.startsWith("182")) return { type: "kidnapping", severity: "active" };
  if (c === "183" || c.startsWith("183")) return { type: "explosion", severity: "active" };
  if (c === "184" || c.startsWith("184")) return { type: "shooting", severity: "active" };
  if (c === "185" || c.startsWith("185")) return { type: "airstrike", severity: "war" };
  if (c === "186" || c.startsWith("186")) return { type: "kidnapping", severity: "active" };
  // 19* FIGHT — only actual combat sub-codes (skip 190/191/192 which are threats)
  if (c === "193" || c.startsWith("193")) return { type: "shooting", severity: "active" };
  if (c === "194" || c.startsWith("194")) return { type: "explosion", severity: "active" };
  if (c === "195" || c.startsWith("195")) return { type: "war", severity: "war" };
  if (c === "196" || c.startsWith("196")) return { type: "war", severity: "war" };
  // 20* MASS VIOLENCE
  if (c.startsWith("201") || c.startsWith("202") || c.startsWith("203")) return { type: "terror", severity: "war" };
  if (c.startsWith("204")) return { type: "war", severity: "war" };
  return null;
}

async function fetchGdeltEvents(): Promise<NormalizedIncident[]> {
  try {
    // Get the latest export filename
    const lu = await fetch("http://data.gdeltproject.org/gdeltv2/lastupdate.txt");
    if (!lu.ok) { console.error("Events lastupdate failed", lu.status); return []; }
    const luText = await lu.text();
    // First line points to the export.CSV.zip; we want the .export.CSV.zip URL
    const exportLine = luText.split("\n").find((l) => l.includes(".export.CSV.zip"));
    if (!exportLine) { console.error("No export line in lastupdate"); return []; }
    const url = exportLine.trim().split(/\s+/).pop();
    if (!url) return [];

    // Use Deno's gunzip via DecompressionStream — but the file is .zip not .gz.
    // We instead fetch the .CSV (uncompressed) endpoint by transforming URL? GDELT
    // only serves zipped exports. We use a proxy-free approach: fetch zip and unzip.
    const zipRes = await fetch(url);
    if (!zipRes.ok) { console.error("Events zip fetch failed", zipRes.status); return []; }
    const zipBuf = new Uint8Array(await zipRes.arrayBuffer());

    // Minimal ZIP reader: locate first file, inflate raw deflate stream.
    const csv = await unzipFirstFile(zipBuf);
    if (!csv) { console.error("Failed to unzip GDELT events"); return []; }

    // GDELT Events 2.0 column indexes (0-based) — we need a few:
    // 0 GLOBALEVENTID, 1 SQLDATE, 26 EventCode, 31 NumMentions, 33 GoldsteinScale,
    // 51 ActionGeo_Type, 52 ActionGeo_FullName, 53 ActionGeo_CountryCode,
    // 56 ActionGeo_Lat, 57 ActionGeo_Long, 60 SOURCEURL, 59 DATEADDED
    const lines = csv.split("\n");
    const out: NormalizedIncident[] = [];
    for (const line of lines) {
      if (!line) continue;
      const cols = line.split("\t");
      if (cols.length < 61) continue;
      const eventId = cols[0];
      const eventCode = cols[26];
      const cls = cameoToType(eventCode);
      if (!cls) continue;
      const lat = parseFloat(cols[56]);
      const lng = parseFloat(cols[57]);
      if (!isFinite(lat) || !isFinite(lng) || (lat === 0 && lng === 0)) continue;
      const fullName = cols[52] || cols[53] || "Unknown location";
      const sourceUrl = cols[60] || null;
      const dateAdded = cols[59]; // YYYYMMDDHHMMSS
      let occurred = new Date().toISOString();
      if (/^\d{14}$/.test(dateAdded)) {
        const d = dateAdded;
        occurred = `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}T${d.slice(8,10)}:${d.slice(10,12)}:${d.slice(12,14)}Z`;
      }
      const country = cols[53] || null; // FIPS country code

      // Title: human-readable label per type + location. URL slugs were misleading
      // (one article triggers many CAMEO events with different types).
      const TYPE_LABELS: Record<IncidentType, string> = {
        war: "Armed conflict", airstrike: "Airstrike", explosion: "Bombing/explosion",
        shooting: "Armed assault", terror: "Mass violence / terror", protest: "Violent protest",
        civil: "Civil unrest", robbery: "Robbery", kidnapping: "Abduction",
        arson: "Arson", cyber: "Cyber attack",
      };
      const title = `${TYPE_LABELS[cls.type]} — ${fullName}`;

      const content_hash = await makeContentHash(`${cls.type}:${fullName}`, lat, lng);
      out.push({
        external_id: `gdelt-evt-${eventId}`,
        title: title.slice(0, 200),
        summary: `Reported event near ${fullName}. Auto-classified from GDELT (CAMEO ${eventCode}).`,
        type: cls.type,
        severity: cls.severity,
        lat,
        lng,
        location: fullName,
        country,
        source: sourceUrl ? new URL(sourceUrl).hostname.replace(/^www\./, "") : "GDELT",
        source_url: sourceUrl,
        occurred_at: occurred,
        content_hash,
      });
    }
    return out;
  } catch (e) {
    console.error("GDELT Events error", e instanceof Error ? e.message : e);
    return [];
  }
}

// Minimal ZIP reader: parse local file header, inflate raw deflate.
async function unzipFirstFile(buf: Uint8Array): Promise<string | null> {
  // Local file header signature: 0x04034b50 (little-endian)
  if (buf.length < 30) return null;
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const sig = view.getUint32(0, true);
  if (sig !== 0x04034b50) return null;
  const compressionMethod = view.getUint16(8, true);
  const compressedSize = view.getUint32(18, true);
  const fileNameLength = view.getUint16(26, true);
  const extraLength = view.getUint16(28, true);
  const dataStart = 30 + fileNameLength + extraLength;
  const compressed = buf.subarray(dataStart, dataStart + compressedSize);
  if (compressionMethod === 0) {
    return new TextDecoder("latin1").decode(compressed);
  }
  if (compressionMethod !== 8) {
    console.error("Unsupported zip compression", compressionMethod);
    return null;
  }
  // Use DecompressionStream("deflate-raw")
  const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  const ab = await new Response(stream).arrayBuffer();
  return new TextDecoder("latin1").decode(new Uint8Array(ab));
}

// =====================================================================
// AI classification for Doc API articles
// =====================================================================
async function classifyBatch(items: { id: string; title: string; snippet: string; country?: string }[]) {
  if (items.length === 0) return [];
  const sys =
    "You classify real-world incident headlines into a strict taxonomy. Return only valid tool calls. " +
    "Allowed types: war, airstrike, explosion, shooting, terror, protest, civil, robbery, kidnapping, arson, cyber. " +
    "Severity scale: low, tension, active, war. Use 'war' only for active armed conflict. " +
    "Reject items that are not actual incidents (opinion pieces, history, anniversaries, retrospectives, sports, entertainment) by setting type to null. " +
    "CRITICAL: 'event_country' MUST be the country where the incident PHYSICALLY OCCURRED (extracted from the headline), NOT the country of the news outlet. " +
    "Use the official English country name matching this list exactly when applicable: United States, Mexico, Canada, United Kingdom, France, Germany, Sweden, Norway, Denmark, Finland, Russia, Ukraine, Poland, Israel, Palestine, Lebanon, Syria, Iraq, Iran, Yemen, Saudi Arabia, Egypt, Turkey, Sudan, South Sudan, Ethiopia, Somalia, Kenya, Nigeria, Mali, Burkina Faso, Niger, Libya, DR Congo, Congo, Cameroon, South Africa, Mozambique, India, Pakistan, Afghanistan, Bangladesh, Sri Lanka, Nepal, China, Japan, South Korea, North Korea, Taiwan, Philippines, Indonesia, Thailand, Vietnam, Myanmar, Malaysia, Australia, New Zealand, Brazil, Argentina, Colombia, Venezuela, Peru, Chile, Ecuador, Bolivia, Haiti, Italy, Spain, Greece, Belgium, Netherlands, Switzerland, Austria, Czech Republic, Hungary, Romania, Bulgaria, Serbia, Bosnia and Herzegovina, Kosovo. " +
    "If the headline does not clearly identify a country of occurrence, set event_country to null and the item will be discarded.";

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
                    location: { type: ["string", "null"], description: "City or specific place" },
                    event_country: { type: ["string", "null"], description: "Country where the event occurred" },
                  },
                  required: ["id", "type", "severity", "short_summary", "event_country"],
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
    const centroid = COUNTRY_CENTROIDS[eventCountry];
    if (!centroid) continue;
    const jitter = () => (Math.random() - 0.5) * 1.5;
    const lat = centroid[0] + jitter();
    const lng = centroid[1] + jitter();
    const occurred = parseSeenDate(c.seendate) ?? new Date().toISOString();
    const content_hash = await makeContentHash(c.title, lat, lng);
    rows.push({
      external_id: c.id,
      title: c.title || "Untitled incident",
      summary: cls.short_summary ?? "",
      type: cls.type,
      severity: cls.severity ?? "tension",
      lat,
      lng,
      location: cls.location ?? eventCountry,
      country: eventCountry,
      source: c.domain ?? "GDELT",
      source_url: c.url ?? null,
      occurred_at: occurred,
      content_hash,
    });
  }

  if (rows.length === 0) return 0;
  const { error } = await supabase.from("incidents").upsert(rows, { onConflict: "content_hash", ignoreDuplicates: true });
  if (error) { console.error("Doc insert failed:", error); return 0; }
  return rows.length;
}

async function processEvents(supabase: any): Promise<number> {
  const events = await fetchGdeltEvents();
  console.log(`GDELT Events parsed: ${events.length}`);
  if (events.length === 0) return 0;

  // Dedup within the batch on content_hash first.
  const seenHash = new Set<string>();
  const inBatchUnique = events.filter((e) => {
    if (seenHash.has(e.content_hash)) return false;
    seenHash.add(e.content_hash);
    return true;
  });
  console.log(`Events unique in batch: ${inBatchUnique.length}`);

  const hashes = inBatchUnique.map((e) => e.content_hash);
  const { data: existing } = await supabase.from("incidents").select("content_hash").in("content_hash", hashes);
  const existingSet = new Set((existing ?? []).map((r: any) => r.content_hash));
  const fresh = inBatchUnique.filter((e) => !existingSet.has(e.content_hash));
  console.log(`Events fresh after DB dedup: ${fresh.length}`);
  if (fresh.length === 0) return 0;

  let inserted = 0;
  for (let i = 0; i < fresh.length; i += 200) {
    const batch = fresh.slice(i, i + 200);
    const { error } = await supabase.from("incidents").upsert(batch, { onConflict: "content_hash", ignoreDuplicates: true });
    if (error) { console.error("Events insert failed:", error); break; }
    inserted += batch.length;
  }
  return inserted;
}

// =====================================================================
// Main handler
// =====================================================================
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  // Run both pipelines in background so we can return quickly.
  const job = (async () => {
    try {
      const [eventsCount, docCount] = await Promise.all([
        processEvents(supabase).catch((e) => { console.error("events pipeline error", e); return 0; }),
        processDocApi(supabase).catch((e) => { console.error("doc pipeline error", e); return 0; }),
      ]);
      console.log(`Ingest complete: events=${eventsCount}, doc=${docCount}`);
    } catch (e) {
      console.error("Background ingest error:", e);
    }
  })();

  // Keep the function alive until the background work finishes.
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
