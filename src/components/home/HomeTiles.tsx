import { Link } from "@tanstack/react-router";

type Kind = "calendar" | "pass" | "papers" | "key" | "trip";
export type Tile = { to: string; title: string; kind: Kind };

/** Get-ready tiles: each one carries a small physical object instead of an icon. */
export function HomeTiles({ tiles }: { tiles: Tile[] }) {
  return (
    <div className="grid grid-cols-1 gap-2.5 min-[420px]:grid-cols-2 lg:grid-cols-4">
      {tiles.map((t, i) => (
        <Link key={t.to} to={t.to} className="obj-tile rise group" style={{ animationDelay: `${i * 70}ms` }}>
          <span className="obj-stage" aria-hidden>{art(t.kind)}</span>
          <span className="text-display relative block px-4 pb-3.5 text-[0.98rem] leading-snug">{t.title}</span>
        </Link>
      ))}
    </div>
  );
}

function art(kind: Kind) {
  switch (kind) {
    case "calendar":
      return (
        <span className="obj-cal">
          <span className="obj-cal-page p3" />
          <span className="obj-cal-page p2" />
          <span className="obj-cal-page p1">
            <span className="obj-cal-ring" />
            <span className="obj-cal-mo">NOV</span>
            <span className="obj-cal-day">27</span>
          </span>
        </span>
      );
    case "pass":
      return (
        <span className="obj-pass">
          <span className="obj-pass-strap" />
          <span className="obj-pass-card">
            <span className="obj-pass-band" />
            <span className="obj-pass-line w1" />
            <span className="obj-pass-line w2" />
          </span>
        </span>
      );
    case "papers":
      return (
        <span className="obj-papers">
          <span className="obj-sheet s3" />
          <span className="obj-sheet s2" />
          <span className="obj-sheet s1"><span className="obj-sheet-lines" /></span>
        </span>
      );
    case "key":
      return (
        <span className="obj-key">
          <span className="obj-key-ring" />
          <span className="obj-key-tag"><span>204</span></span>
        </span>
      );
    case "trip":
      return (
        <span className="obj-trip">
          <span className="obj-trip-ticket"><span className="obj-trip-stub" />GAU → SHL</span>
        </span>
      );
  }
}
