import { FileText, Lock, ShieldOff, UserX } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { InfoGrid, InfoItem } from "@/components/layout/InfoGrid";

const TERMS: InfoItem[] = [
  {
    title: "1. Usage guidelines",
    description:
      "Upload authentic, legible scans only. Dr Xora produces preliminary diagnostic support and is not a substitute for professional medical advice.",
    icon: FileText,
  },
  {
    title: "2. Limitation of liability",
    description:
      "The model aims for accuracy but is not infallible. We accept no liability for medical decisions made solely on its output.",
    icon: ShieldOff,
  },
  {
    title: "3. Account responsibilities",
    description:
      "You are responsible for keeping your login credentials confidential and for all activity carried out under your account.",
    icon: Lock,
  },
  {
    title: "4. Prohibited activities",
    description:
      "Misuse, reverse engineering, or attempts at unauthorised access will result in immediate suspension of the account.",
    icon: UserX,
  },
];

const Terms = () => (
  <div className="container px-4 py-16 md:py-24">
    <PageHeader
      eyebrow="Legal"
      title="Terms of service"
      description="The ground rules for using Dr Xora."
    />
    <InfoGrid items={TERMS} columns={2} className="max-w-4xl" />
  </div>
);

export default Terms;
