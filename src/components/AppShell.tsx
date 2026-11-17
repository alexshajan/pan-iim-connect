import { useAlertNotifier } from "@/hooks/useAlertNotifier";
import { Link, useLocation, useRouter } from "@tanstack/react-router";
import { ChevronLeft, CalendarDays, Compass, Lock, MapPinned, UserRound } from "lucide-react";

/** "Home": a gabled house with the loom lozenge as its window. */
function HomeIcon({ className, strokeWidth = 2 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" className={className} aria-hidden>
      <path d="M3.5 10.6 12 3.5l8.5 7.1V19a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19Z" />
      <path d="M12 11.2 14.4 13.6 12 16 9.6 13.6Z" fill="currentColor" stroke="none" />
    </svg>
  );
}
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useModules } from "@/hooks/useModules";
import { useAuth, useIsOrganizer } from "@/hooks/useAuth";
import { BrandBar, Lozenge } from "@/components/brand/Loom";
import { UpdatesBell } from "@/components/NotificationCenter";
import { pathAllowed, type ModuleKey } from "@/lib/modules";

const tabs: { to: "/" | "/calendar" | "/campus" | "/guide" | "/me"; label: string; icon: typeof HomeIcon | typeof CalendarDays; exact: boolean; module?: ModuleKey }[] = [
  { to: "/", label: "Home", icon: HomeIcon, exact: true },
  { to: "/calendar", label: "Calendar", icon: CalendarDays, exact: false },
  { to: "/campus", label: "Campus", icon: MapPinned, exact: false, module: "campus" },
  { to: "/guide", label: "Guide", icon: Compass, exact: false, module: "guide" },
  { to: "/me", label: "Me", icon: UserRound, exact: false },
];

export function AppShell({
  children,
  title,
  eyebrow,
  hero,
  wide = false,
  centered = false,
}: {
  children: ReactNode;
  title?: string;
  eyebrow?: string;
  /** Full-bleed hero rendered instead of the standard page header. */
  hero?: ReactNode;
  /** Use a wider column on computers (sign-in, two-panel pages). */
  wide?: boolean;
  /** Centre the page title. */
  centered?: boolean;
}) {
  const flags = useModules();
  const { user } = useAuth();
  const isOrganizer = useIsOrganizer(user?.id ?? null) === true;
  const { pathname } = useLocation();
  const allowed = pathAllowed(pathname, flags, isOrganizer);
  useAlertNotifier();
  void eyebrow;
  const isTabRoot = tabs.some((t) => t.to === pathname);
  const back = isTabRoot ? null : <BackButton />;
  const right = <><DesktopNav />{flags.updates ? <UpdatesBell /> : null}</>;
  return (
    <div className="min-h-screen bg-background pb-32 md:pb-16">
      {!allowed ? <BrandBar left={back} right={right} /> : hero ?? (
        <>
          <BrandBar left={back} right={right} />
          {title ? (
            <header className={cn("mx-auto px-5 pt-5", wide ? "max-w-5xl" : "max-w-2xl", centered && "text-center")}>
              <h1 className="text-display text-[1.9rem] leading-[1.05]">{title}</h1>
            </header>
          ) : null}
        </>
      )}

      <main className={cn("mx-auto px-5 pt-5", wide ? "max-w-5xl" : "max-w-2xl")}>
        {allowed ? children : <ComingSoon />}
      </main>
    </div>
  );
}

/** Back to the previous screen, or Home when opened from a link. */
function BackButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      aria-label="Back"
      onClick={() => (window.history.length > 1 ? router.history.back() : router.navigate({ to: "/" }))}
      className="press -ml-2 grid size-10 place-items-center rounded-full text-foreground"
    >
      <ChevronLeft className="h-5 w-5" />
    </button>
  );
}

/** Computer navigation: the phone dock's pressed-key tray, carried up into the logo bar. */
export function DesktopNav() {
  const flags = useModules();
  const { user } = useAuth();
  const isOrganizer = useIsOrganizer(user?.id ?? null) === true;
  const { pathname } = useLocation();
  const list = tabs.filter((t) => !t.module || flags[t.module] || isOrganizer);
  return (
    <nav aria-label="Main" className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 md:block">
      <Tray list={list} pathname={pathname} top />
    </nav>
  );
}

