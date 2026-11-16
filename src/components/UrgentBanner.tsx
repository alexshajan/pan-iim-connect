import { openUpdates } from "@/components/NotificationCenter";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { announcementsQuery } from "@/lib/conference";

/** Pinned banner for live urgent alerts (Agenda). */
export function UrgentBanner() {
  const q = useQuery(announcementsQuery);
  const urgent = (q.data ?? []).find((a) => a.urgent && a.audience === "all");
  if (!urgent) return null;
  return (
    <button type="button" onClick={openUpdates} className="mb-4 flex w-full text-left items-start gap-3 rounded-[var(--radius)] border border-destructive/40 bg-destructive/10 px-4 py-3">
      <AlertTriangle className="mt-0.5 size-4 text-destructive" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{urgent.title}</span>
        <span className="block truncate text-xs text-muted-foreground">{urgent.body}</span>
      </span>
    </button>
  );
}
