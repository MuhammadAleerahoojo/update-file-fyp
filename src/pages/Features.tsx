import {
  Boxes,
  FileSearch,
  Layers,
  PlugZap,
  ScanLine,
  ShieldCheck,
  Smartphone,
  Zap,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { InfoGrid, InfoItem } from "@/components/layout/InfoGrid";

const FEATURES: InfoItem[] = [
  {
    title: "AI-powered scan analysis",
    description:
      "Detect chest conditions from X-rays and CT scans using a deep learning model trained on a large annotated imaging dataset.",
    icon: ScanLine,
  },
  {
    title: "Structured report drafts",
    description:
      "Findings and impression are generated automatically and laid out like a real radiology report, ready for review.",
    icon: FileSearch,
  },
  {
    title: "Multi-condition detection",
    description:
      "Identifies several chest-related conditions — pneumonia, tuberculosis and other common findings — in a single pass.",
    icon: Layers,
  },
  {
    title: "Exportable PDF reports",
    description:
      "Every report downloads as a paginated, letterheaded PDF with space for the reporting physician's signature.",
    icon: Boxes,
  },
  {
    title: "Secure by default",
    description:
      "Row-level security scopes every record to its owner, and scans are stored in an access-controlled bucket.",
    icon: ShieldCheck,
  },
  {
    title: "Results in seconds",
    description:
      "Analysis returns fast enough to stay inside the reading workflow instead of interrupting it.",
    icon: Zap,
  },
  {
    title: "Mobile and desktop",
    description:
      "A responsive interface that works on a phone at the bedside and on a full reporting workstation.",
    icon: Smartphone,
  },
  {
    title: "Integration ready",
    description:
      "The analysis service is a plain HTTP endpoint, so it drops into existing clinic or telemedicine systems.",
    icon: PlugZap,
  },
];

const Features = () => (
  <div className="container px-4 py-16 md:py-24">
    <PageHeader
      eyebrow="Platform"
      title="Key features"
      description="Everything Dr Xora does, from the moment a scan is uploaded to the moment a signed report leaves the building."
    />
    <InfoGrid items={FEATURES} />
  </div>
);

export default Features;
