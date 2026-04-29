import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Incident, IncidentType, Severity } from "@/lib/incidents";

export function useIncidents(hoursWindow: number) {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async () => {
    const cutoff = new Date(Date.now() - hoursWindow * 3600 * 1000).toISOString();
    const { data, error } = await supabase
      .from("incidents")
      .select("*")
      .gte("occurred_at", cutoff)
      .order("occurred_at", { ascending: false })
      .limit(1000);
    if (!error && data) {
      setIncidents(data as unknown as Incident[]);
      setLastUpdated(new Date());
    }
    setLoading(false);
  }, [hoursWindow]);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime — auto-refresh when new incidents land
  useEffect(() => {
    const channel = supabase
      .channel("incidents-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "incidents" },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  // Periodic re-fetch every 60s as a safety net
  useEffect(() => {
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  return { incidents, loading, lastUpdated, refresh: load };
}

export type { Incident, IncidentType, Severity };
