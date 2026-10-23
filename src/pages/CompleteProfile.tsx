import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { toast } from "sonner";
import { CalendarIcon, Loader2 } from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { FullPageLoader } from "@/components/layout/FullPageLoader";
import { Logo } from "@/components/layout/Logo";
import { cn } from "@/lib/utils";

const patientSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  dateOfBirth: z.date({ required_error: "A date of birth is required." }),
  gender: z.string().min(1, "Gender is required"),
  contactNumber: z.string().optional(),
  address: z.string().min(1, "Address is required"),
  medicalHistory: z.string().optional(),
});

const doctorSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  specialization: z.string().min(1, "Specialization is required"),
  licenseNumber: z.string().min(1, "License number is required"),
});

type PatientValues = z.infer<typeof patientSchema>;
type DoctorValues = z.infer<typeof doctorSchema>;

/**
 * Onboarding for a signed-in user who has no patients/doctors record yet.
 *
 * The original version called `useForm` *after* two early `return`s, so the
 * render where `isLoading` flipped to false added a hook that hadn't existed
 * before and React threw "Rendered more hooks than during the previous
 * render" — a hard crash on the very first page after email confirmation.
 *
 * The two role forms are separate components rather than one form with a
 * switched schema, because `useForm` captures its resolver at mount. With a
 * single form, a doctor whose profile hadn't loaded on the first render would
 * be left validating against the *patient* schema forever, and submit would
 * fail on fields their form never showed.
 */
export default function CompleteProfile() {
  const { user, profile, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !user) navigate("/login", { replace: true });
  }, [isLoading, user, navigate]);

  if (isLoading) return <FullPageLoader label="Loading your profile…" />;
  if (!user || !profile) return null;

  const isDoctor = profile.role === "doctor";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-lg space-y-6">
        <div className="flex justify-center">
          <Logo />
        </div>

        <Card>
          <CardHeader className="space-y-1.5 text-center">
            <CardTitle className="font-display text-2xl">Complete your profile</CardTitle>
            <CardDescription>
              A few more details and your {isDoctor ? "clinician" : "patient"} account is ready.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isDoctor ? <DoctorForm /> : <PatientForm />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function useProfileSubmit(destination: string) {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);

  const save = async (table: "patients" | "doctors", payload: Record<string, unknown>) => {
    if (!user) return;
    setSubmitting(true);
    try {
      // Upsert on user_id so a half-finished attempt can be retried rather
      // than failing on the unique constraint.
      const { error } = await supabase
        .from(table)
        .upsert({ user_id: user.id, ...payload }, { onConflict: "user_id" });
      if (error) throw error;

      toast.success("Profile completed.");
      // The record hooks may have cached "no row yet" for minutes.
      await queryClient.invalidateQueries({ queryKey: [table === "doctors" ? "doctor-record" : "patient-record"] });
      // Re-read the profile so the auth guard stops redirecting back here.
      await refreshProfile();
      navigate(destination, { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save your profile.");
    } finally {
      setSubmitting(false);
    }
  };

  return { save, submitting };
}

function SubmitButton({ submitting }: { submitting: boolean }) {
  return (
    <Button type="submit" className="w-full" disabled={submitting}>
      {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {submitting ? "Saving…" : "Save and continue"}
    </Button>
  );
}

/* -------------------------------------------------------------------------- */

function PatientForm() {
  const { save, submitting } = useProfileSubmit("/dashboard");

  const form = useForm<PatientValues>({
    resolver: zodResolver(patientSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      dateOfBirth: undefined,
      gender: "",
      contactNumber: "",
      address: "",
      medicalHistory: "",
    },
  });

  const onSubmit = (values: PatientValues) =>
    save("patients", {
      first_name: values.firstName,
      last_name: values.lastName,
      date_of_birth: format(values.dateOfBirth, "yyyy-MM-dd"),
      gender: values.gender,
      contact_number: values.contactNumber || null,
      address: values.address,
      medical_history: values.medicalHistory || null,
    });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>First name</FormLabel>
                <FormControl>
                  <Input placeholder="Jane" autoComplete="given-name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="lastName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Last name</FormLabel>
                <FormControl>
                  <Input placeholder="Doe" autoComplete="family-name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="dateOfBirth"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Date of birth</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        type="button"
                        variant="outline"
                        className={cn(
                          "w-full justify-start pl-3 font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        {field.value ? format(field.value, "PPP") : "Pick a date"}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      captionLayout="dropdown-buttons"
                      fromYear={1900}
                      toYear={new Date().getFullYear()}
                      defaultMonth={field.value ?? new Date(1990, 0)}
                      selected={field.value}
                      onSelect={field.onChange}
                      disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="gender"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Gender</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                    <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="contactNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Contact number <span className="text-muted-foreground">(optional)</span>
              </FormLabel>
              <FormControl>
                <Input type="tel" placeholder="+92 300 0000000" autoComplete="tel" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Address</FormLabel>
              <FormControl>
                <Input placeholder="Street, city" autoComplete="street-address" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="medicalHistory"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Medical history <span className="text-muted-foreground">(optional)</span>
              </FormLabel>
              <FormControl>
                <Textarea
                  rows={3}
                  placeholder="Existing conditions, allergies, prior imaging…"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <SubmitButton submitting={submitting} />
      </form>
    </Form>
  );
}

/* -------------------------------------------------------------------------- */

function DoctorForm() {
  const { save, submitting } = useProfileSubmit("/doctor/dashboard");

  const form = useForm<DoctorValues>({
    resolver: zodResolver(doctorSchema),
    defaultValues: { firstName: "", lastName: "", specialization: "", licenseNumber: "" },
  });

  const onSubmit = (values: DoctorValues) =>
    save("doctors", {
      first_name: values.firstName,
      last_name: values.lastName,
      specialization: values.specialization,
      license_number: values.licenseNumber,
    });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>First name</FormLabel>
                <FormControl>
                  <Input placeholder="Jane" autoComplete="given-name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="lastName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Last name</FormLabel>
                <FormControl>
                  <Input placeholder="Doe" autoComplete="family-name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="specialization"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Specialization</FormLabel>
              <FormControl>
                <Input placeholder="Radiology" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="licenseNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>License number</FormLabel>
              <FormControl>
                <Input placeholder="PMC-000000" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <SubmitButton submitting={submitting} />
      </form>
    </Form>
  );
}
