import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Activity,
  ArrowRight,
  CalendarClock,
  Check,
  FileText,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Users,
} from "lucide-react";

const FEATURES = [
  {
    icon: ScanLine,
    title: "X-ray and CT upload",
    body: "Drag in a chest radiograph or a CT slice in any common image format and analysis starts immediately.",
  },
  {
    icon: FileText,
    title: "Structured report drafts",
    body: "Findings and impression are generated automatically, laid out like a real radiology report.",
  },
  {
    icon: CalendarClock,
    title: "Appointments, built in",
    body: "Patients and clinicians schedule, reschedule and track visits from the same dashboard.",
  },
];

const ROLES = [
  {
    icon: Users,
    title: "Patients",
    points: [
      "Upload scans for AI analysis",
      "Book appointments with specialists",
      "Download reports as PDF, anytime",
      "Secure, private medical history",
    ],
    cta: { label: "Sign up as a patient", to: "/signup" },
    featured: false,
  },
  {
    icon: Stethoscope,
    title: "Doctors",
    points: [
      "Review and edit AI findings",
      "Generate X-ray and CT reports",
      "Publish availability, manage bookings",
      "Full history for every patient",
    ],
    cta: { label: "Sign up as a doctor", to: "/signup" },
    featured: true,
  },
  {
    icon: ShieldCheck,
    title: "Admins",
    points: [
      "Oversee accounts and access",
      "Monitor platform activity",
      "Row-level security throughout",
      "Usage and volume reporting",
    ],
    cta: { label: "Contact us for access", to: "/contact" },
    featured: false,
  },
];

const STEPS = [
  { step: "01", title: "Upload", body: "A chest X-ray or CT image, straight from the browser." },
  { step: "02", title: "Analyse", body: "The model returns structured findings in seconds." },
  { step: "03", title: "Sign off", body: "A clinician reviews, edits and exports the report." },
];

