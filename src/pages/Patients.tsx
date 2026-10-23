import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { CardGridSkeleton } from "@/components/dashboard/CardGridSkeleton";
import { CalendarCheck, Search, Stethoscope, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useDoctorRecord } from "@/hooks/useRoleRecord";
import { formatDate, formatTime } from "@/lib/datetime";
import { STATUS_CLASS, STATUS_LABEL, normalizeStatus } from "@/lib/appointments";
import { cn } from "@/lib/utils";

type AppointmentRow = {
  id: string;
  appointment_date: string;
  status: string;
  reason: string | null;
  patients: { id: string; first_name: string | null; last_name: string | null } | null;
};

type PatientSummary = {
  id: string;
  name: string;
  lastAppointment: string;
  status: ReturnType<typeof normalizeStatus>;
  reason: string | null;
  visits: number;
};

export default function Patients() {
  const { data: doctor, isLoading: loadingDoctor } = useDoctorRecord();
  const doctorId = doctor?.id;
  const [search, setSearch] = useState("");

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ["doctor-patient-appointments", doctorId],
    enabled: !!doctorId,
    queryFn: async (): Promise<AppointmentRow[]> => {
      const { data, error } = await supabase
        .from("appointments")
        .select("id, appointment_date, status, reason, patients ( id, first_name, last_name )")
        .eq("doctor_id", doctorId!)
        .order("appointment_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as AppointmentRow[];
    },
  });

  const patients = useMemo<PatientSummary[]>(() => {
    const byId = new Map<string, PatientSummary>();

    for (const apt of appointments) {
      const person = apt.patients;
      if (!person?.id) continue;

      const existing = byId.get(person.id);
      if (existing) {
        existing.visits += 1;
        continue;
      }

      byId.set(person.id, {
        id: person.id,
        name: [person.first_name, person.last_name].filter(Boolean).join(" ") || "Unnamed patient",
        lastAppointment: apt.appointment_date,
        // The old `statusMap` was indexed with an untyped key and fell back to
        // an empty class string, so any status outside its four hardcoded keys
        // rendered an unstyled badge.
        status: normalizeStatus(apt.status),
        reason: apt.reason,
        visits: 1,
      });
    }

    const term = search.trim().toLowerCase();
    const list = [...byId.values()];
    return term ? list.filter((p) => p.name.toLowerCase().includes(term)) : list;
  }, [appointments, search]);

  const loading = loadingDoctor || isLoading;

  return (
    <div className="space-y-8">
      <DashboardHeader
        heading="Patients"
        description="Everyone who has booked with you, most recent first."
      >
        <div className="relative w-full sm:w-72">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search patients"
            aria-label="Search patients"
            className="pl-9"
          />
        </div>
      </DashboardHeader>

      {loading ? (
        <CardGridSkeleton count={3} />
      ) : !doctorId ? (
        <EmptyState
          title="Finish your clinician profile"
          description="Complete your profile to start seeing patients."
          action={{ label: "Complete profile", to: "/complete-profile" }}
        />
      ) : patients.length === 0 ? (
        <EmptyState
          icon={Users}
          title={search ? "No matching patients" : "No patients yet"}
          description={
            search
              ? `Nobody matches "${search}".`
              : "Patients appear here as soon as they book an appointment with you."
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {patients.map((patient) => (
            <Card key={patient.id} className="transition-shadow duration-200 hover:shadow-md">
              <CardHeader className="flex-row items-center gap-3 space-y-0 pb-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                  {patient.name
                    .split(" ")
                    .slice(0, 2)
                    .map((part) => part[0]?.toUpperCase())
                    .join("")}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-base font-semibold">{patient.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {patient.visits} appointment{patient.visits === 1 ? "" : "s"}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={cn("shrink-0 border-0", STATUS_CLASS[patient.status])}
                >
                  {STATUS_LABEL[patient.status]}
                </Badge>
              </CardHeader>

              <CardContent className="space-y-2 text-sm">
                <p className="flex items-center gap-2 text-muted-foreground">
                  {patient.status === "completed" ? (
                    <Stethoscope className="h-4 w-4 shrink-0" aria-hidden="true" />
                  ) : (
                    <CalendarCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
                  )}
                  {formatDate(patient.lastAppointment)} at {formatTime(patient.lastAppointment)}
                </p>
                {patient.reason && (
                  <p className="line-clamp-2 border-t border-border pt-2 text-muted-foreground">
                    {patient.reason}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
