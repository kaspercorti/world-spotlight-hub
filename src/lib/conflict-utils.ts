import type { Severity, Verification, ConflictType } from "@/data/conflicts";

export const severityMeta: Record<Severity, { label: string; color: string; ring: string; rank: number }> = {
  low: { label: "Low risk", color: "hsl(var(--risk-low))", ring: "bg-risk-low", rank: 1 },
  tension: { label: "Tension", color: "hsl(var(--risk-tension))", ring: "bg-risk-tension", rank: 2 },
  active: { label: "Active conflict", color: "hsl(var(--risk-active))", ring: "bg-risk-active", rank: 3 },
  war: { label: "High-intensity war", color: "hsl(var(--risk-war))", ring: "bg-risk-war", rank: 4 },
};

export const verificationMeta: Record<Verification, { label: string; className: string }> = {
  verified: { label: "Verified", className: "text-verified border-verified/40 bg-verified/10" },
  partial: { label: "Partial", className: "text-partial border-partial/40 bg-partial/10" },
  unverified: { label: "Unverified", className: "text-unverified border-unverified/40 bg-unverified/10" },
};

export const typeMeta: Record<ConflictType, { label: string; icon: string }> = {
  war: { label: "War", icon: "⚔" },
  protest: { label: "Protest", icon: "✊" },
  terror: { label: "Terror attack", icon: "✦" },
  civil: { label: "Civil incident", icon: "▲" },
  cyber: { label: "Cyberattack", icon: "◈" },
};

export function timeAgo(iso: string): string {
  const diff = (Date.now() - +new Date(iso)) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