export default function Home() {
  return (
    <>
      {/* ==================================================================== */}
      {/* Hero                                                                  */}
      {/* ==================================================================== */}
      <section className="relative overflow-hidden">
        <div aria-hidden="true" className="grid-backdrop absolute inset-0" />
        <div
          aria-hidden="true"
          className="absolute left-1/2 top-0 h-[420px] w-[880px] -translate-x-1/2 rounded-full bg-primary/10 blur-[130px]"
        />

        <div className="container relative px-4 py-20 md:px-6 md:py-28">
          <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_1fr]">
            <div className="animate-slide-up space-y-7">
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1.5 backdrop-blur">
                <Activity className="h-3.5 w-3.5 text-secondary" aria-hidden="true" />
                <span className="data-chip !text-foreground/70">
                  X-Ray &amp; CT · AI reporting
                </span>
              </span>

              <h1 className="font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
                Read the scan.
                <br />
                <span className="text-gradient">Write the report.</span>
                <br />
                In minutes, not hours.
              </h1>

              <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">
                Dr Xora turns chest X-rays and CT scans into structured, doctor-ready findings — so
                clinicians spend less time typing and more time deciding.
              </p>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button size="lg" asChild>
                  <Link to="/signup">
                    Get started <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button variant="outline" size="lg" asChild>
                  <Link to="/about">See how it works</Link>
                </Button>
              </div>

              <ul className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-2 text-sm text-muted-foreground">
                {["X-Ray support", "CT scan support", "Exportable PDF reports"].map((item) => (
                  <li key={item} className="flex items-center gap-1.5">
                    <Check className="h-4 w-4 text-primary" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Scan viewer mock. Built from tokens rather than a hotlinked stock
                photo, so it renders offline and reads correctly in both themes. */}
            <div className="animate-fade-in [animation-delay:180ms]">
              <div className="scan-frame scan-sweep relative rounded-2xl border border-border bg-slate-950 p-3 shadow-xl">
                <div className="scan-corner-tl" />

                <div className="flex items-center justify-between px-2 pb-2 font-data text-[10px] tracking-wider text-slate-400">
                  <span>MODALITY: CHEST XR / CT</span>
                  <span className="flex items-center gap-1.5 text-secondary">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-secondary" />
                    ANALYSING
                  </span>
                </div>

                <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-gradient-to-b from-slate-800 to-slate-950">
                  <svg
                    viewBox="0 0 400 300"
                    className="h-full w-full"
                    role="img"
                    aria-label="Stylised chest radiograph"
                  >
                    <defs>
                      <radialGradient id="lung" cx="50%" cy="45%" r="55%">
                        <stop offset="0%" stopColor="#cbd5e1" stopOpacity="0.35" />
                        <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
                      </radialGradient>
                    </defs>
                    <rect width="400" height="300" fill="url(#lung)" />
                    {/* rib cage */}
                    {[0, 1, 2, 3, 4].map((i) => (
                      <g key={i} stroke="#e2e8f0" strokeOpacity={0.22} fill="none" strokeWidth="2">
                        <path d={`M150 ${80 + i * 34} Q110 ${95 + i * 34} 96 ${125 + i * 34}`} />
                        <path d={`M250 ${80 + i * 34} Q290 ${95 + i * 34} 304 ${125 + i * 34}`} />
                      </g>
                    ))}
                    {/* spine */}
                    <rect x="194" y="62" width="12" height="180" rx="6" fill="#e2e8f0" fillOpacity="0.18" />
                    {/* flagged finding */}
                    <circle cx="268" cy="168" r="26" fill="none" stroke="hsl(27 88% 54%)" strokeWidth="2" strokeDasharray="5 4" />
                    <text x="268" y="212" textAnchor="middle" className="font-data" fontSize="9" fill="hsl(27 88% 54%)">
                      REGION OF INTEREST
                    </text>
                  </svg>
                </div>

                <div className="flex items-center justify-between px-2 pt-2 font-data text-[10px] tracking-wider text-slate-400">
                  <span>REPORT DRAFT: 00:42</span>
                  <span>CONFIDENCE: 96%</span>
                </div>
              </div>

              {/* Sits below the viewer rather than on top of it — overlapping
                  it with a negative margin covered the "REPORT DRAFT / CONFIDENCE"
                  readout, which is the detail that sells the whole mock. */}
              <Card className="mt-4 flex items-start gap-3 p-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary/15">
                  <Sparkles className="h-4 w-4 text-secondary" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-display text-sm font-semibold">
                    Findings, drafted automatically
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Impression plus structured findings, ready for clinician review and sign-off.
                  </p>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* ==================================================================== */}
      {/* How it works                                                          */}
      {/* ==================================================================== */}
      <section className="border-y border-border bg-muted/30">
        <div className="container px-4 py-14 md:px-6">
          <div className="grid gap-8 md:grid-cols-3">
            {STEPS.map((item, index) => (
              <div
                key={item.step}
                style={{ animationDelay: `${index * 90}ms` }}
                className="animate-fade-in flex gap-4"
              >
                <span className="font-data text-2xl font-medium text-secondary">{item.step}</span>
                <div>
                  <h3 className="font-display text-base font-semibold">{item.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ==================================================================== */}
      {/* Features                                                              */}
      {/* ==================================================================== */}
      <section className="container px-4 py-20 md:px-6 md:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <span className="data-chip">Platform</span>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Built around the reading room workflow
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            Upload, analyse and report — for X-rays and CT scans alike.
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {FEATURES.map((feature, index) => (
            <Card
              key={feature.title}
              style={{ animationDelay: `${index * 100}ms` }}
              className="group animate-fade-in p-7 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 transition-transform duration-300 group-hover:scale-110">
                <feature.icon className="h-5 w-5 text-primary" aria-hidden="true" />
              </div>
              <h3 className="mt-5 font-display text-lg font-semibold">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{feature.body}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* ==================================================================== */}
      {/* Roles                                                                 */}
      {/* ==================================================================== */}
      <section className="border-t border-border bg-muted/30">
        <div className="container px-4 py-20 md:px-6 md:py-28">
          <div className="mx-auto max-w-2xl text-center">
            <span className="data-chip">Roles</span>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              One platform, three workflows
            </h2>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {ROLES.map((role) => (
              <Card
                key={role.title}
                className={
                  role.featured
                    ? "relative flex flex-col p-7 ring-2 ring-primary/30"
                    : "flex flex-col p-7"
                }
              >
                {role.featured && (
                  <span className="absolute -top-3 left-7 rounded-full bg-primary px-3 py-1 text-[11px] font-medium text-primary-foreground">
                    Most used
                  </span>
                )}
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                    <role.icon className="h-5 w-5 text-primary" aria-hidden="true" />
                  </span>
                  <h3 className="font-display text-xl font-semibold">{role.title}</h3>
                </div>

                <ul className="mt-6 flex-1 space-y-3">
                  {role.points.map((point) => (
                    <li key={point} className="flex items-start gap-2.5 text-sm">
                      <Check
                        className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                        aria-hidden="true"
                      />
                      <span className="leading-relaxed">{point}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className="mt-7 w-full"
                  variant={role.featured ? "default" : "outline"}
                  asChild
                >
                  <Link to={role.cta.to}>{role.cta.label}</Link>
                </Button>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ==================================================================== */}
      {/* CTA                                                                   */}
      {/* ==================================================================== */}
      <section className="container px-4 py-20 md:px-6 md:py-28">
        {/* Light mode gets the solid teal slab. In dark mode the same fill is a
            bright, highly saturated block on an otherwise near-black page —
            genuinely uncomfortable at full width — so dark falls back to an
            elevated panel with a teal glow, which reads as emphasis without
            shouting. */}
        <div
          className="relative overflow-hidden rounded-2xl px-8 py-14 text-center md:px-16 md:py-20
                     bg-primary text-primary-foreground
                     dark:border dark:border-primary/25 dark:bg-elevated dark:text-foreground"
        >
          <div
            aria-hidden="true"
            className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-secondary/20 blur-3xl dark:bg-primary/20"
          />
          <div className="relative mx-auto max-w-2xl space-y-5">
            <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              Bring AI reporting into your practice
            </h2>
            <p className="text-lg leading-relaxed text-primary-foreground/80 dark:text-muted-foreground">
              Join the clinicians and patients already using Dr Xora for faster, clearer imaging
              reports.
            </p>
            <div className="flex flex-col justify-center gap-3 pt-2 sm:flex-row">
              {/* Deliberately not `variant="secondary"`. Secondary is the amber
                  AI-signal colour, reserved for inference state — spending it
                  on a marketing CTA is what makes a palette stop meaning
                  anything. */}
              <Button
                size="lg"
                className="bg-primary-foreground text-primary hover:bg-primary-foreground/90
                           dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
                asChild
              >
                <Link to="/signup">Create an account</Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-primary-foreground/25 bg-transparent text-primary-foreground hover:border-primary-foreground/40 hover:bg-primary-foreground/10 hover:text-primary-foreground
                           dark:border-border dark:text-foreground dark:hover:bg-accent dark:hover:text-accent-foreground"
                asChild
              >
                <Link to="/contact">Talk to the team</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
