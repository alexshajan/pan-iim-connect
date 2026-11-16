import { LoomLoader } from "@/components/brand/Loom";

/** Shown while a page's code or data is on its way. Matches the card layout. */
export function PageSkeleton() {
  return (
    <div className="mx-auto max-w-2xl px-5 pt-8" aria-busy="true" aria-label="Loading">
      <LoomLoader className="mb-6" />
      <div className="skeleton h-8 w-48 rounded-xl" />
      <div className="mt-6 space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-20 rounded-[var(--radius)]" style={{ animationDelay: `${i * 80}ms` }} />
        ))}
      </div>
    </div>
  );
}

export function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton h-16 rounded-[var(--radius)]" style={{ animationDelay: `${i * 80}ms` }} />
      ))}
    </div>
  );
}
