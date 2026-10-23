import { Link } from "react-router-dom";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ArrowRight, Info, UserPlus } from "lucide-react";

const STEPS = [
  "Ask the patient to sign up at the /signup page and choose the Patient role.",
  "They confirm their email and complete their profile (name, date of birth, contact details).",
  "Their record becomes selectable when you book an appointment or create a report.",
];

/**
 * Patient onboarding.
 *
 * This was a stub reading "This is where you can add a new patient. (To be
 * implemented)". A form would not have worked either: the `patients` insert
 * policy in supabase-setup.sql requires `auth.uid() = user_id`, so a clinician
 * cannot create a record on someone else's behalf. Patients self-register, and
 * this page now says so instead of implying otherwise.
 */
export default function NewPatient() {
  return (
    <div className="space-y-8">
      <DashboardHeader
        heading="Add a patient"
        description="How new patients join your list."
      />

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Patients register their own account</AlertTitle>
        <AlertDescription>
          Medical records are protected by row-level security — each patient record can only be
          created by the person it belongs to. That keeps consent and ownership unambiguous.
        </AlertDescription>
      </Alert>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserPlus className="h-4 w-4 text-primary" />
            Getting a patient onto your list
          </CardTitle>
          <CardDescription>Three steps, and they appear in your patient list.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <ol className="space-y-4">
            {STEPS.map((step, index) => (
              <li key={step} className="flex gap-3 text-sm">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 font-data text-xs font-semibold text-primary">
                  {index + 1}
                </span>
                <span className="leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>

          <div className="flex flex-wrap gap-3 border-t border-border pt-5">
            <Button asChild>
              <Link to="/doctor/appointments/new">
                Book for an existing patient <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/doctor/patients">Back to patients</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
