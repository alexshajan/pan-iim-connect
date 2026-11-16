import { Children, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Horizontal card deck: native scroll-snap swiping, auto-advance every few
 * seconds, paused while touched/hovered/focused, off with reduced motion.
 */
export function SwipeDeck({ children, interval = 6000, label = "Cards" }: { children: React.ReactNode; interval?: number; label?: string }) {
  const items = Children.toArray(children);
  const ref = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);
  const paused = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onScroll = () => setIdx(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (items.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => {
      const el = ref.current;
      if (!el || paused.current || document.hidden) return;
      const next = (Math.round(el.scrollLeft / el.clientWidth) + 1) % items.length;
      el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
    }, interval);
    return () => clearInterval(t);
  }, [items.length, interval]);

  if (!items.length) return null;
  if (items.length === 1) return <>{items[0]}</>;
  const go = (i: number) => ref.current?.scrollTo({ left: i * ref.current.clientWidth, behavior: "smooth" });
  const pause = () => { paused.current = true; };
  const resume = () => { paused.current = false; };
  return (
    <div role="region" aria-roledescription="carousel" aria-label={label}>
      <div
        ref={ref}
        onPointerDown={pause}
        onPointerUp={resume}
        onMouseEnter={pause}
        onMouseLeave={resume}
        onFocus={pause}
        onBlur={resume}
        className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ touchAction: "pan-x pan-y" }}
      >
        {items.map((c, i) => (
          <div key={i} className="w-full shrink-0 snap-center px-0.5" aria-hidden={i !== idx}>
            {c}
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-center gap-1.5">
        {items.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Card ${i + 1} of ${items.length}`}
            onClick={() => go(i)}
            className={cn("h-1.5 rounded-full transition-[width,background-color] duration-200", i === idx ? "w-5 bg-primary" : "w-1.5 bg-border")}
          />
        ))}
      </div>
    </div>
  );
}
