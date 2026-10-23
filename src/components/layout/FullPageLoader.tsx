import { ScanLine } from "lucide-react";

/**
 * The single loading state used for route transitions and auth checks, so a
 * slow network looks intentional instead of like a broken page.
 */
export function FullPageLoader({ label = "Loading…" }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-screen flex-col items-center justify-center gap-5 bg-background"
    >
      <div className="relative flex h-16 w-16 items-center justify-center">
        <span className="absolute inset-0 rounded-2xl border border-border" />
        <span className="absolute inset-0 animate-ping rounded-2xl bg-primary/10" />
        <ScanLine className="relative h-7 w-7 text-primary" />
      </div>
      <p className="data-chip">{label}</p>
    </div>
  );
}
