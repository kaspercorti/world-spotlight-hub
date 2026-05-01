import { useEffect, useState } from "react";
import { X, MapPin, AlertTriangle, Clock, ExternalLink, Newspaper } from "lucide-react";
import { severityMeta, typeMeta, timeAgo, type Incident } from "@/lib/incidents";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface IncidentSource {
  id: string;
  source_name: string | null;
  source_url: string;
}

export function ConflictDetail({
  incident,
  onClose,
}: {
  incident: Incident;
  onClose: () => void;
}) {
  const sev = severityMeta[incident.severity];
  const type = typeMeta[incident.type];
  const [sources, setSources] = useState<IncidentSource[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("incident_sources")
        .select("id, source_name, source_url")
        .eq("incident_id", incident.id);
      if (data && data.length > 0) {
        setSources(data);
      } else if (incident.source_url) {
        setSources([{ id: "fallback", source_name: incident.source, source_url: incident.source_url }]);
      } else {
        setSources([]);
      }
    })();
  }, [incident.id, incident.source, incident.source_url]);

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
            <span>{timeAgo(incident.occurred_at)} · {sources.length} {sources.length === 1 ? "source" : "sources"}</span>
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

        <Section title="Media coverage" icon={<Newspaper className="h-3 w-3" />}>
          {sources.length === 0 ? (
            <p className="text-xs text-muted-foreground">No sources available.</p>
          ) : (
            <ul className="space-y-2">
              {sources.map((s) => (
                <li key={s.id}>
                  <a
                    href={s.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-start gap-2 rounded-md border border-border bg-secondary/20 p-2.5 transition-colors hover:bg-secondary/40"
                  >
                    <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground group-hover:text-primary">
                        {s.source_name || new URL(s.source_url).hostname.replace(/^www\./, "")}
                      </p>
                      <p className="truncate text-[10px] text-muted-foreground">
                        {s.source_url}
                      </p>
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Section>

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
