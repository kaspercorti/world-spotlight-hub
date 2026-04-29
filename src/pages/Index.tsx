import { useMemo, useState } from "react";
import { ConflictMap } from "@/components/ConflictMap";
import { TopBar } from "@/components/TopBar";
import { FiltersPanel, type TimeRange } from "@/components/FiltersPanel";
import { ConflictDetail } from "@/components/ConflictDetail";
import { LiveFeed } from "@/components/LiveFeed";
import { Legend } from "@/components/Legend";
import { conflicts as ALL, type ConflictType, type Severity } from "@/data/conflicts";
import { severityMeta } from "@/lib/conflict-utils";

const ALL_TYPES: ConflictType[] = ["war", "protest", "terror", "civil", "cyber"];

const Index = () => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [types, setTypes] = useState<Set<ConflictType>>(new Set(ALL_TYPES));
  const [minSeverity, setMinSeverity] = useState<Severity>("low");
  const [timeRange, setTimeRange] = useState<TimeRange>("7d");

  const filtered = useMemo(() => {
    const cutoff = (() => {
      const days = timeRange === "24h" ? 1 : timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 36500;
      return Date.now() - days * 86400 * 1000;
    })();
    return ALL.filter((c) => {
      if (!types.has(c.type)) return false;
      if (severityMeta[c.severity].rank < severityMeta[minSeverity].rank) return false;
      const recentEnough = c.recent.some((r) => +new Date(r.timestamp) >= cutoff) || +new Date(c.startedAt) >= cutoff || timeRange === "all" || c.incidents24h > 0;
      return recentEnough;
    });
  }, [types, minSeverity, timeRange]);

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
      <ConflictMap conflicts={filtered} selectedId={selectedId} onSelect={setSelectedId} />

      <TopBar activeCount={activeCount} totalIncidents={totalIncidents} />
      <Legend />
      <LiveFeed onSelect={setSelectedId} />

      <FiltersPanel
        types={types}
        onToggleType={toggleType}
        minSeverity={minSeverity}
        onSeverity={setMinSeverity}
        timeRange={timeRange}
        onTimeRange={setTimeRange}
      />

      {selected && <ConflictDetail conflict={selected} onClose={() => setSelectedId(null)} />}
    </main>
  );
};

export default Index;
