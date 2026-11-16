import { useMemo, useState } from "react";
import { ChevronRight, MapPin, Monitor } from "lucide-react";
import { StarToggle } from "@/components/schedule/StarToggle";
import type { Session } from "@/lib/conference";
import { placeOf, trackAccentClass } from "@/lib/conference";
import { rangeLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

type ModeFilter = "all" | "offline" | "online";

/**
 * Bottom sheet listing every session in one slot. Filter by in-person/online
 * and research area; tap a session to open its details drawer.
 */
export function SlotSheet({
  open,
  onOpenChange,
  slotSessions,
  focusId,
  starred,
  onToggleStar,
  onOpen,
  mineIds,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  slotSessions: Session[];
  focusId?: string | null;
  starred: string[];
  onToggleStar: (id: string) => void;
  onOpen?: (s: Session) => void;
  mineIds?: ReadonlySet<string>;
}) {
  const [mode, setMode] = useState<ModeFilter>("all");
  const [area, setArea] = useState<string | null>(null);
  const first = slotSessions[0];
  const hasOnline = slotSessions.some((s) => s.mode === "online");
  const areas = useMemo(
    () => [...new Set(slotSessions.map((s) => s.area).filter((a): a is string => !!a))].sort(),
    [slotSessions],
  );
  const list = slotSessions
    .filter((s) => mode === "all" || (s.mode ?? "offline") === mode)
    .filter((s) => !area || s.area === area)
    .sort((a, b) => Number(mineIds?.has(b.id) ?? 0) - Number(mineIds?.has(a.id) ?? 0) || (a.mode ?? "").localeCompare(b.mode ?? "") || (a.room ?? a.parallel_track ?? "").localeCompare(b.room ?? b.parallel_track ?? "", undefined, { numeric: true }));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[86dvh] overflow-y-auto overscroll-contain rounded-t-xl border-0 px-0 pb-10">
        <SheetHeader className="px-5 text-left">
          <SheetTitle className="text-display text-xl">{first ? rangeLabel(first.starts_at, first.ends_at) : "Slot"}</SheetTitle>
          <p className="text-sm text-muted-foreground">
            {slotSessions.length} sessions at the same time. Tap one to see its papers.
          </p>
        </SheetHeader>

        {hasOnline ? (
          <div className="mx-5 mt-3 flex rounded-full bg-muted p-1" role="group" aria-label="In person or online">
            {(["all", "offline", "online"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cn("min-h-9 flex-1 rounded-full text-xs font-semibold", mode === m ? "bg-card shadow-sm" : "text-muted-foreground")}
              >
                {m === "all" ? "All" : m === "offline" ? "In person" : "Online"}
              </button>
            ))}
          </div>
        ) : null}
        {areas.length > 1 ? (
          <div className="mt-2.5 flex gap-1.5 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
            <Chip on={!area} onClick={() => setArea(null)}>All areas</Chip>
            {areas.map((a) => (
              <Chip key={a} on={area === a} onClick={() => setArea(area === a ? null : a)}>{a}</Chip>
            ))}
          </div>
        ) : null}

        <ul className="mt-3 space-y-1.5 px-5">
          {list.map((s) => {
            const mine = mineIds?.has(s.id);
            const on = starred.includes(s.id);
            return (
              <li
                key={s.id}
                className={cn(
                  "relative flex items-stretch overflow-hidden rounded-lg border bg-card",
                  mine ? "border-primary bg-primary/[0.07]" : "border-border",
                  s.id === focusId && !mine && "ring-1 ring-primary/50",
                )}
              >
                <button type="button" onClick={() => onOpen?.(s)} className="press flex min-w-0 flex-1 items-start gap-2.5 py-2.5 pr-1 pl-3 text-left">
                  <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", trackAccentClass[s.tracks?.accent ?? ""] ?? "bg-primary/60")} />
                  <span className="min-w-0 flex-1">
                    {mine ? <span className="block text-[0.6rem] font-bold text-primary">Your session</span> : null}
                    <span className="block text-[0.9rem] leading-snug font-semibold">{s.title}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                        {s.mode === "online" ? <Monitor className="h-3 w-3" /> : <MapPin className="h-3 w-3" />}
                        {placeOf(s)}
                      </span>
                      {s.area ? <span className="truncate">{s.area}</span> : null}
                      {s.papers?.length ? <span>{s.papers.length} papers</span> : null}
                    </span>
                  </span>
                  <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
                <div className="grid w-12 shrink-0 place-items-center border-l border-dashed border-seam">
                  <StarToggle on={on} onClick={() => onToggleStar(s.id)} size="sm" />
                </div>
              </li>
            );
          })}
          {!list.length ? <li className="py-6 text-center text-sm text-muted-foreground">No sessions match these filters.</li> : null}
        </ul>
      </SheetContent>
    </Sheet>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap",
        on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground",
      )}
    >
      {children}
    </button>
  );
}
