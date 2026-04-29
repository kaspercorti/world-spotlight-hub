import { useMemo, useState } from "react";
import { ConflictMap } from "@/components/ConflictMap";
import { TopBar } from "@/components/TopBar";
import { FiltersPanel, type TimeRange } from "@/components/FiltersPanel";
import { ConflictDetail } from "@/components/ConflictDetail";
import { LiveFeed } from "@/components/LiveFeed";
import { Legend } from "@/components/Legend";
import { ALL_TYPES, severityMeta, type IncidentType, type Severity } from "@/lib/incidents";
import { useIncidents } from "@/hooks/useIncidents";

const Index = () => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [types, setTypes] = useState<Set<IncidentType>>(new Set(ALL_TYPES));
  const [minSeverity, setMinSeverity] = useState<Severity>("low");
  const [timeRange, setTimeRange] = useState<TimeRange>("24h");

  const hours = timeRange === "24h" ? 24 : 48;
  const { incidents, lastUpdated } = useIncidents(hours);

  const filtered = useMemo(() => {
    return incidents.filter((i) => {
      if (!types.has(i.type)) return false;
      if (severityMeta[i.severity].rank < severityMeta[minSeverity].rank) return false;
      return true;
    });
  }, [incidents, types, minSeverity]);

  const selected = filtered.find((i) => i.id === selectedId) ?? incidents.find((i) => i.id === selectedId) ?? null;
  const highSeverityCount = filtered.filter((i) => i.severity === "active" || i.severity === "war").length;

  const toggleType = (t: IncidentType) =>
    setTypes((prev) => {
      const next = new Set(prev);
      next.has(t) ? next.delete(t) : next.add(t);
      return next.size === 0 ? new Set(ALL_TYPES) : next;
    });

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-background">
      <ConflictMap
        incidents={filtered}
        activeTypes={types}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />

      <TopBar
        totalIncidents={filtered.length}
        highSeverityCount={highSeverityCount}
        lastUpdated={lastUpdated}
      />
      <Legend />
      <LiveFeed incidents={filtered} onSelect={setSelectedId} />

      <FiltersPanel
        types={types}
        onToggleType={toggleType}
        minSeverity={minSeverity}
        onSeverity={setMinSeverity}
        timeRange={timeRange}
        onTimeRange={setTimeRange}
      />

      {selected && (
        <ConflictDetail incident={selected} onClose={() => setSelectedId(null)} />
      )}
    </main>
  );
};

export default Index;
