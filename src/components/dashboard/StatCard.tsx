import { LucideIcon } from "lucide-react";
import { ReactNode } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type StatCardProps = {
  title: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
  trend?: { value: number; isPositive: boolean };
  children?: ReactNode;
};

export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  children,
}: StatCardProps) {
  return (
    <Card className="group relative overflow-hidden p-5 transition-all duration-300 hover:border-primary/30 hover:shadow-md">
      {/* Quiet tint that surfaces on hover — enough to signal the card is a
          live surface without decorating the number itself. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/[0.04] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      />

      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <p className="truncate text-sm font-medium text-muted-foreground">{title}</p>
          <p className="font-display text-3xl font-semibold leading-none tracking-tight">
            {value}
          </p>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>

        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 transition-transform duration-300 group-hover:scale-105">
          <Icon className="h-[18px] w-[18px] text-primary" aria-hidden="true" />
        </span>
      </div>

      {trend && (
        <div className="relative mt-3 flex items-center gap-1.5 text-xs">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-medium",
              trend.isPositive
                ? "bg-success/10 text-success"
                : "bg-destructive/10 text-destructive"
            )}
          >
            {trend.isPositive ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            {trend.value}%
          </span>
          <span className="text-muted-foreground">vs last month</span>
        </div>
      )}

      {children}
    </Card>
  );
}
