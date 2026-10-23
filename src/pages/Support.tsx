import { BookOpen, MessageCircle, Wrench } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { InfoGrid, InfoItem } from "@/components/layout/InfoGrid";

const SUPPORT: InfoItem[] = [
  {
    title: "Talk to a human",
    description:
      "Email support for technical problems and questions about how the model reaches its findings. We answer every message.",
    icon: MessageCircle,
  },
  {
    title: "Step-by-step guides",
    description:
      "Walkthroughs for every part of the platform, from uploading your first scan to exporting a signed report.",
    icon: BookOpen,
  },
  {
    title: "Troubleshooting",
    description:
      "Fixes for the problems that come up most: rejected uploads, stalled analysis, and reports that won't download.",
    icon: Wrench,
  },
];

const Support = () => (
  <div className="container px-4 py-16 md:py-24">
    <PageHeader
      eyebrow="Help"
      title="Support"
      description="Stuck on something? Start here, then reach out if it isn't covered."
    />
    <InfoGrid items={SUPPORT} />
  </div>
);

export default Support;
