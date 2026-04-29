import { useMemo, useState } from "react";
import { ConflictMap } from "@/components/ConflictMap";
import { TopBar } from "@/components/TopBar";
import { FiltersPanel, type TimeRange } from "@/components/FiltersPanel";
import { ConflictDetail } from "@/components/ConflictDetail";
import { LiveFeed } from "@/components/LiveFeed";
import { Legend } from "@/components/Legend";
import { conflicts as ALL, type ConflictType, type Severity } from "@/data/conflicts";
import { severityMeta } from "@/lib/conflict-utils";

const ALL_TYPES: ConflictType[] = ["war", "airstrike", "explosion", "shooting", "terror", "protest", "civil", "robbery", "kidnapping", "arson", "cyber"];

const Index = () => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [types, setTypes] = useState<Set<ConflictType>>(new Set(ALL_TYPES));
  const [minSeverity, setMinSeverity] = useState<Severity>("low");
  const [timeRange, setTimeRange] = useState<TimeRange>("7d");

  const handleSelect = (id: string, incidentId?: string) => {
    setSelectedId(id);
    setSelectedIncidentId(incidentId ?? null);
  };

  const cutoff = useMemo(() => {
    if (timeRange === "all") return 0;
    const days = timeRange === "24h" ? 1 : timeRange === "7d" ? 7 : 30;
    return Date.now() - days * 86400 * 1000;
  }, [timeRange]);

  const filtered = useMemo(() => {
    return ALL.filter((c) => {
      // Match if conflict type OR any incident type is selected
      const typeMatch = types.has(c.type) || c.recent.some((r) => types.has(r.type));
      if (!typeMatch) return false;
      if (severityMeta[c.severity].rank < severityMeta[minSeverity].rank) return false;
      if (timeRange === "all") return true;
      // Strict: must have an incident within the window, or have started within it
      const hasRecent = c.recent.some((r) => +new Date(r.timestamp) >= cutoff);
      const startedInWindow = +new Date(c.startedAt) >= cutoff;
      return hasRecent || startedInWindow;
    });
  }, [types, minSeverity, timeRange, cutoff]);

  const selected = filtered.find((c) => c.id === selectedId) ?? ALL.find((c) => c.id === selectedId) ?? null;
  const totalIncidents = filtered.reduce((s, c) => s + c.incidents24h, 0);
  const activeCount = filtered.filter((c) => c.severity === "active" || c.severity === "war").length;

  const toggleType = (t: ConflictType) =>
    setTypes((prev) => {
      const next = new Set(prev);
      next.has(t) ? next.delete(t) : next.add(t);
      return next.size === 0 ? new Set(ALL_TYPES) : next;
    });

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-background">
      <ConflictMap conflicts={filtered} activeTypes={types} incidentCutoff={cutoff} selectedId={selectedId} onSelect={handleSelect} />

      <TopBar activeCount={activeCount} totalIncidents={totalIncidents} />
      <Legend />
      <LiveFeed onSelect={(id) => handleSelect(id)} />

      <FiltersPanel
        types={types}
        onToggleType={toggleType}
        minSeverity={minSeverity}
        onSeverity={setMinSeverity}
        timeRange={timeRange}
        onTimeRange={setTimeRange}
      />

      {selected && (
        <ConflictDetail
          conflict={selected}
          highlightIncidentId={selectedIncidentId}
          onClose={() => {
            setSelectedId(null);
            setSelectedIncidentId(null);
          }}
        />
      )}
    </main>
  );
};

export default Index;
