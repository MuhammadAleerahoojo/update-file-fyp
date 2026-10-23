import { Database, ScrollText, Shield, UserCheck } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { InfoGrid, InfoItem } from "@/components/layout/InfoGrid";

const PRIVACY: InfoItem[] = [
  {
    title: "1. Data collection",
    description:
      "We collect the scans you upload and the profile details needed to attach them to the right record. Nothing more.",
    icon: Database,
  },
  {
    title: "2. Data usage",
    description:
      "Uploaded imaging is used solely to generate your analysis and report. It is never sold or shared with third parties.",
    icon: ScrollText,
  },
  {
    title: "3. Security practices",
    description:
      "Data is transmitted over TLS and stored with row-level security, so each record is readable only by its owner and their clinician.",
    icon: Shield,
  },
  {
    title: "4. Your rights",
    description:
      "You can request a copy or full deletion of your data at any time by contacting the team.",
    icon: UserCheck,
  },
];

const Privacy = () => (
  <div className="container px-4 py-16 md:py-24">
    <PageHeader
      eyebrow="Legal"
      title="Privacy policy"
      description="What we collect, why we collect it, and what you can ask us to delete."
    />
    <InfoGrid items={PRIVACY} columns={2} className="max-w-4xl" />
  </div>
);

export default Privacy;
