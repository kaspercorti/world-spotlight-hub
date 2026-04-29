import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import type { Conflict, ConflictType } from "@/data/conflicts";
import { severityMeta } from "@/lib/conflict-utils";

interface Props {
  conflicts: Conflict[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

// SVG glyph per conflict type
const typeGlyph: Record<ConflictType, string> = {
  // Explosion / war (starburst)
  war: `<path d="M12 2 L13.6 8.5 L20 5.5 L16.5 11.5 L22 13 L15.5 14.5 L18 21 L12 16.5 L6 21 L8.5 14.5 L2 13 L7.5 11.5 L4 5.5 L10.4 8.5 Z" fill="white"/>`,
  // Protest (megaphone)
  protest: `<path d="M4 10v4h3l8 4V6L7 10H4z" fill="white"/><path d="M17 8c1.5 1.2 1.5 6.8 0 8" stroke="white" stroke-width="1.6" fill="none" stroke-linecap="round"/>`,
  // Terror (skull-ish triangle warning)
  terror: `<path d="M12 3 L22 20 H2 Z" fill="white"/><rect x="11" y="9" width="2" height="6" fill="black"/><rect x="11" y="16" width="2" height="2" fill="black"/>`,
  // Civil unrest (people)
  civil: `<circle cx="8" cy="8" r="3" fill="white"/><circle cx="16" cy="8" r="3" fill="white"/><path d="M2 20c0-3 3-5 6-5s6 2 6 5" fill="white"/><path d="M12 20c0-3 3-5 6-5s6 2 6 5" fill="white" opacity="0.85"/>`,
  // Cyber (lightning bolt)
  cyber: `<path d="M13 2 L4 14 H11 L9 22 L20 9 H13 Z" fill="white"/>`,
};

const typeLabel: Record<ConflictType, string> = {
  war: "Krig / sprängning",
  protest: "Demonstration",
  terror: "Terror",
  civil: "Civila oroligheter",
  cyber: "Cyberattack",
};

function makeIcon(conflict: Conflict) {
  const color = severityMeta[conflict.severity].color;
  const intense = conflict.severity === "war" || conflict.severity === "active";
  const glyph = typeGlyph[conflict.type];
  const size = intense ? 36 : 30;

  const html = `
    <div class="conflict-marker" style="width:${size}px;height:${size}px;position:relative;">
      ${intense ? `<div class="pulse" style="background:${color};opacity:.45;width:100%;height:100%;border-radius:50%;position:absolute;inset:0;"></div>` : ""}
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

  return (
    <div className="absolute inset-0">
      <MapContainer
        center={[20, 10]}
        zoom={3}
        minZoom={2}
        maxZoom={10}
        worldCopyJump
        zoomControl={true}
        attributionControl={true}
        className="h-full w-full"
      >
        {/* OpenStreetMap — no API key required, reliable */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        {conflicts.map((c) => (
          <Marker
            key={c.id}
            position={[c.lat, c.lng]}
            icon={makeIcon(c)}
            title={`${c.name} — ${typeLabel[c.type]}`}
            eventHandlers={{ click: () => onSelect(c.id) }}
          />
        ))}
        <FlyTo conflict={selected} />
        <InvalidateOnResize />
      </MapContainer>
      <div className="pointer-events-none absolute inset-0 bg-gradient-radar" />
    </div>
  );
}
