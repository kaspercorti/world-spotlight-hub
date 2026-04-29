import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import type { Conflict } from "@/data/conflicts";
import { severityMeta } from "@/lib/conflict-utils";

interface Props {
  conflicts: Conflict[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function makeIcon(conflict: Conflict) {
  const color = severityMeta[conflict.severity].color;
  const intense = conflict.severity === "war" || conflict.severity === "active";
  const html = `
    <div class="conflict-marker" style="width:14px;height:14px;">
      ${intense ? `<div class="pulse" style="background:${color};opacity:.5"></div>` : ""}
      <div class="dot" style="background:${color}"></div>
    </div>`;
  return L.divIcon({
    html,
    className: "",
    iconSize: [14, 14],
    iconAnchor: [7, 7],
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
        preferCanvas
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a> &copy; OpenStreetMap'
          url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
        />
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png"
          opacity={0.7}
        />
        {conflicts.map((c) => (
          <Marker
            key={c.id}
            position={[c.lat, c.lng]}
            icon={makeIcon(c)}
            eventHandlers={{ click: () => onSelect(c.id) }}
          />
        ))}
        <FlyTo conflict={selected} />
      </MapContainer>
      {/* Subtle radial overlay for depth */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-radar" />
    </div>
  );
}
