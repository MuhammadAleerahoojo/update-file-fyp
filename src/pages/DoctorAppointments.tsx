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
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarPlus, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useDoctorRecord } from "@/hooks/useRoleRecord";
import { cancelAppointment, normalizeStatus, rescheduleAppointment } from "@/lib/appointments";

type AppointmentRow = {
  id: string;
  appointment_date: string;
  status: string;
  reason: string | null;
  patients: { id: string; first_name: string | null; last_name: string | null } | null;
};

type Filter = "upcoming" | "past" | "all";

export default function DoctorAppointments() {
  const queryClient = useQueryClient();
  const { data: doctor, isLoading: loadingDoctor } = useDoctorRecord();
  const [filter, setFilter] = useState<Filter>("upcoming");
  const [search, setSearch] = useState("");
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const doctorId = doctor?.id;

  const {
    data: appointments = [],
    isLoading,
    refetch,
  } = useQuery({
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

  const patientName = (apt: AppointmentRow) =>
    apt.patients
      ? [apt.patients.first_name, apt.patients.last_name].filter(Boolean).join(" ")
      : "";

  const visible = useMemo(() => {
    const now = Date.now();
    const term = search.trim().toLowerCase();
    return appointments.filter((apt) => {
      const when = new Date(apt.appointment_date).getTime();
      const status = normalizeStatus(apt.status);
      const matchesFilter =
        filter === "all"
          ? true
          : filter === "upcoming"
            ? when >= now && status === "scheduled"
            : when < now || status !== "scheduled";
      if (!matchesFilter) return false;
      if (!term) return true;
      return patientName(apt).toLowerCase().includes(term);
    });
  }, [appointments, filter, search]);

  const selected = appointments.find((apt) => apt.id === rescheduleId);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["doctor-appointments", doctorId] });
    void refetch();
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

  /**
   * Refetch instead of splicing the update response into local state.
   *
   * The old handler replaced the list item with the row returned by
   * `.update().select()`, which has no joined `patients` relation — so the
   * card it had just rescheduled immediately relabelled itself "N/A".
   */
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

  const loading = loadingDoctor || isLoading;

  return (
    <div className="space-y-8">
      <DashboardHeader
        heading="Appointments"
        description="Every booking across your calendar."
      >
        <Button asChild>
          <Link to="/doctor/appointments/new">
            <CalendarPlus className="mr-2 h-4 w-4" /> New appointment
          </Link>
        </Button>
      </DashboardHeader>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={filter} onValueChange={(value) => setFilter(value as Filter)}>
          <TabsList>
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="past">Past</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative sm:w-72">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by patient name"
            aria-label="Search appointments by patient name"
            className="pl-9"
          />
        </div>
      </div>

      {loading ? (
        <CardGridSkeleton count={3} />
      ) : !doctorId ? (
        <EmptyState
          title="Finish your clinician profile"
          description="Add your specialization and licence number before managing appointments."
          action={{ label: "Complete profile", to: "/complete-profile" }}
        />
      ) : visible.length === 0 ? (
        <EmptyState
          title={search ? "No matching appointments" : "Nothing booked here"}
          description={
            search
              ? `No appointments match "${search}".`
              : "Bookings will appear here as patients schedule with you."
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
              patientName={patientName(apt) || undefined}
              userRole="doctor"
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
        subtitle={selected ? `Appointment with ${patientName(selected) || "your patient"}.` : undefined}
        submitting={busy}
        onSubmit={submitReschedule}
      />

      <ConfirmDialog
        open={!!cancelId}
        onOpenChange={(open) => !open && setCancelId(null)}
        title="Cancel this appointment?"
        description="The patient will see it as cancelled and the slot becomes bookable again."
        confirmLabel="Yes, cancel it"
        cancelLabel="Keep appointment"
        destructive
        onConfirm={confirmCancel}
      />
    </div>
  );
}
