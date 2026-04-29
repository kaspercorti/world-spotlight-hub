import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import type { Conflict, ConflictType, Severity } from "@/data/conflicts";
import { severityMeta } from "@/lib/conflict-utils";

interface Props {
  conflicts: Conflict[];
  selectedId: string | null;
  onSelect: (id: string, incidentId?: string) => void;
}

// SVG glyph per conflict type
const typeGlyph: Record<ConflictType, string> = {
  // Explosion / war (starburst)
  war: `<path d="M12 2 L13.6 8.5 L20 5.5 L16.5 11.5 L22 13 L15.5 14.5 L18 21 L12 16.5 L6 21 L8.5 14.5 L2 13 L7.5 11.5 L4 5.5 L10.4 8.5 Z" fill="white"/>`,
  // Protest (megaphone)
  protest: `<path d="M4 10v4h3l8 4V6L7 10H4z" fill="white"/><path d="M17 8c1.5 1.2 1.5 6.8 0 8" stroke="white" stroke-width="1.6" fill="none" stroke-linecap="round"/>`,
  // Terror (triangle warning)
  terror: `<path d="M12 3 L22 20 H2 Z" fill="white"/><rect x="11" y="9" width="2" height="6" fill="black"/><rect x="11" y="16" width="2" height="2" fill="black"/>`,
  // Civil unrest (people)
  civil: `<circle cx="8" cy="8" r="3" fill="white"/><circle cx="16" cy="8" r="3" fill="white"/><path d="M2 20c0-3 3-5 6-5s6 2 6 5" fill="white"/><path d="M12 20c0-3 3-5 6-5s6 2 6 5" fill="white" opacity="0.85"/>`,
  // Cyber (lightning bolt)
  cyber: `<path d="M13 2 L4 14 H11 L9 22 L20 9 H13 Z" fill="white"/>`,
  // Explosion (bold burst)
  explosion: `<path d="M12 2 L14 9 L21 7 L17 13 L22 17 L15 17 L14 22 L12 17 L10 22 L9 17 L2 17 L7 13 L3 7 L10 9 Z" fill="white"/>`,
  // Shooting (crosshair / target)
  shooting: `<circle cx="12" cy="12" r="8" stroke="white" stroke-width="2" fill="none"/><circle cx="12" cy="12" r="2" fill="white"/><path d="M12 2 V6 M12 18 V22 M2 12 H6 M18 12 H22" stroke="white" stroke-width="2"/>`,
  // Robbery (money bag)
  robbery: `<path d="M8 4 H16 L14 8 H10 Z" fill="white"/><path d="M6 10 C6 8 8 8 12 8 S18 8 18 10 L19 20 H5 Z" fill="white"/><text x="12" y="18" text-anchor="middle" font-size="8" font-weight="bold" fill="black">$</text>`,
  // Arson (flame)
  arson: `<path d="M12 2 C13 6 17 8 17 13 a5 5 0 0 1 -10 0 C7 9 11 8 12 2 Z" fill="white"/>`,
  // Kidnapping (person + arrow)
  kidnapping: `<circle cx="10" cy="6" r="3" fill="white"/><path d="M5 21 C5 15 8 13 10 13 C12 13 15 15 15 21 Z" fill="white"/><path d="M16 10 L22 10 M19 7 L22 10 L19 13" stroke="white" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  // Airstrike (plane + bomb)
  airstrike: `<path d="M2 13 L10 11 L14 4 L16 4 L14 11 L22 13 L22 15 L14 14 L12 21 L10 21 L11 14 L2 15 Z" fill="white"/>`,
};

const typeLabel: Record<ConflictType, string> = {
  war: "Krig / sprängning",
  protest: "Demonstration",
  terror: "Terror",
  civil: "Civila oroligheter",
  cyber: "Cyberattack",
  explosion: "Sprängning",
  shooting: "Skjutning",
  robbery: "Rån",
  arson: "Mordbrand",
  kidnapping: "Kidnappning",
  airstrike: "Flyganfall",
};

function makeIcon(type: ConflictType, severity: Severity, opts?: { small?: boolean }) {
  const color = severityMeta[severity].color;
  const intense = severity === "war" || severity === "active";
  const glyph = typeGlyph[type];
  const base = opts?.small ? 24 : intense ? 36 : 30;
  const size = base;

  const html = `
    <div class="conflict-marker" style="width:${size}px;height:${size}px;position:relative;">
      ${intense && !opts?.small ? `<div class="pulse" style="background:${color};opacity:.45;width:100%;height:100%;border-radius:50%;position:absolute;inset:0;"></div>` : ""}
      <div style="
        position:absolute;inset:0;
        background:${color};
        border-radius:50%;
        display:flex;align-items:center;justify-content:center;
        box-shadow:0 0 0 2px rgba(0,0,0,0.55), 0 0 12px ${color};
        border:1.5px solid rgba(255,255,255,0.85);
      ">
        <svg viewBox="0 0 24 24" width="${Math.round(size * 0.6)}" height="${Math.round(size * 0.6)}" xmlns="http://www.w3.org/2000/svg">
          ${glyph}
        </svg>
      </div>
    </div>`;
  return L.divIcon({
    html,
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function FlyTo({ conflict }: { conflict: Conflict | null }) {
  const map = useMap();
  useEffect(() => {
    if (conflict) {
      map.flyTo([conflict.lat, conflict.lng], Math.max(map.getZoom(), 5), { duration: 0.9 });
    }
  }, [conflict, map]);
  return null;
}

function InvalidateOnResize() {
  const map = useMap();
  useEffect(() => {
    const invalidate = () => map.invalidateSize();
    const timers = [50, 200, 500, 1000].map((d) => window.setTimeout(invalidate, d));
    window.addEventListener("resize", invalidate);
    window.addEventListener("orientationchange", invalidate);
    const ro = new ResizeObserver(invalidate);
    ro.observe(map.getContainer());
    return () => {
      timers.forEach(clearTimeout);
      window.removeEventListener("resize", invalidate);
      window.removeEventListener("orientationchange", invalidate);
      ro.disconnect();
    };
  }, [map]);
  return null;
}

export function ConflictMap({ conflicts, selectedId, onSelect }: Props) {
  const selected = conflicts.find((c) => c.id === selectedId) ?? null;

  // Build per-incident markers (deterministic small offset for those without explicit coords)
  const incidentMarkers = useMemo(() => {
    const items: { key: string; incidentId: string; lat: number; lng: number; type: ConflictType; severity: Severity; conflictId: string; title: string }[] = [];
    for (const c of conflicts) {
      for (let i = 0; i < c.recent.length; i++) {
        const ev = c.recent[i];
        let lat = ev.lat;
        let lng = ev.lng;
        if (lat == null || lng == null) {
          const angle = (i / Math.max(c.recent.length, 1)) * Math.PI * 2;
          const r = 0.9;
          lat = c.lat + Math.sin(angle) * r;
          lng = c.lng + Math.cos(angle) * r;
        }
        items.push({
          key: `${c.id}-${ev.id}`,
          incidentId: ev.id,
          lat,
          lng,
          type: ev.type,
          severity: c.severity,
          conflictId: c.id,
          title: `${ev.title} — ${typeLabel[ev.type]}`,
        });
      }
    }
    return items;
  }, [conflicts]);

  return (
    <div className="absolute inset-0 bg-background">
      <MapContainer
        center={[25, 15]}
        zoom={3}
        minZoom={2}
        maxZoom={18}
        worldCopyJump
        zoomControl={true}
        attributionControl={true}
        className="h-full w-full"
        style={{ background: "hsl(220 25% 6%)" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          subdomains={["a", "b", "c", "d"]}
          maxZoom={19}
        />
        {/* Conflict hub markers */}
        {conflicts.map((c) => (
          <Marker
            key={c.id}
            position={[c.lat, c.lng]}
            icon={makeIcon(c.type, c.severity)}
            title={`${c.name} — ${typeLabel[c.type]}`}
            eventHandlers={{ click: () => onSelect(c.id) }}
          />
        ))}
        {/* Per-incident markers (smaller, exact location, type-specific icon) */}
        {incidentMarkers.map((m) => (
          <Marker
            key={m.key}
            position={[m.lat, m.lng]}
            icon={makeIcon(m.type, m.severity, { small: true })}
            title={m.title}
            eventHandlers={{ click: () => onSelect(m.conflictId, m.incidentId) }}
          />
        ))}
        <FlyTo conflict={selected} />
        <InvalidateOnResize />
      </MapContainer>
      <div className="pointer-events-none absolute inset-0 bg-gradient-radar" />
    </div>
  );
}
