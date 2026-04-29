import { severityMeta } from "@/lib/conflict-utils";
import type { Severity } from "@/data/conflicts";

const ORDER: Severity[] = ["low", "tension", "active", "war"];

export function Legend() {
  return (
    <div className="pointer-events-auto absolute right-4 top-20 z-[1000] hidden rounded-md border border-border bg-card/85 p-3 backdrop-blur-md shadow-panel md:block">
      <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Severity</div>
      <ul className="space-y-1.5">
        {ORDER.map((s) => (
          <li key={s} className="flex items-center gap-2 text-xs">
            <span
              className={`h-2.5 w-2.5 rounded-full ${severityMeta[s].ring}`}
              style={{ boxShadow: `0 0 8px ${severityMeta[s].color}` }}
            />
            <span className="text-foreground/90">{severityMeta[s].label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
