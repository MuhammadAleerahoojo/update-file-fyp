import { cn } from "@/lib/utils";

type LogoProps = {
  size?: "sm" | "md";
  className?: string;
  /** Hide the wordmark and show only the mark. */
  markOnly?: boolean;
};

/**
 * The Dr Xora mark. Previously the same gradient circle with a hand-set "X" was
 * pasted into the navbar, the footer and both sidebar variants, each with
 * slightly different sizes and a `text-white` label that vanished against a
 * light gradient.
 */
export function Logo({ size = "md", className, markOnly = false }: LogoProps) {
  const dimensions = size === "sm" ? "h-7 w-7" : "h-8 w-8";

  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <span
        aria-hidden="true"
        className={cn(
          "relative grid shrink-0 place-items-center rounded-lg",
          "bg-gradient-to-br from-primary to-primary/70 shadow-sm ring-1 ring-inset ring-white/10",
          dimensions
        )}
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
          <path
            d="M5 5h3.2l7.6 14H19"
            stroke="hsl(var(--primary-foreground))"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <path
            d="M19 5h-3.2L8.2 19H5"
            stroke="hsl(var(--secondary))"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
      </span>
      {!markOnly && (
        <span
          className={cn(
            "font-display font-semibold tracking-tight",
            size === "sm" ? "text-base" : "text-lg"
          )}
        >
          Dr Xora
        </span>
      )}
    </span>
  );
}
