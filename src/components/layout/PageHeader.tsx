type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
};

/** Consistent hero block for every public content page. */
export function PageHeader({ eyebrow, title, description }: PageHeaderProps) {
  return (
    <header className="mx-auto max-w-3xl text-center">
      {eyebrow && <span className="data-chip">{eyebrow}</span>}
      <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
        {title}
      </h1>
      {description && (
        <p className="mt-4 text-pretty text-lg leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
    </header>
  );
}
