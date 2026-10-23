import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/PageHeader";
import { ArrowRight, Brain, ScanLine, Stethoscope } from "lucide-react";

const STEPS = [
  {
    icon: ScanLine,
    title: "Upload the scan",
    body: "A chest X-ray or CT image goes in through the browser — no viewer software, no install.",
  },
  {
    icon: Brain,
    title: "The model reads it",
    body: "A deep learning model trained on a large annotated imaging dataset produces structured findings.",
  },
  {
    icon: Stethoscope,
    title: "A clinician signs off",
    body: "The draft lands in a real report layout for review, editing and signature before it counts.",
  },
];

const About = () => (
  <div className="container px-4 py-16 md:py-24">
    <PageHeader
      eyebrow="About"
      title="Intelligent chest imaging analysis"
      description="Dr Xora is an AI-assisted reporting portal for chest X-rays and CT scans, built to shorten the distance between an image and a usable clinical answer."
    />

    <div className="mx-auto mt-14 grid max-w-5xl gap-6 md:grid-cols-3">
      {STEPS.map((step, index) => (
        <Card
          key={step.title}
          style={{ animationDelay: `${index * 90}ms` }}
          className="animate-fade-in relative flex flex-col p-7"
        >
          <span className="data-chip absolute right-6 top-6">0{index + 1}</span>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
            <step.icon className="h-5 w-5 text-primary" aria-hidden="true" />
          </div>
          <h2 className="mt-5 font-display text-lg font-semibold">{step.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
        </Card>
      ))}
    </div>

    <Card className="mx-auto mt-6 max-w-5xl bg-muted/40 p-8 md:p-10">
      <div className="prose-none space-y-4 text-pretty leading-relaxed text-muted-foreground">
        <p>
          The platform bridges cutting-edge machine learning and everyday healthcare needs, giving
          both patients and medical professionals fast, accessible preliminary diagnostic insight
          from imaging that would otherwise sit in a queue.
        </p>
        <p>
          Findings are always presented as a draft. Dr Xora is designed to support clinical
          judgement, never to replace it — every report carries space for a licensed physician to
          review, amend and sign.
        </p>
      </div>
      <div className="mt-7 flex flex-wrap gap-3">
        <Button asChild>
          <Link to="/signup">
            Create an account <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/features">Explore the features</Link>
        </Button>
      </div>
    </Card>
  </div>
);

export default About;
