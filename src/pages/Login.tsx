import { AuthForm } from "@/components/auth/AuthForm";
import { AuthAside } from "@/components/auth/AuthAside";

export default function Login() {
  return (
    <div className="container flex items-center justify-center px-4 py-12 md:py-20">
      <div className="grid w-full max-w-5xl items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <AuthForm type="login" />
        <AuthAside
          eyebrow="Trusted by clinicians"
          quote="Dr Xora drafts the report while I'm still looking at the scan. It gives me back the part of the day I used to spend typing."
          attribution="Dr. Sarah Johnson"
          role="Consultant Radiologist"
        />
      </div>
    </div>
  );
}
