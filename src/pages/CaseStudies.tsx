import { BarChart3, BookOpen } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { InfoGrid, InfoItem } from "@/components/layout/InfoGrid";

const STUDIES: InfoItem[] = [
  {
    title: "Faster decisions at the point of care",
    description:
      "Scenarios where an AI-drafted report shortened the gap between scan and decision, and what changed in the clinician's workflow as a result.",
    icon: BookOpen,
  },
  {
    title: "What the deployment data showed",
    description:
      "Analytics from running the platform in a live clinical setting: throughput, review times, and where the draft needed the most editing.",
    icon: BarChart3,
  },
];

const CaseStudies = () => (
  <div className="container px-4 py-16 md:py-24">
    <PageHeader
      eyebrow="Evidence"
      title="Case studies"
      description="What happened when Dr Xora was put in front of real readers and real scans."
    />
    <InfoGrid items={STUDIES} columns={2} className="max-w-4xl" />
  </div>
);

export default CaseStudies;
