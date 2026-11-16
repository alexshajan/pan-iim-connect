import type { Featured } from "@/lib/featured";
import { Link } from "@tanstack/react-router";
import { guestSlug } from "@/lib/featured";
import { cn } from "@/lib/utils";

const initials = (n: string) =>
  n.replace(/\b(padma shri|padma shree|prof|dr|shri|smt|ms|mr|mrs)\.?\s*/gi, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");

/** Topic + guest line-up for keynotes and panels, set like engraved name plates. */
export function FeaturedGuests({ f, className }: { f: Featured; className?: string }) {
  if (!f.topic && !f.guests.length) return null;
  return (
    <section className={cn("featured-plate", f.kind === "keynote" ? "featured-keynote" : "featured-panel", className)}>
      {f.topic ? (
        <>
          <p className="text-[0.6rem] font-bold opacity-70">{f.kind === "keynote" ? "Talk" : "Topic"}</p>
          <p className="text-display mt-0.5 text-[1.05rem] leading-snug">{f.topic}</p>
        </>
      ) : null}
      {f.guests.length ? (
        <>
          <p className={cn("text-[0.6rem] font-bold opacity-70", f.topic && "mt-3")}>{f.kind === "keynote" ? "Speaker" : `On the panel, ${f.guests.length}`}</p>
          <ul className="mt-1.5 space-y-1.5">
            {f.guests.map((g) => (
              <li key={g.name}>
                <Link to="/guest/$slug" params={{ slug: guestSlug(g.name) }} className="guest-plate press-tile flex items-center gap-3 px-2.5 py-2">
                <span aria-hidden className="guest-seal grid h-9 w-9 shrink-0 place-items-center rounded-full text-[0.72rem] font-bold">{initials(g.name)}</span>
                <span className="min-w-0">
                  <span className="block text-sm leading-tight font-semibold">{g.name}</span>
                  {g.role ? <span className="mt-0.5 block text-xs leading-snug opacity-75">{g.role}</span> : null}
                </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
