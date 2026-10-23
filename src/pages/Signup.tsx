import { AuthForm } from "@/components/auth/AuthForm";
import { AuthAside } from "@/components/auth/AuthAside";

const BENEFITS = [
  "AI-drafted findings for X-ray and CT scans",
  "Reports exportable as clean, signed-off PDFs",
  "Appointments and history in one place",
  "Row-level security on every record",
];

export default function Signup() {
  return (
    <div className="container flex items-center justify-center px-4 py-12 md:py-20">
      <div className="grid w-full max-w-5xl items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <AuthForm type="signup" />
        <AuthAside
          eyebrow="Why Dr Xora"
          heading="Everything you need to read, report and follow up."
          bullets={BENEFITS}
        />
      </div>
    </div>
  );
}