/** Guest bottom bar. Lives in the root so it stays put while pages load. */
export function GuestDock() {
  const flags = useModules();
  const { user } = useAuth();
  const isOrganizer = useIsOrganizer(user?.id ?? null) === true;
  const { pathname } = useLocation();
  const hidden = /^\/(console|admin|auth|onboarding|programme|c\/|id\/)/.test(pathname);
  if (hidden) return null;
  const visibleTabs = tabs.filter((t) => !t.module || flags[t.module] || isOrganizer);
  return <TabDock tabs={visibleTabs} pathname={pathname} />;
}

type Tab = (typeof tabs)[number];

function TabDock({ tabs: list, pathname }: { tabs: Tab[]; pathname: string }) {
  return (
    <nav aria-label="Main" className="pointer-events-none fixed inset-x-0 bottom-0 z-40 md:hidden px-3 pb-[max(0.6rem,env(safe-area-inset-bottom))]">
      <Tray list={list} pathname={pathname} />
    </nav>
  );
}

function Tray({ list, pathname, top = false }: { list: Tab[]; pathname: string; top?: boolean }) {
  const trayRef = useRef<HTMLDivElement>(null);
  const [key, setKey] = useState<{ x: number; w: number } | null>(null);
  const activeIndex = list.findIndex((t) => (t.exact ? pathname === t.to : pathname === t.to || pathname.startsWith(`${t.to}/`)));
  useLayoutEffect(() => {
    const tray = trayRef.current;
    if (!tray) return;
    const measure = () => {
      const el = tray.querySelectorAll<HTMLElement>("[data-tab]")[activeIndex];
      setKey(el ? { x: el.offsetLeft, w: el.offsetWidth } : null);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(tray);
    return () => ro.disconnect();
  }, [activeIndex, list.length]);
  return (
      <div ref={trayRef} className={cn("tabdock pointer-events-auto mx-auto flex items-stretch", top ? "is-top" : list.length <= 3 ? "max-w-[20rem]" : "max-w-[28rem]")}>
        {key ? <span aria-hidden className="tabdock-key" style={{ width: key.w, transform: `translateX(${key.x}px)` }} /> : null}
        {list.map(({ to, label, icon: Icon, exact }) => (
          <Link key={to} to={to} data-tab activeOptions={{ exact }} className="tabdock-btn" aria-label={label}>
            <Icon className="h-[1.3rem] w-[1.3rem]" strokeWidth={2} />
            <span className="tabdock-label">{label}</span>
          </Link>
        ))}
      </div>
  );
}

export function SectionHeading({
  title,
  action,
  className,
}: {
  title: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mt-6 mb-3 flex items-baseline justify-between gap-3", className)}>
      <h2 className="flex items-center gap-2 text-[0.72rem] font-semibold text-primary">
        <Lozenge />
        {title}
      </h2>
      {action}
    </div>
  );
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <p className="card-flat px-5 py-7 text-center text-sm text-muted-foreground">{children}</p>
  );
}

export function PillTag({
  children,
  tone = "muted",
  className,
}: {
  children: ReactNode;
  tone?: "muted" | "primary" | "live" | "warn" | "destructive";
  className?: string;
}) {
  const tones = {
    muted: "bg-secondary text-secondary-foreground",
    primary: "bg-primary text-primary-foreground",
    live: "bg-live text-live-foreground",
    warn: "bg-warn text-warn-foreground",
    destructive: "bg-destructive text-destructive-foreground",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.68rem] font-semibold",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function FilterChip({
  children,
  active,
  onClick,
}: {
  children: ReactNode;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "tap shrink-0 rounded-full px-4 py-2 text-xs font-semibold whitespace-nowrap transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-surface-muted text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

export function Marquee({ items }: { items: string[] }) {
  const loop = [...items, ...items];
  return (
    <div className="no-scrollbar overflow-hidden bg-primary py-2.5 text-primary-foreground">
      <div className="marquee-track">
        {loop.map((item, i) => (
          <span
            key={`${item}-${i}`}
            className="flex items-center gap-6 pr-6 text-[0.72rem] font-semibold whitespace-nowrap"
          >
            {item}
            <span aria-hidden className="opacity-50">
              •
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

function ComingSoon() {
  return (
    <div className="card-surface mt-16 px-6 py-10 text-center">
      <Lock className="mx-auto h-5 w-5 text-primary" />
      <h1 className="text-display mt-3 text-xl">Opening soon</h1>
      <p className="mt-2 text-sm text-muted-foreground">This part of the app isn&apos;t open yet. Your calendar and pass are ready.</p>
      <Link to="/calendar" className="tap mt-5 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">Open Calendar</Link>
    </div>
  );
}
