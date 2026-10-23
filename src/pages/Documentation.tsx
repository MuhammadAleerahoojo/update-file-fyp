import { BarChart2, Code2, GitBranch } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { InfoGrid, InfoItem } from "@/components/layout/InfoGrid";

const DOCS: InfoItem[] = [
  {
    title: "API integration guide",
    description:
      "How to call the analysis endpoint from an existing clinic or hospital system, including request format and error handling.",
    icon: Code2,
  },
  {
    title: "Model architecture",
    description:
      "What the network looks like, how images are pre-processed, and how a raw prediction becomes the text you read in a report.",
    icon: GitBranch,
  },
  {
    title: "Versions and performance",
    description:
      "Release history alongside the accuracy and reliability metrics recorded for each model version.",
    icon: BarChart2,
  },
];

const Documentation = () => (
  <div className="container px-4 py-16 md:py-24">
    <PageHeader
      eyebrow="Reference"
      title="Documentation"
      description="Technical detail for teams integrating Dr Xora or evaluating the model."
    />
    <InfoGrid items={DOCS} />
  </div>
);

export default Documentation;
