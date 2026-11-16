import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { ArrowLeft, Printer } from "lucide-react";
import { placeOf, sessionsQuery, type Session } from "@/lib/conference";
import { dayKey, timeOf } from "@/lib/format";
import { conferenceDays, groupIntoSlots } from "@/lib/schedule";
import { CardSkeleton } from "@/components/PageSkeleton";

export const Route = createFileRoute("/programme")({
  head: () => ({
    meta: [
      { title: "Programme at a glance, 11th Pan-IIM WMC 2026" },
      { name: "description", content: "A printable three-day overview of the 11th Pan-IIM WMC at IIM Shillong, 27–29 November 2026, with venues." },
      { property: "og:title", content: "Programme at a glance, Pan-IIM WMC 2026" },
      { property: "og:description", content: "Three days on one sheet: keynotes, panels, paper blocks and venues." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(sessionsQuery);
  },
  component: ProgrammePage,
});

type Line = { start: string; end: string; title: string; place: string; kind: string };

/** Paper sessions collapse into one line per block; everything else is listed. */
function linesFor(day: Session[]): Line[] {
  const out: Line[] = [];
  for (const slot of groupIntoSlots(day)) {
    const papers = slot.sessions.filter((s) => s.session_type === "paper");
    const rest = slot.sessions.filter((s) => s.session_type !== "paper");
    for (const s of rest) out.push({ start: s.starts_at, end: s.ends_at, title: s.title, place: placeOf(s), kind: s.session_type });
    if (papers.length) {
      const inPerson = papers.filter((s) => s.mode !== "online");
      const online = papers.length - inPerson.length;
      const rooms = [...new Set(inPerson.map((s) => s.room).filter(Boolean))].sort((a, b) => a!.localeCompare(b!, undefined, { numeric: true }));
      const start = papers.reduce((m, s) => (s.starts_at < m ? s.starts_at : m), papers[0]!.starts_at);
      const end = papers.reduce((m, s) => (s.ends_at > m ? s.ends_at : m), papers[0]!.ends_at);
      const parts = [inPerson.length ? `${inPerson.length} in person` : "", online ? `${online} online` : ""].filter(Boolean).join(", ");
      out.push({
        start,
        end,
        title: `Parallel paper sessions (${parts})`,
        place: rooms.length ? `Rooms ${rooms.join(", ")}` : online ? "Online" : "Paper rooms",
        kind: "paper",
      });
    }
  }
  return out.sort((a, b) => a.start.localeCompare(b.start));
}

function ProgrammePage() {
  const { data, isPending } = useQuery(sessionsQuery);
  const all = useMemo(() => data ?? [], [data]);
  const days = useMemo(() => conferenceDays(all), [all]);

  return (
    <main className="mx-auto max-w-3xl bg-background px-5 py-6 text-foreground print:max-w-none print:px-0 print:py-0">
      <div className="mb-5 flex items-center justify-between print:hidden">
        <Link to="/calendar" className="tap inline-flex items-center gap-1.5 text-sm font-semibold">
          <ArrowLeft className="h-4 w-4" /> Calendar
        </Link>
        <button type="button" onClick={() => window.print()} className="press inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">
          <Printer className="h-4 w-4" /> Save as PDF
        </button>
      </div>
      <header className="border-b-2 border-foreground pb-3">
        <p className="text-xs font-bold text-primary">11th Pan-IIM WMC</p>
        <h1 className="text-display mt-1 text-2xl">Programme at a glance</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">IIM Shillong, 27–29 November 2026, times in IST, subject to change</p>
      </header>
      {isPending ? <CardSkeleton rows={6} /> : null}
      {days.map((d, i) => {
        const lines = linesFor(all.filter((s) => dayKey(s.starts_at) === d.key));
        return (
          <section key={d.key} className="mt-5 break-inside-avoid-page print:mt-4">
            <h2 className="text-display text-lg">
              Day {i + 1}, {new Date(d.iso).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" })}
            </h2>
            <table className="mt-2 w-full border-collapse text-sm">
              <tbody>
                {lines.map((l, j) => (
                  <tr key={j} className={l.kind === "paper" ? "bg-primary/[0.07]" : ""}>
                    <td className="w-[7.5rem] border-b border-border py-1.5 pr-3 align-top whitespace-nowrap tabular-nums">
                      {timeOf(l.start)}–{timeOf(l.end)}
                    </td>
                    <td className={`border-b border-border py-1.5 pr-3 align-top ${l.kind === "break" || l.kind === "meal" ? "text-muted-foreground" : "font-medium"}`}>{l.title}</td>
                    <td className="w-[11rem] border-b border-border py-1.5 align-top text-muted-foreground">{l.place}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      })}
      <p className="mt-6 text-xs text-muted-foreground">Your own paper slot and room are in the app under Calendar → My presentation slot.</p>
    </main>
  );
}
