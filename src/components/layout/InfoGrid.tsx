import { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type InfoItem = {
  title: string;
  description: string;
  icon: LucideIcon;
};

type InfoGridProps = {
  items: InfoItem[];
  columns?: 2 | 3;
  className?: string;
};

/**
 * The card grid shared by Features, Blog, Case Studies, Support, Documentation,
 * Terms and Privacy.
 *
 * Those seven pages each carried their own copy of the same markup, every one
 * of them hardcoding a different saturated gradient (`from-lime-500/40`,
 * `from-pink-500/40`, …) that ignored the theme and washed out body text in
 * dark mode. They also referenced `animate-pop-in`, an animation that was never
 * defined in the Tailwind config, so the staggered `animationDelay` they set
 * did nothing at all.
 */
export function InfoGrid({ items, columns = 3, className }: InfoGridProps) {
  return (
    <div
      className={cn(
        "mx-auto mt-12 grid max-w-6xl gap-6",
        columns === 2 ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3",
        className
      )}
    >
      {items.map((item, index) => (
        <Card
          key={item.title}
          style={{ animationDelay: `${index * 70}ms` }}
          className="group animate-fade-in flex flex-col p-7 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 transition-transform duration-300 group-hover:scale-110">
            <item.icon className="h-5 w-5 text-primary" aria-hidden="true" />
          </div>
          <h2 className="mt-5 font-display text-lg font-semibold leading-snug">{item.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
        </Card>
      ))}
    </div>
  );
}
