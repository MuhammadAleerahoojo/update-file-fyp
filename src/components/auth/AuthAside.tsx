import { Check, Quote } from "lucide-react";

type AuthAsideProps = {
  eyebrow: string;
  heading?: string;
  quote?: string;
  attribution?: string;
  role?: string;
  bullets?: string[];
};

/**
 * The decorative half of the login/signup split.
 *
 * Replaces the two hero images that were hotlinked from Unsplash — they were
 * render-blocking on a slow connection, unreadable behind `mix-blend-overlay`,
 * and broke entirely offline.
 */
export function AuthAside({
  eyebrow,
  heading,
  quote,
  attribution,
  role,
  bullets,
}: AuthAsideProps) {
  return (
    <aside className="hidden lg:block" aria-label={eyebrow}>
      <div className="scan-frame relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-card to-secondary/10 p-10">
        <div className="scan-corner-tl" />
        <span className="data-chip">{eyebrow}</span>

        {heading && (
          <h2 className="mt-3 font-display text-2xl font-semibold leading-snug tracking-tight">
            {heading}
          </h2>
        )}

        {quote && (
          <figure className="mt-4">
            <Quote className="h-6 w-6 text-secondary" aria-hidden="true" />
            <blockquote className="mt-3 font-display text-xl font-medium leading-snug">
              {quote}
            </blockquote>
            {attribution && (
              <figcaption className="mt-4 text-sm">
                <span className="font-medium">{attribution}</span>
                {role && <span className="text-muted-foreground"> · {role}</span>}
              </figcaption>
            )}
          </figure>
        )}

        {bullets && (
          <ul className="mt-6 space-y-3">
            {bullets.map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15">
                  <Check className="h-3 w-3 text-primary" />
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
