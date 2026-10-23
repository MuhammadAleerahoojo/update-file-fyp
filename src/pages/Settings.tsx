import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { toast } from "sonner";
import { CalendarIcon, Loader2 } from "lucide-react";

import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

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
  licenseNumber: z.string().optional(),
  experienceYears: z.preprocess(
    (value) => (value === null || value === undefined || value === "" ? undefined : Number(value)),
    z.number().int().min(0, "Must be zero or more").max(80, "That seems too high").optional()
  ),
  contactNumber: z.string().optional(),
});

type PatientValues = z.infer<typeof patientSchema>;
type DoctorValues = z.infer<typeof doctorSchema>;

type RoleRow = Record<string, unknown> & { id: string };

/**
 * Profile settings for the signed-in patient or clinician.
 *
 * As in CompleteProfile, the two roles get their own components: `useForm`
 * captures its resolver at mount, so a single form with a switched schema
 * would keep validating against whichever role happened to be current on the
 * first render.
 */
export default function Settings() {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [record, setRecord] = useState<RoleRow | null>(null);

  const isPatient = profile?.role === "patient";
  const table = isPatient ? "patients" : "doctors";

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!user || !profile || profile.role === "admin") {
        setLoading(false);
        return;
      }

      setLoading(true);
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled) return;
      if (error) toast.error("Could not load your profile.");
      setRecord((data as RoleRow) ?? null);
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [user, profile, table]);

  if (profile?.role === "admin") {
    return (
      <div className="space-y-8">
        <DashboardHeader heading="Settings" />
        <EmptyState
          title="Nothing to configure yet"
          description="Admin accounts don't have a clinical profile. Platform settings live in your Supabase project."
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <DashboardHeader
        heading="Settings"
        description={
          isPatient
            ? "Keep your details current so reports attach to the right record."
            : "Your professional details appear to patients when they book."
        }
      />

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-base">
            {isPatient ? "Patient profile" : "Clinician profile"}
          </CardTitle>
          <CardDescription>Signed in as {profile?.email}</CardDescription>
        </CardHeader>

        <CardContent>
          {loading ? (
            <FormSkeleton />
          ) : !record ? (
            <EmptyState
              title="No profile on file"
              description="Complete your profile first, then come back here to edit it."
              action={{ label: "Complete profile", to: "/complete-profile" }}
            />
          ) : isPatient ? (
            <PatientSettingsForm record={record} />
          ) : (
            <DoctorSettingsForm record={record} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function FormSkeleton() {
  return (
    <div className="space-y-5">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
    </div>
  );
}

function useSaveRole(table: "patients" | "doctors", recordId: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);

  const save = async (payload: Record<string, unknown>) => {
    setSubmitting(true);
    const { error } = await supabase.from(table).update(payload).eq("id", recordId);
    setSubmitting(false);

    if (error) {
      toast.error(`Could not save: ${error.message}`);
      return false;
    }

    toast.success("Profile updated.");
    // Names show up on cards and reports elsewhere — drop the cached record.
    void queryClient.invalidateQueries({
      queryKey: [table === "patients" ? "patient-record" : "doctor-record", user?.id],
    });
    return true;
  };

  return { save, submitting };
}

function FormActions({
  submitting,
  dirty,
  onReset,
}: {
  submitting: boolean;
  dirty: boolean;
  onReset: () => void;
}) {
  return (
    <div className="flex justify-end gap-3 pt-1">
      <Button type="button" variant="outline" onClick={onReset} disabled={submitting || !dirty}>
        Discard changes
      </Button>
      <Button type="submit" disabled={submitting || !dirty}>
        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {submitting ? "Saving…" : "Save changes"}
      </Button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function PatientSettingsForm({ record }: { record: RoleRow }) {
  const { save, submitting } = useSaveRole("patients", record.id);

  const defaults: PatientValues = {
    firstName: (record.first_name as string) ?? "",
    lastName: (record.last_name as string) ?? "",
    dateOfBirth: record.date_of_birth
      ? new Date(record.date_of_birth as string)
      : (undefined as unknown as Date),
    gender: (record.gender as string) ?? "",
    contactNumber: (record.contact_number as string) ?? "",
    address: (record.address as string) ?? "",
    medicalHistory: (record.medical_history as string) ?? "",
  };

  const form = useForm<PatientValues>({
    resolver: zodResolver(patientSchema),
    defaultValues: defaults,
  });

  const onSubmit = async (values: PatientValues) => {
    const ok = await save({
      first_name: values.firstName,
      last_name: values.lastName,
      date_of_birth: values.dateOfBirth ? format(values.dateOfBirth, "yyyy-MM-dd") : null,
      gender: values.gender,
      contact_number: values.contactNumber || null,
      address: values.address,
      medical_history: values.medicalHistory || null,
    });
    // Re-baseline so the Save button correctly disables again.
    if (ok) form.reset(values);
  };

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
                  <Input autoComplete="given-name" {...field} />
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
                  <Input autoComplete="family-name" {...field} />
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
              <FormLabel>Contact number</FormLabel>
              <FormControl>
                <Input type="tel" autoComplete="tel" {...field} />
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
                <Input autoComplete="street-address" {...field} />
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
                {/* Was a single-line Input, which made anything longer than a
                    few words impossible to read back. */}
                <Textarea rows={4} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormActions
          submitting={submitting}
          dirty={form.formState.isDirty}
          onReset={() => form.reset()}
        />
      </form>
    </Form>
  );
}

/* -------------------------------------------------------------------------- */

function DoctorSettingsForm({ record }: { record: RoleRow }) {
  const { save, submitting } = useSaveRole("doctors", record.id);

  const defaults: DoctorValues = {
    firstName: (record.first_name as string) ?? "",
    lastName: (record.last_name as string) ?? "",
    specialization: (record.specialization as string) ?? "",
    licenseNumber: (record.license_number as string) ?? "",
    experienceYears: (record.experience_years as number) ?? undefined,
    contactNumber: (record.contact_number as string) ?? "",
  };

  const form = useForm<DoctorValues>({
    resolver: zodResolver(doctorSchema),
    defaultValues: defaults,
  });

  const onSubmit = async (values: DoctorValues) => {
    const ok = await save({
      first_name: values.firstName,
      last_name: values.lastName,
      specialization: values.specialization,
      license_number: values.licenseNumber || null,
      experience_years: values.experienceYears ?? null,
      contact_number: values.contactNumber || null,
      // The old update also rewrote `user_id` on every save — pointless, and it
      // would have failed the RLS check if the value ever drifted.
    });
    if (ok) form.reset(values);
  };

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
                  <Input autoComplete="given-name" {...field} />
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
                  <Input autoComplete="family-name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="specialization"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Specialization</FormLabel>
                <FormControl>
                  <Input {...field} />
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
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="experienceYears"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Years of experience</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    max={80}
                    value={field.value ?? ""}
                    onChange={(event) =>
                      field.onChange(
                        event.target.value === "" ? undefined : Number(event.target.value)
                      )
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="contactNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Contact number</FormLabel>
                <FormControl>
                  <Input type="tel" autoComplete="tel" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormActions
          submitting={submitting}
          dirty={form.formState.isDirty}
          onReset={() => form.reset()}
        />
      </form>
    </Form>
  );
}
