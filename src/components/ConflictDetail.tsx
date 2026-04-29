import { X, MapPin, Users, AlertTriangle, Clock, ExternalLink } from "lucide-react";
import type { Conflict } from "@/data/conflicts";
import { severityMeta, verificationMeta, typeMeta, timeAgo } from "@/lib/conflict-utils";
import { cn } from "@/lib/utils";

export function ConflictDetail({
  conflict,
  highlightIncidentId,
  onClose,
}: {
  conflict: Conflict;
  highlightIncidentId?: string | null;
  onClose: () => void;
}) {
  const sev = severityMeta[conflict.severity];
  const focused = highlightIncidentId
    ? conflict.recent.find((r) => r.id === highlightIncidentId) ?? null
    : null;
  const others = focused ? conflict.recent.filter((r) => r.id !== focused.id) : conflict.recent;

  return (
    <aside className="pointer-events-auto absolute right-0 top-0 z-[1001] flex h-full w-full max-w-md flex-col border-l border-border bg-gradient-panel backdrop-blur-xl shadow-panel animate-slide-in-right">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-border p-5">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2">
            <span
              className={cn("inline-block h-2 w-2 rounded-full", sev.ring)}
              style={{ boxShadow: `0 0 12px ${sev.color}` }}
            />
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {sev.label} · risk {conflict.riskLevel}/10
            </span>
          </div>
          <h2 className="text-xl font-semibold leading-tight">{conflict.name}</h2>
          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" />
            <span>{conflict.country} · {conflict.region}</span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-md border border-border bg-secondary/40 p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-px bg-border">
        <Stat label="Incidents 24h" value={conflict.incidents24h.toString()} />
        <Stat label="Type" value={`${typeMeta[conflict.type].icon} ${typeMeta[conflict.type].label}`} />
        <Stat label="Started" value={new Date(conflict.startedAt).getFullYear().toString()} />
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {/* Summary */}
        <Section title="Summary">
          <p className="text-sm leading-relaxed text-foreground/90">{conflict.summary}</p>
        </Section>

        {/* Actors */}
        <Section title="Actors" icon={<Users className="h-3 w-3" />}>
          <div className="flex flex-wrap gap-1.5">
            {conflict.actors.map((a) => (
              <span key={a} className="rounded border border-border bg-secondary/50 px-2 py-0.5 font-mono text-[11px] text-foreground/80">
                {a}
              </span>
            ))}
          </div>
        </Section>

        {/* Timeline */}
        <Section title={`Recent events`} icon={<Clock className="h-3 w-3" />}>
          {conflict.recent.length === 0 ? (
            <p className="text-xs text-muted-foreground">No recent events recorded.</p>
          ) : (
            <ol className="relative space-y-3 border-l border-border pl-4">
              {conflict.recent.map((ev) => {
                const v = verificationMeta[ev.verification];
                return (
                  <li key={ev.id} className="relative">
                    <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-accent ring-2 ring-background" />
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-sm font-medium leading-snug">{ev.title}</p>
                      <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{timeAgo(ev.timestamp)}</span>
                    </div>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{ev.summary}</p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className={cn("rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider", v.className)}>
                        {v.label}
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground">{ev.source}</span>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </Section>

        {/* Sources */}
        <Section title="Sources" icon={<ExternalLink className="h-3 w-3" />}>
          <div className="flex flex-wrap gap-1.5">
            {conflict.sources.map((s) => (
              <span key={s} className="rounded border border-accent/30 bg-accent/10 px-2 py-0.5 font-mono text-[11px] text-accent">
                {s}
              </span>
            ))}
          </div>
        </Section>

        {/* Disclaimer */}
        <div className="m-5 mt-2 rounded-md border border-border bg-secondary/30 p-3">
          <div className="mb-1 flex items-center gap-1.5 text-risk-tension">
            <AlertTriangle className="h-3 w-3" />
            <span className="font-mono text-[10px] uppercase tracking-widest">Disclaimer</span>
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Information is aggregated from open sources and may evolve. Avoid acting on unverified reports.
          </p>
        </div>
      </div>
    </aside>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card/60 px-3 py-3">
      <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 truncate text-sm font-semibold text-foreground">{value}</div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="border-b border-border p-5">
      <div className="mb-2.5 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {icon}
        {title}
      </div>
      {children}
    </section>
  );
}
