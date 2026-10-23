import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { StatCard } from "@/components/dashboard/StatCard";
import { AppointmentCard } from "@/components/dashboard/AppointmentCard";
import { ReportCard } from "@/components/dashboard/ReportCard";
import { RescheduleDialog } from "@/components/dashboard/RescheduleDialog";
import { ConfirmDialog } from "@/components/dashboard/ConfirmDialog";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { CardGridSkeleton, StatGridSkeleton } from "@/components/dashboard/CardGridSkeleton";
import { Button } from "@/components/ui/button";
import { CalendarDays, CalendarPlus, FileText, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { usePatientRecord } from "@/hooks/useRoleRecord";
import { cancelAppointment, normalizeStatus, rescheduleAppointment } from "@/lib/appointments";
import { ReportRow, normalizeReport } from "@/lib/reports";
import { ageFromDateOfBirth } from "@/lib/datetime";

type AppointmentRow = {
  id: string;
  appointment_date: string;
  status: string;
  reason: string | null;
  doctors: { id: string; first_name: string | null; last_name: string | null } | null;
};

export default function Dashboard() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const { data: patient, isLoading: loadingPatient } = usePatientRecord();
  const patientId = patient?.id;

  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: appointments = [], isLoading: loadingAppointments } = useQuery({
    queryKey: ["patient-appointments", patientId],
    enabled: !!patientId,
    queryFn: async (): Promise<AppointmentRow[]> => {
      const { data, error } = await supabase
        .from("appointments")
        .select("id, appointment_date, status, reason, doctors ( id, first_name, last_name )")
        .eq("patient_id", patientId!)
        .order("appointment_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as AppointmentRow[];
    },
  });

  const { data: reportRows = [], isLoading: loadingReports } = useQuery({
    queryKey: ["patient-reports", patientId],
    enabled: !!patientId,
    queryFn: async (): Promise<ReportRow[]> => {
      const { data, error } = await supabase
        .from("reports")
        .select("*")
        .eq("patient_id", patientId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ReportRow[];
    },
  });

  const patientName = patient
    ? [patient.first_name, patient.last_name].filter(Boolean).join(" ")
    : null;

  const upcoming = useMemo(() => {
    const now = Date.now();
    return appointments.filter(
      (apt) =>
        new Date(apt.appointment_date).getTime() >= now &&
        normalizeStatus(apt.status) === "scheduled"
    );
  }, [appointments]);

  const reports = useMemo(
    () =>
      reportRows.map((row) =>
        normalizeReport(row, patientName ? `${patientName} — imaging report` : "Imaging report")
      ),
    [reportRows, patientName]
  );

  // "Pending Reports" previously counted rows with status === 'pending', a
  // value nothing ever wrote. It now counts analyses that genuinely failed and
  // need attention.
  const needsAttention = reports.filter((report) => report.failed).length;
  const patientAge = ageFromDateOfBirth(patient?.date_of_birth);

  const stats = [
    { title: "Total reports", value: reports.length, icon: FileText },
    { title: "Upcoming appointments", value: upcoming.length, icon: CalendarDays },
    { title: "Needs re-analysis", value: needsAttention, icon: Upload },
  ];

  const selected = appointments.find((apt) => apt.id === rescheduleId);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["patient-appointments", patientId] });
  };

  const confirmCancel = async () => {
    if (!cancelId) return;
    setBusy(true);
    const result = await cancelAppointment(cancelId);
    setBusy(false);
    setCancelId(null);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success("Appointment cancelled.");
    invalidate();
  };

  const submitReschedule = async (isoTimestamp: string) => {
    if (!rescheduleId) return;
    setBusy(true);
    const result = await rescheduleAppointment(rescheduleId, isoTimestamp);
    setBusy(false);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success("Appointment rescheduled.");
    setRescheduleId(null);
    invalidate();
  };

  const firstName = profile?.name?.split(" ")[0] || "there";

  return (
    <div className="space-y-8">
      <DashboardHeader
        heading={`Welcome back, ${firstName}`}
        description="Your scans, reports and upcoming visits at a glance."
      >
        <Button asChild>
          <Link to="/upload">
            <Upload className="mr-2 h-4 w-4" /> Upload scan
          </Link>
        </Button>
      </DashboardHeader>

      {loadingPatient || loadingReports || loadingAppointments ? (
        <StatGridSkeleton count={3} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {stats.map((stat) => (
            <StatCard key={stat.title} title={stat.title} value={stat.value} icon={stat.icon} />
          ))}
        </div>
      )}

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-display text-lg font-semibold">Upcoming appointments</h2>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/appointments">View all</Link>
          </Button>
        </div>

        {loadingAppointments ? (
          <CardGridSkeleton count={3} />
        ) : upcoming.length === 0 ? (
          <EmptyState
            icon={CalendarPlus}
            title="No upcoming appointments"
            description="Book a slot with a specialist and it will show up right here."
            action={{ label: "Book an appointment", to: "/appointments/new" }}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {upcoming.slice(0, 3).map((apt) => (
              <AppointmentCard
                key={apt.id}
                id={apt.id}
                appointmentDate={apt.appointment_date}
                status={normalizeStatus(apt.status)}
                reason={apt.reason}
                doctorName={
                  apt.doctors
                    ? [apt.doctors.first_name, apt.doctors.last_name].filter(Boolean).join(" ")
                    : undefined
                }
                userRole="patient"
                busy={busy}
                onCancel={setCancelId}
                onReschedule={setRescheduleId}
              />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-display text-lg font-semibold">Recent reports</h2>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/reports">View all</Link>
          </Button>
        </div>

        {loadingReports ? (
          <CardGridSkeleton count={3} />
        ) : reports.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No reports yet"
            description="Upload your first scan and the AI-drafted findings will appear here."
            action={{ label: "Upload a scan", to: "/upload" }}
          />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {reports.slice(0, 3).map((report) => (
              <ReportCard
                key={report.id}
                report={report}
                viewerRole="patient"
                patientName={patientName}
                patientAge={patientAge}
                patientGender={patient?.gender}
              />
            ))}
          </div>
        )}
      </section>

      <RescheduleDialog
        open={!!rescheduleId}
        onOpenChange={(open) => !open && setRescheduleId(null)}
        currentDate={selected?.appointment_date}
        submitting={busy}
        onSubmit={submitReschedule}
      />

      <ConfirmDialog
        open={!!cancelId}
        onOpenChange={(open) => !open && setCancelId(null)}
        title="Cancel this appointment?"
        description="The slot is released back to your doctor. You can always book another one."
        confirmLabel="Yes, cancel it"
        cancelLabel="Keep appointment"
        destructive
        onConfirm={confirmCancel}
      />
    </div>
  );
}
