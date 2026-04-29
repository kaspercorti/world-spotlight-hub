import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import type { Conflict, ConflictType, Severity } from "@/data/conflicts";
import { severityMeta } from "@/lib/conflict-utils";

interface Props {
  conflicts: Conflict[];
  selectedId: string | null;
  activeTypes?: Set<ConflictType>;
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

type RawMarker = {
  key: string;
  incidentId?: string;
  conflictId: string;
  lat: number;
  lng: number;
  type: ConflictType;
  severity: Severity;
  title: string;
  isHub: boolean;
};

// Spreads markers that overlap in screen-space into a small ring around the cluster center.
function SpreadMarkers({
  markers,
  onSelect,
}: {
  markers: RawMarker[];
  onSelect: (conflictId: string, incidentId?: string) => void;
}) {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());

  useMapEvents({
    zoomend: () => setZoom(map.getZoom()),
    moveend: () => setZoom(map.getZoom()),
  });

  const positioned = useMemo(() => {
    // Pixel threshold for "same place" — bigger when zoomed out
    const threshold = 38;
    type P = RawMarker & { px: number; py: number };
    const pts: P[] = markers.map((m) => {
      const p = map.project([m.lat, m.lng], zoom);
      return { ...m, px: p.x, py: p.y };
    });

    // Greedy clustering by pixel distance
    const clusters: P[][] = [];
    const used = new Array(pts.length).fill(false);
    for (let i = 0; i < pts.length; i++) {
      if (used[i]) continue;
      const cluster: P[] = [pts[i]];
      used[i] = true;
      for (let j = i + 1; j < pts.length; j++) {
        if (used[j]) continue;
        const dx = pts[i].px - pts[j].px;
        const dy = pts[i].py - pts[j].py;
        if (Math.sqrt(dx * dx + dy * dy) < threshold) {
          cluster.push(pts[j]);
          used[j] = true;
        }
      }
      clusters.push(cluster);
    }

    const out: { marker: RawMarker; lat: number; lng: number }[] = [];
    for (const cluster of clusters) {
      if (cluster.length === 1) {
        const m = cluster[0];
        out.push({ marker: m, lat: m.lat, lng: m.lng });
        continue;
      }
      // Center of the cluster in pixel space
      const cx = cluster.reduce((s, p) => s + p.px, 0) / cluster.length;
      const cy = cluster.reduce((s, p) => s + p.py, 0) / cluster.length;
      // Tight ring: just enough to separate icons (~22-26px in size)
      const iconSize = 26;
      const circumference = cluster.length * (iconSize + 2);
      const radius = Math.min(28, Math.max(iconSize * 0.7, circumference / (2 * Math.PI)));
      // Stable sort: hubs first, then by id so order is deterministic
      const sorted = [...cluster].sort((a, b) => {
        if (a.isHub !== b.isHub) return a.isHub ? -1 : 1;
        return a.key.localeCompare(b.key);
      });
      for (let i = 0; i < sorted.length; i++) {
        const angle = (i / sorted.length) * Math.PI * 2 - Math.PI / 2;
        const px = cx + Math.cos(angle) * radius;
        const py = cy + Math.sin(angle) * radius;
        const ll = map.unproject([px, py], zoom);
        out.push({ marker: sorted[i], lat: ll.lat, lng: ll.lng });
      }
    }
    return out;
  }, [markers, map, zoom]);

  return (
    <>
      {positioned.map(({ marker, lat, lng }) => (
        <Marker
          key={marker.key}
          position={[lat, lng]}
          icon={makeIcon(marker.type, marker.severity, { small: !marker.isHub })}
          title={marker.title}
          eventHandlers={{ click: () => onSelect(marker.conflictId, marker.incidentId) }}
        />
      ))}
    </>
  );
}

export function ConflictMap({ conflicts, selectedId, activeTypes, onSelect }: Props) {
  const selected = conflicts.find((c) => c.id === selectedId) ?? null;
  const typeAllowed = (t: ConflictType) => !activeTypes || activeTypes.has(t);

  // Build a unified marker list (hubs + incidents) that the spreader can lay out.
  const allMarkers = useMemo<RawMarker[]>(() => {
    const items: RawMarker[] = [];
    for (const c of conflicts) {
      if (typeAllowed(c.type)) {
        items.push({
          key: `hub-${c.id}`,
          conflictId: c.id,
          lat: c.lat,
          lng: c.lng,
          type: c.type,
          severity: c.severity,
          title: `${c.name} — ${typeLabel[c.type]}`,
          isHub: true,
        });
      }
      for (let i = 0; i < c.recent.length; i++) {
        const ev = c.recent[i];
        if (!typeAllowed(ev.type)) continue;
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
          conflictId: c.id,
          lat,
          lng,
          type: ev.type,
          severity: c.severity,
          title: `${ev.title} — ${typeLabel[ev.type]}`,
          isHub: false,
        });
      }
    }
    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conflicts, activeTypes]);

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
        <SpreadMarkers markers={allMarkers} onSelect={onSelect} />
        <FlyTo conflict={selected} />
        <InvalidateOnResize />
      </MapContainer>
      <div className="pointer-events-none absolute inset-0 bg-gradient-radar" />
    </div>
  );
}
