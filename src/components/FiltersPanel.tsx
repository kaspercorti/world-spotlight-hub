import { useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import type { ConflictType, Severity } from "@/data/conflicts";
import { typeMeta, severityMeta } from "@/lib/conflict-utils";
import { cn } from "@/lib/utils";

export type TimeRange = "24h" | "7d" | "30d" | "all";

interface Props {
  types: Set<ConflictType>;
  onToggleType: (t: ConflictType) => void;
  minSeverity: Severity;
  onSeverity: (s: Severity) => void;
  timeRange: TimeRange;
  onTimeRange: (t: TimeRange) => void;
}

const TIME: { key: TimeRange; label: string }[] = [
  { key: "24h", label: "24h" },
  { key: "7d", label: "7d" },
  { key: "30d", label: "30d" },
  { key: "all", label: "All" },
];

const SEV: Severity[] = ["low", "tension", "active", "war"];
const TYPES: ConflictType[] = ["war", "protest", "terror", "civil", "cyber"];

export function FiltersPanel(props: Props) {
  const [openMobile, setOpenMobile] = useState(false);
  return (
    <>
      {/* Mobile FAB toggle */}
      <button
        onClick={() => setOpenMobile((v) => !v)}
        className="pointer-events-auto absolute bottom-4 right-4 z-[1001] grid h-11 w-11 place-items-center rounded-full border border-border bg-card/90 backdrop-blur-md text-foreground shadow-panel md:hidden"
        aria-label="Toggle filters"
      >
        {openMobile ? <X className="h-4 w-4" /> : <SlidersHorizontal className="h-4 w-4" />}
      </button>

      <div
        className={cn(
          "pointer-events-auto absolute bottom-4 left-1/2 z-[1000] w-[min(720px,calc(100vw-2rem))] -translate-x-1/2 rounded-lg border border-border bg-card/85 p-3 backdrop-blur-md shadow-panel animate-fade-in",
          !openMobile && "hidden md:block"
        )}
      >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        {/* Type filters */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Type</span>
          {TYPES.map((t) => {
            const active = props.types.has(t);
            return (
              <button
                key={t}
                onClick={() => props.onToggleType(t)}
                className={cn(
                  "rounded-md border px-2.5 py-1 font-mono text-[11px] transition-[var(--transition-smooth)]",
                  active
                    ? "border-primary/60 bg-primary/15 text-primary"
                    : "border-border bg-secondary/50 text-muted-foreground hover:text-foreground hover:border-primary/30"
                )}
              >
                <span className="mr-1">{typeMeta[t].icon}</span>
                {typeMeta[t].label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Severity threshold */}
          <div className="flex items-center gap-1.5">
            <span className="mr-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Min</span>
            {SEV.map((s) => {
              const active = severityMeta[s].rank >= severityMeta[props.minSeverity].rank;
              const isCurrent = s === props.minSeverity;
              return (
                <button
                  key={s}
                  onClick={() => props.onSeverity(s)}
                  title={severityMeta[s].label}
                  className={cn(
                    "h-5 w-5 rounded-full border transition-[var(--transition-smooth)]",
                    severityMeta[s].ring,
                    active ? "opacity-100" : "opacity-30",
                    isCurrent ? "ring-2 ring-offset-2 ring-offset-card ring-foreground/60 scale-110" : "border-transparent"
                  )}
                />
              );
            })}
          </div>

          {/* Time range */}
          <div className="flex items-center gap-1 rounded-md border border-border bg-secondary/40 p-0.5">
            {TIME.map((t) => (
              <button
                key={t.key}
                onClick={() => props.onTimeRange(t.key)}
                className={cn(
                  "rounded px-2.5 py-1 font-mono text-[11px] transition-[var(--transition-smooth)]",
                  props.timeRange === t.key
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
  );
}
