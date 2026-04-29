// Ingests real-world incidents from GDELT and classifies them via Lovable AI.
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
}

// --- GDELT fetch ---------------------------------------------------------
// Doc API: https://api.gdeltproject.org/api/v2/doc/doc
// We use ArtList output with geo info. Query targets violent / civil-unrest events.
async function fetchGdelt(): Promise<any[]> {
  // GDELT Doc API requires short queries. We fetch multiple narrow queries and merge.
  const queries = [
    '(shooting OR bombing OR explosion)',
    '(airstrike OR "air strike" OR missile)',
    '(protest OR riot OR unrest)',
    '(kidnapping OR hostage OR abduction)',
    '(arson OR "set on fire")',
  ];
  const all: any[] = [];
  for (const q of queries) {
    const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(q + ' sourcelang:eng')}&mode=ArtList&format=json&maxrecords=25&sort=DateDesc&timespan=24H`;
    try {
      const res = await fetch(url, { headers: { "User-Agent": "lovable-conflict-map/1.0" } });
      if (!res.ok) {
        console.error("GDELT fetch failed", q, res.status);
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }
      const text = await res.text();
      try {
        const data = JSON.parse(text);
        if (data.articles) all.push(...data.articles);
      } catch {
        console.error("GDELT non-JSON for query", q, ":", text.slice(0, 120));
      }
    } catch (e) {
      console.error("GDELT request error", q, e);
    }
    // Throttle to avoid 429
    await new Promise((r) => setTimeout(r, 1500));
  }
  // Dedup by url
  const seen = new Set<string>();
  return all.filter((a) => {
    if (!a.url || seen.has(a.url)) return false;
    seen.add(a.url);
    return true;
  });
}


// Parse GDELT seendate ("YYYYMMDDTHHMMSSZ") to ISO
function parseSeenDate(s: string): string | null {
  const m = s?.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`;
}

// --- AI classification ---------------------------------------------------
async function classifyBatch(items: { id: string; title: string; snippet: string; country?: string }[]) {
  if (items.length === 0) return [];

  const sys =
    "You classify real-world incident headlines into a strict taxonomy. Return only valid tool calls. " +
    "Allowed types: war, airstrike, explosion, shooting, terror, protest, civil, robbery, kidnapping, arson, cyber. " +
    "Severity scale: low, tension, active, war. Use 'war' only for active armed conflict. " +
    "Reject items that are not actual incidents (opinion pieces, history, anniversaries, sports, entertainment) by setting type to null.";

  const user = JSON.stringify(items);

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
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
                    type: {
                      type: ["string", "null"],
                      enum: [...ALLOWED_TYPES, null],
                    },
                    severity: {
                      type: "string",
                      enum: ["low", "tension", "active", "war"],
                    },
                    short_summary: { type: "string" },
                    location: { type: ["string", "null"] },
                  },
                  required: ["id", "type", "severity", "short_summary"],
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

  if (!resp.ok) {
    const txt = await resp.text();
    console.error("AI classify failed", resp.status, txt);
    return [];
  }

  const data = await resp.json();
  const call = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!call) return [];
  try {
    const args = JSON.parse(call.function.arguments);
    return args.results ?? [];
  } catch (e) {
    console.error("Failed to parse AI args", e);
    return [];
  }
}

// --- Main handler --------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    const articles = await fetchGdelt();
    console.log(`GDELT returned ${articles.length} articles`);

    // Pre-filter: must have lat/lng-able location info.
    // GDELT ArtList includes "domain", "title", "url", "seendate", "socialimage", "sourcecountry".
    // It does NOT always include coordinates per article. We use the article and country for AI to validate;
    // when missing coords we fall back to country centroid below.
    const country_centroids: Record<string, [number, number]> = {
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

    // Build candidate list for AI
    const candidates = articles.slice(0, 60).map((a: any, i: number) => ({
      id: `gdelt-${a.url ? btoa(a.url).slice(0, 24) : i}`,
      title: (a.title ?? "").slice(0, 240),
      snippet: (a.title ?? "").slice(0, 240),
      country: a.sourcecountry,
      url: a.url,
      seendate: a.seendate,
      domain: a.domain,
    }));

    // Dedup by external_id against DB to skip already-ingested
    const ids = candidates.map((c) => c.id);
    const { data: existing } = await supabase
      .from("incidents")
      .select("external_id")
      .in("external_id", ids);
    const existingSet = new Set((existing ?? []).map((r) => r.external_id));
    const fresh = candidates.filter((c) => !existingSet.has(c.id));
    console.log(`Fresh candidates after dedup: ${fresh.length}`);

    if (fresh.length === 0) {
      return new Response(JSON.stringify({ ingested: 0, message: "no fresh items" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Classify in chunks of 20
    const classified: any[] = [];
    for (let i = 0; i < fresh.length; i += 20) {
      const chunk = fresh.slice(i, i + 20).map((c) => ({
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

      const centroid = c.country ? country_centroids[c.country] : undefined;
      if (!centroid) continue; // skip if we cannot geolocate
      // Add small jitter so multiple incidents in same country don't all sit on identical point
      const jitter = () => (Math.random() - 0.5) * 1.5;
      const lat = centroid[0] + jitter();
      const lng = centroid[1] + jitter();

      const occurred = parseSeenDate(c.seendate) ?? new Date().toISOString();

      rows.push({
        external_id: c.id,
        title: c.title || "Untitled incident",
        summary: cls.short_summary ?? "",
        type: cls.type,
        severity: cls.severity ?? "tension",
        lat,
        lng,
        location: cls.location ?? c.country ?? null,
        country: c.country ?? null,
        source: c.domain ?? "GDELT",
        source_url: c.url ?? null,
        occurred_at: occurred,
      });
    }

    if (rows.length > 0) {
      const { error } = await supabase
        .from("incidents")
        .upsert(rows, { onConflict: "external_id", ignoreDuplicates: true });
      if (error) {
        console.error("Insert failed:", error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(
      JSON.stringify({ ingested: rows.length, fetched: articles.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("ingest error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
