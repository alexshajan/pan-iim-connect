import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/** Small woven lozenge used as the toast mark — colour carries the meaning. */
const Mark = ({ tone }: { tone: "ok" | "err" | "info" | "warn" }) => (
  <svg viewBox="0 0 16 16" className={`toast-mark toast-mark-${tone}`} aria-hidden>
    <path d="M8 1.5 14.5 8 8 14.5 1.5 8Z" fill="currentColor" />
    <path d="M8 5 11 8 8 11 5 8Z" fill="var(--plate)" />
  </svg>
);

const Toaster = ({ ...props }: ToasterProps) => (
  <Sonner
    className="toaster group"
    position="top-center"
    gap={8}
    offset={{ top: "calc(env(safe-area-inset-top) + 12px)" }}
    mobileOffset={{ top: "calc(env(safe-area-inset-top) + 10px)" }}
    icons={{ success: <Mark tone="ok" />, error: <Mark tone="err" />, info: <Mark tone="info" />, warning: <Mark tone="warn" /> }}
    toastOptions={{
      unstyled: true,
      classNames: {
        toast: "app-toast",
        title: "app-toast-title",
        description: "app-toast-desc",
        icon: "app-toast-icon",
        actionButton: "app-toast-action",
        cancelButton: "app-toast-cancel",
        error: "app-toast-error",
      },
    }}
    {...props}
  />
);

export { Toaster };
