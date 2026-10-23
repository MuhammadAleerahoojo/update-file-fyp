import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { CardGridSkeleton } from "@/components/dashboard/CardGridSkeleton";
import { AppointmentCard } from "@/components/dashboard/AppointmentCard";
import { Button } from "@/components/ui/button";
import { FilePlus2, Stethoscope } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useDoctorRecord } from "@/hooks/useRoleRecord";
import { normalizeStatus } from "@/lib/appointments";

type AppointmentRow = {
  id: string;
  appointment_date: string;
  status: string;
  reason: string | null;
  patients: { id: string; first_name: string | null; last_name: string | null } | null;
};

/**
 * Today's consultation list.
 *
 * Replaces the "(To be implemented)" stub with the thing the page was clearly
 * meant to be: the doctor's list for today, with a direct route into report
 * creation.
 */
export default function NewConsultation() {
  const { data: doctor, isLoading: loadingDoctor } = useDoctorRecord();
  const doctorId = doctor?.id;

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ["doctor-appointments", doctorId],
    enabled: !!doctorId,
    queryFn: async (): Promise<AppointmentRow[]> => {
      const { data, error } = await supabase
        .from("appointments")
        .select("id, appointment_date, status, reason, patients ( id, first_name, last_name )")
        .eq("doctor_id", doctorId!)
        .order("appointment_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as AppointmentRow[];
    },
  });

  const todays = useMemo(() => {
    const now = new Date();
    return appointments.filter((apt) => {
      const when = new Date(apt.appointment_date);
      return (
        when.getFullYear() === now.getFullYear() &&
        when.getMonth() === now.getMonth() &&
        when.getDate() === now.getDate() &&
        normalizeStatus(apt.status) === "scheduled"
      );
    });
  }, [appointments]);

  return (
    <div className="space-y-8">
      <DashboardHeader
        heading="Consultations"
        description="Everyone you're seeing today. Start a report straight from the list."
      >
        <Button asChild>
          <Link to="/doctor/reports/new">
            <FilePlus2 className="mr-2 h-4 w-4" /> New report
          </Link>
        </Button>
      </DashboardHeader>

      {loadingDoctor || isLoading ? (
        <CardGridSkeleton count={3} />
      ) : todays.length === 0 ? (
        <EmptyState
          icon={Stethoscope}
          title="No consultations today"
          description="Scheduled appointments for today will appear here."
          action={{ label: "View all appointments", to: "/doctor/appointments" }}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {todays.map((apt) => (
            <AppointmentCard
              key={apt.id}
              id={apt.id}
              appointmentDate={apt.appointment_date}
              status={normalizeStatus(apt.status)}
              reason={apt.reason}
              patientName={
                apt.patients
                  ? [apt.patients.first_name, apt.patients.last_name].filter(Boolean).join(" ")
                  : undefined
              }
              userRole="doctor"
            />
          ))}
        </div>
      )}
    </div>
  );
}
