import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppointmentCard } from "@/components/dashboard/AppointmentCard";
import { RescheduleDialog } from "@/components/dashboard/RescheduleDialog";
import { ConfirmDialog } from "@/components/dashboard/ConfirmDialog";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { CardGridSkeleton } from "@/components/dashboard/CardGridSkeleton";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { usePatientRecord } from "@/hooks/useRoleRecord";
import { cancelAppointment, normalizeStatus, rescheduleAppointment } from "@/lib/appointments";

type AppointmentRow = {
  id: string;
  appointment_date: string;
  status: string;
  reason: string | null;
  doctors: { id: string; first_name: string | null; last_name: string | null } | null;
};

type Filter = "upcoming" | "past" | "all";

export default function Appointments() {
  const queryClient = useQueryClient();
  const { data: patient, isLoading: loadingPatient } = usePatientRecord();
  const [filter, setFilter] = useState<Filter>("upcoming");
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const patientId = patient?.id;

  const {
    data: appointments = [],
    isLoading,
    refetch,
  } = useQuery({
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

  const visible = useMemo(() => {
    const now = Date.now();
    return appointments.filter((apt) => {
      const when = new Date(apt.appointment_date).getTime();
      if (filter === "upcoming") return when >= now && normalizeStatus(apt.status) === "scheduled";
      if (filter === "past") return when < now || normalizeStatus(apt.status) !== "scheduled";
      return true;
    });
  }, [appointments, filter]);

  const selected = appointments.find((apt) => apt.id === rescheduleId);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["patient-appointments", patientId] });
    void refetch();
  };

  /**
   * Cancel marks the row cancelled rather than deleting it.
   *
   * The patient screens used `.delete()` while the doctor screens used a status
   * update, so a patient cancelling made the appointment vanish from the
   * doctor's calendar with no trace of who dropped out.
   */
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
    toast.success("Appointment cancelled. Your doctor has been notified.");
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

  const loading = loadingPatient || isLoading;

  return (
    <div className="space-y-8">
      <DashboardHeader
        heading="My appointments"
        description="Every visit you've booked, past and upcoming."
      >
        <Button asChild>
          <Link to="/appointments/new">
            <CalendarPlus className="mr-2 h-4 w-4" /> Book appointment
          </Link>
        </Button>
      </DashboardHeader>

      <Tabs value={filter} onValueChange={(value) => setFilter(value as Filter)}>
        <TabsList>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="past">Past &amp; cancelled</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <CardGridSkeleton count={3} />
      ) : !patientId ? (
        <EmptyState
          title="Finish your profile first"
          description="We need your patient details before you can book or view appointments."
          action={{ label: "Complete profile", to: "/complete-profile" }}
        />
      ) : visible.length === 0 ? (
        <EmptyState
          title={filter === "upcoming" ? "No upcoming appointments" : "Nothing here yet"}
          description={
            filter === "upcoming"
              ? "Book a slot with a specialist and it will show up here."
              : "Past and cancelled appointments will be listed here."
          }
          action={
            filter === "upcoming"
              ? { label: "Book an appointment", to: "/appointments/new" }
              : undefined
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((apt) => (
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
