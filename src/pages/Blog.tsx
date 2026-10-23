import { Camera, FileText, FlaskConical } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { InfoGrid, InfoItem } from "@/components/layout/InfoGrid";

const POSTS: InfoItem[] = [
  {
    title: "How AI is transforming medical diagnostics",
    description:
      "Where machine learning is genuinely improving accuracy and turnaround in imaging — and where a human reader is still irreplaceable.",
    icon: FlaskConical,
  },
  {
    title: "Detecting pneumonia and tuberculosis with ML",
    description:
      "A walk through the model's performance on chest radiographs, including what it gets wrong and why that matters clinically.",
    icon: FileText,
  },
  {
    title: "Capturing and uploading X-rays well",
    description:
      "Positioning, exposure and file format all change what the model sees. Practical guidance for getting a usable image first time.",
    icon: Camera,
  },
];

const Blog = () => (
  <div className="container px-4 py-16 md:py-24">
    <PageHeader
      eyebrow="Writing"
      title="From the Dr Xora team"
      description="Notes on medical imaging, machine learning, and building software clinicians will actually use."
    />
    <InfoGrid items={POSTS} />
  </div>
);

export default Blog;
