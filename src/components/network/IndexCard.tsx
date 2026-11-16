import { Link } from "@tanstack/react-router";
import { Bookmark } from "lucide-react";
import { ribbon } from "@/lib/phase";
import { initials, type DirPerson } from "@/lib/network";

export function IndexCard({ p, shared = [], marked, onMark }: { p: DirPerson; shared?: string[]; marked?: boolean; onMark?: () => void }) {
  const r = ribbon(p.roles);
  const track = p.papers.find((x) => x.track)?.track;
  return (
    <div className="index-card rise relative overflow-hidden">
      <div className="flex items-center justify-between bg-secondary/70 px-4 py-1.5 text-[0.6rem] font-bold text-primary">
        <span>{r.main}{p.is_placeholder ? ", TEST" : ""}</span>
        <span className="truncate pl-2 opacity-70">{track ?? ""}</span>
      </div>
      <Link to="/network/$code" params={{ code: p.code }} className="tap flex gap-3 px-4 pt-3 pb-3.5">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{initials(p.full_name)}</span>
        <span className="min-w-0 flex-1">
          <span className="text-display block truncate text-[1.02rem]">{p.full_name}</span>
          <span className="block truncate text-xs text-muted-foreground">{p.organization ?? ""}</span>
          {p.keywords.length ? (
            <span className="mt-2 flex flex-wrap gap-1">
              {p.keywords.slice(0, 4).map((k) => (
                <span key={k} className={`kw-stamp ${shared.includes(k) ? "bg-primary/10 font-bold" : ""}`}>{k}</span>
              ))}
            </span>
          ) : null}
        </span>
      </Link>
      {onMark ? (
        <button type="button" aria-label={marked ? "Remove bookmark" : "Bookmark"} onClick={onMark} className="tap absolute top-9 right-3 rounded-full p-1.5 text-primary">
          <Bookmark className="h-4 w-4" fill={marked ? "currentColor" : "none"} />
        </button>
      ) : null}
    </div>
  );
}
