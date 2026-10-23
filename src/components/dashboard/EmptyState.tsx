import { Link } from "react-router-dom";
import { LucideIcon, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: { label: string; to: string } | { label: string; onClick: () => void };
  className?: string;
};

/**
 * Consistent empty state.
 *
 * Every list screen previously rendered its own bare `<p>No reports found.</p>`
 * or a centred div, so the app looked broken rather than simply empty.
 */
export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-border",
        "bg-muted/30 px-6 py-14 text-center",
        className
      )}
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-background shadow-sm">
        <Icon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
      </span>
      <h3 className="mt-4 font-display text-base font-semibold">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
      {action && (
        <div className="mt-5">
          {"to" in action ? (
            <Button asChild size="sm">
              <Link to={action.to}>{action.label}</Link>
            </Button>
          ) : (
            <Button size="sm" onClick={action.onClick}>
              {action.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
