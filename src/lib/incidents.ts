// Live incident model — replaces the old static conflicts dataset.

export type Severity = "low" | "tension" | "active" | "war";
export type IncidentType =
  | "war"
  | "airstrike"
  | "explosion"
  | "shooting"
  | "terror"
  | "protest"
  | "civil"
  | "robbery"
  | "kidnapping"
  | "arson"
  | "cyber";

export interface Incident {
  id: string;
  external_id: string;
  title: string;
  summary: string | null;
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

export const ALL_TYPES: IncidentType[] = [
  "war", "airstrike", "explosion", "shooting", "terror",
  "protest", "civil", "robbery", "kidnapping", "arson", "cyber",
];

export const severityMeta: Record<Severity, { label: string; color: string; ring: string; rank: number }> = {
  low: { label: "Low risk", color: "hsl(var(--risk-low))", ring: "bg-risk-low", rank: 1 },
  tension: { label: "Tension", color: "hsl(var(--risk-tension))", ring: "bg-risk-tension", rank: 2 },
  active: { label: "Active conflict", color: "hsl(var(--risk-active))", ring: "bg-risk-active", rank: 3 },
  war: { label: "High-intensity war", color: "hsl(var(--risk-war))", ring: "bg-risk-war", rank: 4 },
};

export const typeMeta: Record<IncidentType, { label: string; icon: string }> = {
  war: { label: "War", icon: "⚔" },
  protest: { label: "Protest", icon: "✊" },
  terror: { label: "Terror attack", icon: "✦" },
  civil: { label: "Civil incident", icon: "▲" },
  cyber: { label: "Cyberattack", icon: "◈" },
  explosion: { label: "Explosion", icon: "✸" },
  shooting: { label: "Shooting", icon: "⊙" },
  robbery: { label: "Robbery", icon: "$" },
  arson: { label: "Arson", icon: "🔥" },
  kidnapping: { label: "Kidnapping", icon: "⚑" },
  airstrike: { label: "Airstrike", icon: "✈" },
};

export function timeAgo(iso: string): string {
  const diff = (Date.now() - +new Date(iso)) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
