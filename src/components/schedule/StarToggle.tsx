import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

const RAYS = [0, 60, 120, 180, 240, 300];

/**
 * Save-to-plan star: springs on press, bursts a ring of sparks when it turns
 * on, and gives a short buzz on phones that support it.
 */
export function StarToggle({ on, onClick, className, size = "md" }: { on: boolean; onClick: () => void; className?: string; size?: "sm" | "md" }) {
  const reduce = useReducedMotion();
  const [burst, setBurst] = useState(0);
  const dim = size === "sm" ? "h-9 w-9" : "h-10 w-10";
  return (
    <motion.button
      type="button"
      aria-label={on ? "Remove from my plan" : "Add to my plan"}
      aria-pressed={on}
      onClick={(e) => {
        e.stopPropagation();
        if (!on) {
          setBurst((b) => b + 1);
          if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(8);
        }
        onClick();
      }}
      whileHover={reduce ? {} : { scale: 1.08 }}
      whileTap={reduce ? {} : { scale: 0.82 }}
      transition={{ type: "spring", stiffness: 500, damping: 22 }}
      className={cn(
        "relative grid shrink-0 place-items-center rounded-full transition-colors duration-200",
        dim,
        on ? "bg-primary/12 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
        className,
      )}
    >
      <AnimatePresence>
        {burst && on && !reduce ? (
          <motion.span key={burst} className="pointer-events-none absolute inset-0" initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ duration: 0.5, delay: 0.15 }}>
            {RAYS.map((deg) => (
              <motion.span
                key={deg}
                className="absolute top-1/2 left-1/2 h-1 w-1 rounded-full bg-loom-gold"
                initial={{ x: "-50%", y: "-50%", scale: 0.4 }}
                animate={{ x: `calc(-50% + ${Math.cos((deg * Math.PI) / 180) * 17}px)`, y: `calc(-50% + ${Math.sin((deg * Math.PI) / 180) * 17}px)`, scale: 1 }}
                transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
              />
            ))}
            <motion.span
              className="absolute inset-1 rounded-full border-2 border-primary/50"
              initial={{ scale: 0.5, opacity: 1 }}
              animate={{ scale: 1.35, opacity: 0 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            />
          </motion.span>
        ) : null}
      </AnimatePresence>
      <motion.span
        key={on ? "on" : "off"}
        initial={reduce ? false : { scale: on ? 0.4 : 1.2, rotate: on ? -40 : 0 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 420, damping: 14 }}
        className="grid place-items-center"
      >
        <Star className={cn("h-[1.1rem] w-[1.1rem]", on && "fill-primary")} />
      </motion.span>
    </motion.button>
  );
}
