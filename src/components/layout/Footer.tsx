import { Link } from "react-router-dom";
import { Logo } from "./Logo";

const SECTIONS = [
  {
    heading: "Platform",
    links: [
      { to: "/features", label: "Features" },
      { to: "/about", label: "How it works" },
    ],
  },
  {
    heading: "Resources",
    links: [
      { to: "/documentation", label: "Documentation" },
      { to: "/blog", label: "Blog" },
      { to: "/case-studies", label: "Case studies" },
      { to: "/support", label: "Support" },
    ],
  },
  {
    heading: "Company",
    links: [
      { to: "/contact", label: "Contact" },
      { to: "/privacy", label: "Privacy" },
      { to: "/terms", label: "Terms" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-border bg-muted/30">
      <div className="container grid gap-10 px-4 py-14 md:grid-cols-[1.5fr_repeat(3,1fr)] md:px-6">
        <div className="space-y-3">
          <Logo />
          <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
            AI-assisted X-ray and CT reporting for clinicians and the patients waiting on their
            results.
          </p>
        </div>

        {SECTIONS.map((section) => (
          <div key={section.heading}>
            <h2 className="text-sm font-semibold">{section.heading}</h2>
            <ul className="mt-3 space-y-2.5">
              {section.links.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-border">
        <div className="container flex flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-muted-foreground sm:flex-row md:px-6">
          <p>© {new Date().getFullYear()} Dr Xora. All rights reserved.</p>
          <p className="text-xs">
            AI-generated findings are decision support, not a diagnosis.
          </p>
        </div>
      </div>
    </footer>
  );
}
