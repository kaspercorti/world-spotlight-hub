import { Radio } from "lucide-react";
import { timeAgo } from "@/lib/incidents";

interface Props {
  totalIncidents: number;
  highSeverityCount: number;
  lastUpdated: Date | null;
}

export function TopBar({ totalIncidents, highSeverityCount, lastUpdated }: Props) {
  return (
    <header
      className="pointer-events-none absolute left-0 right-0 top-0 z-[1000] flex items-start justify-between p-4"
      style={{
        paddingTop: "calc(env(safe-area-inset-top) + 1rem)",
        paddingLeft: "calc(env(safe-area-inset-left) + 1rem)",
        paddingRight: "calc(env(safe-area-inset-right) + 1rem)",
      }}
    >
      <div className="pointer-events-auto flex items-center gap-3 rounded-md border border-border bg-card/80 px-4 py-2.5 backdrop-blur-md shadow-panel">
        <div className="relative h-7 w-7">
          <div className="radar-sweep absolute inset-0 rounded-full border border-accent/40" />
          <div className="absolute inset-1.5 rounded-full bg-accent/20" />
          <div className="absolute inset-[10px] rounded-full bg-accent" />
        </div>
        <div className="leading-tight">
          <h1 className="font-mono text-sm font-semibold tracking-wider text-foreground">SENTINEL</h1>
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Live incident tracker</p>
        </div>
      </div>

      <div className="pointer-events-auto hidden items-center gap-2 rounded-md border border-border bg-card/80 px-3 py-2 backdrop-blur-md shadow-panel md:flex">
        <Radio className="h-3.5 w-3.5 animate-pulse text-risk-active" />
        <span className="font-mono text-xs text-muted-foreground">
          <span className="text-foreground">{highSeverityCount}</span> high-severity ·{" "}
          <span className="text-foreground">{totalIncidents}</span> incidents
          {lastUpdated && (
            <> · updated <span className="text-foreground">{timeAgo(lastUpdated.toISOString())}</span></>
          )}
        </span>
      </div>
    </header>
  );
}
