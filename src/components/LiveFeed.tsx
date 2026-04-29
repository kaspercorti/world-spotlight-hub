import { useState } from "react";
import { ChevronLeft, ChevronRight, Activity } from "lucide-react";
import { allIncidents } from "@/data/conflicts";
import { severityMeta, typeMeta, timeAgo, verificationMeta } from "@/lib/conflict-utils";
import { cn } from "@/lib/utils";

interface Props {
  onSelect: (conflictId: string) => void;
}

export function LiveFeed({ onSelect }: Props) {
  const [open, setOpen] = useState(() => typeof window !== "undefined" && window.innerWidth >= 768);
  const [sort, setSort] = useState<"recent" | "severe">("recent");

  const items = [...allIncidents].sort((a, b) => {
    if (sort === "recent") return +new Date(b.timestamp) - +new Date(a.timestamp);
    return severityMeta[b.severity].rank - severityMeta[a.severity].rank;
  });

  return (
    <aside
      className={cn(
        "pointer-events-auto absolute left-0 top-0 z-[1000] flex h-full flex-col transition-[width] duration-300",
        open
          ? "w-[320px] border-r border-border bg-gradient-panel backdrop-blur-xl"
          : "w-0 border-r-0 bg-transparent"
      )}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "absolute top-20 z-10 grid h-7 w-7 place-items-center rounded-full border border-border bg-card/90 backdrop-blur-md text-muted-foreground hover:text-foreground shadow-panel",
          open ? "-right-3.5" : "left-3"
        )}
      >
        {open ? <ChevronLeft className="h-3.5 w-3.5" /> : <Activity className="h-3.5 w-3.5 text-risk-active" />}
      </button>

      {open && (
        <>
          <div className="border-b border-border p-4 pt-20">
            <div className="mb-3 flex items-center gap-2">
              <Activity className="h-3.5 w-3.5 text-risk-active animate-pulse" />
              <h3 className="font-mono text-xs uppercase tracking-widest text-foreground">Live feed</h3>
            </div>
            <div className="flex gap-1 rounded-md border border-border bg-secondary/40 p-0.5">
              {(["recent", "severe"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSort(s)}
                  className={cn(
                    "flex-1 rounded px-2 py-1 font-mono text-[10px] uppercase tracking-wider transition-[var(--transition-smooth)]",
                    sort === s ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {s === "recent" ? "Latest" : "Most severe"}
                </button>
              ))}
            </div>
          </div>

          <ul className="flex-1 overflow-y-auto scrollbar-thin">
            {items.map((it) => {
              const sev = severityMeta[it.severity];
              const v = verificationMeta[it.verification];
              return (
                <li key={it.id}>
                  <button
                    onClick={() => onSelect(it.conflictId)}
                    className="group block w-full border-b border-border/60 px-4 py-3 text-left transition-colors hover:bg-secondary/40"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className={cn("h-2 w-2 shrink-0 rounded-full", sev.ring)}
                          style={{ boxShadow: `0 0 8px ${sev.color}` }}
                        />
                        <span className="truncate font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                          {it.conflictName}
                        </span>
                      </div>
                      <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{timeAgo(it.timestamp)}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm leading-snug text-foreground group-hover:text-primary">
                      {it.title}
                    </p>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <span className="rounded border border-border bg-secondary/50 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                        {typeMeta[it.type].icon} {typeMeta[it.type].label}
                      </span>
                      <span className={cn("rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider", v.className)}>
                        {v.label}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </aside>
  );
}
