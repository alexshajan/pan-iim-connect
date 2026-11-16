import { StateWeave } from "@/components/brand/Loom";
import { useEffect, type SVGProps } from "react";
import { initials } from "@/lib/network";
import { cn } from "@/lib/utils";

/* Custom line icons: drawn for this app so they read as part of the paper/pass set. */
export function WaveIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M8 13V6.5a1.5 1.5 0 0 1 3 0V12" />
      <path d="M11 11V4.5a1.5 1.5 0 0 1 3 0V11" />
      <path d="M14 11V5.5a1.5 1.5 0 0 1 3 0V13" />
      <path d="M17 9.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7h-1a6 6 0 0 1-5-2.7L4.3 15a1.6 1.6 0 0 1 2.5-2L8 14" />
      <path d="M3 6c.6-1.4 1.6-2.5 3-3M2 9.5c.3-.8.7-1.4 1.2-2" />
    </svg>
  );
}
export function HandshakeIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M2 11l4-4 3 1 3-2 3 1 3-1 4 4" />
      <path d="M6 7v6l5 5a1.5 1.5 0 0 0 2-2" />
      <path d="M13 16l1 1a1.5 1.5 0 0 0 2-2l-1-1" />
      <path d="M15 14l1 1a1.5 1.5 0 0 0 2-2l-4-4-2 1.5a1.8 1.8 0 0 1-2.4-2.6L12 6" />
      <path d="M18 13V8" />
    </svg>
  );
}
export function StampIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M9 3h6l-1 7h-4z" />
      <path d="M4 14h16v3H4z" />
      <path d="M6 20h12" />
    </svg>
  );
}
export function PineCone(p: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" {...p}>
      <path d="M12 2v3M8 6c2 1 6 1 8 0M7 10c3 1.5 7 1.5 10 0M7.5 14c3 1.5 6 1.5 9 0M9 18c2 1 4 1 6 0" />
      <path d="M12 5c-4 0-6 6-5 11s4 6 5 6 4-1 5-6-1-11-5-11z" />
    </svg>
  );
}

export const buzz = (ms: number | number[] = 18) => {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* unsupported */
  }
};

/** Paper-stub confetti. Pure CSS; hidden under reduced motion. */
export function Stubs({ count = 26 }: { count?: number }) {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[70] overflow-hidden">
      {Array.from({ length: count }, (_, i) => {
        const left = (i * 37) % 100;
        const hue = ["bg-primary", "bg-accent", "bg-secondary", "bg-warn"][i % 4];
        return (
          <span
            key={i}
            className={cn("stub absolute top-0 h-3 w-1.5 rounded-[2px]", hue)}
            style={{
              left: `${left}%`,
              ["--dx" as string]: `${((i * 53) % 80) - 40}px`,
              ["--rot" as string]: `${((i * 97) % 720) - 360}deg`,
              ["--delay" as string]: `${(i * 41) % 400}ms`,
              ["--dur" as string]: `${1300 + ((i * 71) % 900)}ms`,
            }}
          />
        );
      })}
    </div>
  );
}

/** Two visiting cards snapping together: used for mutual waves and handshakes. */
export function MeetMoment({
  open,
  me,
  them,
  title,
  sub,
  onClose,
}: {
  open: boolean;
  me: string;
  them: string;
  title: string;
  sub: string;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    buzz([12, 40, 24]);
    const t = setTimeout(onClose, 4200);
    return () => clearTimeout(t);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-label={title}
      onClick={onClose}
      className="fixed inset-0 z-[60] grid place-items-center bg-background/80 px-6 backdrop-blur-sm animate-in fade-in"
    >
      <Stubs />
      <div className="w-full max-w-xs text-center">
        <div className="relative mx-auto h-36 w-60">
          <MiniCard name={me} className="snap-left absolute top-2 left-0" />
          <MiniCard name={them} className="snap-right absolute top-6 right-0" dark />
          <HandshakeIcon className="pop-in absolute top-[3.6rem] left-1/2 h-9 w-9 -translate-x-1/2 rounded-full bg-card p-1.5 text-primary shadow-md [animation-delay:500ms]" />
        </div>
        <div className="mt-3 flex justify-center"><StateWeave mode="reveal" size={12} /></div>
        <p className="text-display mt-3 text-2xl">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{sub}</p>
        <p className="mt-6 text-[0.65rem] text-muted-foreground">Tap anywhere to continue</p>
      </div>
    </div>
  );
}

function MiniCard({ name, className, dark }: { name: string; className?: string; dark?: boolean }) {
  return (
    <div className={cn("w-32 rounded-xl px-3 py-3 text-left shadow-lg", dark ? "bg-primary text-primary-foreground" : "index-card", className)}>
      <span className={cn("grid h-8 w-8 place-items-center rounded-full text-xs font-bold", dark ? "bg-primary-foreground/15" : "bg-primary text-primary-foreground")}>
        {initials(name)}
      </span>
      <p className="mt-2 truncate text-xs font-semibold">{name}</p>
      <div className={cn("mt-1.5 h-1 w-14 rounded-full", dark ? "bg-primary-foreground/30" : "bg-border")} />
    </div>
  );
}
