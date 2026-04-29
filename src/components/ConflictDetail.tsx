import { X, MapPin, AlertTriangle, Clock, ExternalLink } from "lucide-react";
import { severityMeta, typeMeta, timeAgo, type Incident } from "@/lib/incidents";
import { cn } from "@/lib/utils";

export function ConflictDetail({
  incident,
  onClose,
}: {
  incident: Incident;
  onClose: () => void;
}) {
  const sev = severityMeta[incident.severity];
  const type = typeMeta[incident.type];

  return (
    <aside className="pointer-events-auto absolute right-0 top-0 z-[1001] flex h-full w-full max-w-md flex-col border-l border-border bg-gradient-panel backdrop-blur-xl shadow-panel animate-slide-in-right">
      <div className="flex items-start justify-between gap-3 border-b border-border p-5">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2">
            <span
              className={cn("inline-block h-2 w-2 rounded-full", sev.ring)}
              style={{ boxShadow: `0 0 12px ${sev.color}` }}
            />
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {type.label} · {sev.label}
            </span>
          </div>
          <h2 className="text-xl font-semibold leading-tight">{incident.title}</h2>
          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" />
            <span>
              {incident.location ?? incident.country ?? "Unknown location"}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{timeAgo(incident.occurred_at)} · {incident.source ?? "Unknown source"}</span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-md border border-border bg-secondary/40 p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <Section title="Event details">
          <p className="text-sm leading-relaxed text-foreground/90">
            {incident.summary || "No summary available."}
          </p>
        </Section>

        {incident.source_url && (
          <Section title="Source" icon={<ExternalLink className="h-3 w-3" />}>
            <a
              href={incident.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all text-xs text-primary hover:underline"
            >
              {incident.source_url}
            </a>
          </Section>
        )}

        <div className="m-5 mt-2 rounded-md border border-border bg-secondary/30 p-3">
          <div className="mb-1 flex items-center gap-1.5 text-risk-tension">
            <AlertTriangle className="h-3 w-3" />
            <span className="font-mono text-[10px] uppercase tracking-widest">Disclaimer</span>
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Information is aggregated from open sources (GDELT) and AI-classified. Verify with primary sources before acting.
          </p>
        </div>
      </div>
    </aside>
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
