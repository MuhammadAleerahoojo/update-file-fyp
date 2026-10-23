import { Card, CardContent } from "@/components/ui/card";
import { Mail } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";

const TEAM = [
  { name: "Muhammad Ali ", email: "muhammadaleerahoojo@gmail.com", initials: "MA" },
  { name: "Aqsa Aijaz", email: "aqsaaijaz@gmail.com", initials: "AA" },
  { name: "Aneesa Aijaz", email: "aneesaaijaz@gmail.com", initials: "AA" },
];

const Contact = () => {
  return (
    <div className="container px-4 py-16 md:py-24">
      <PageHeader
        eyebrow="Contact"
        title="Talk to the team behind Dr Xora"
        description="Questions about the model, an integration, or a bug you've hit? Any of us can help."
      />

      <div className="mx-auto mt-12 grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {TEAM.map((person, index) => (
          <Card
            key={person.email}
            style={{ animationDelay: `${index * 80}ms` }}
            className="group animate-fade-in p-8 text-center transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg"
          >
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 font-display text-xl font-semibold text-primary transition-transform duration-300 group-hover:scale-105">
              {person.initials}
            </div>
            <CardContent className="mt-5 p-0">
              <p className="font-display text-lg font-semibold">{person.name}</p>
              <a
                href={`mailto:${person.email}`}
                className="mt-2 inline-flex items-center justify-center gap-2 break-all text-sm text-muted-foreground transition-colors hover:text-primary"
              >
                <Mail className="h-4 w-4 shrink-0" />
                {person.email}
              </a>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mx-auto mt-6 max-w-5xl bg-muted/40 p-8">
        <p className="text-center leading-relaxed text-muted-foreground">
          Thank you for visiting our portal. For technical support or research enquiries, reach out
          to any of us directly — we're committed to improving healthcare through AI and we read
          every message.
        </p>
      </Card>
    </div>
  );
};

export default Contact;
