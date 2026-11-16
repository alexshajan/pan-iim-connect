import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

/**
 * IIM Shillong × Meghalaya Tourism lockup. The partner logo slot shows a
 * wordmark until the official artwork is uploaded.
 */
export function CoBrand() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-[0.7rem] font-semibold tracking-wide">IIM Shillong</span>
      <span aria-hidden className="text-muted-foreground">×</span>
      <span className="rounded-full bg-hills px-2.5 py-1 text-[0.66rem] font-semibold tracking-wide text-hills-foreground">
        Meghalaya Tourism
      </span>
    </div>
  );
}

export function GuideSubHeader({ title, eyebrow, children }: { title: string; eyebrow: string; children?: ReactNode }) {
  return (
    <header className="mx-auto max-w-2xl px-5 pt-6">
      <div className="flex items-center justify-between">
        <Link to="/guide" className="tap inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground">
          <ArrowLeft className="size-3.5" /> Guide
        </Link>
        <CoBrand />
      </div>
      <p className="mt-6 text-[0.68rem] font-semibold text-hills">{eyebrow}</p>
      <h1 className="text-display mt-1 text-[2rem] leading-[1.05]">{title}</h1>
      {children}
    </header>
  );
}
