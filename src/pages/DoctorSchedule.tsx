import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useDoctorRecord } from "@/hooks/useRoleRecord";
import { AppointmentCard } from "@/components/dashboard/AppointmentCard";
import { RescheduleDialog } from "@/components/dashboard/RescheduleDialog";
import { ConfirmDialog } from "@/components/dashboard/ConfirmDialog";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { CardGridSkeleton } from "@/components/dashboard/CardGridSkeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarClock, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatClockTime } from "@/lib/datetime";
import { cancelAppointment, normalizeStatus, rescheduleAppointment } from "@/lib/appointments";

const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

type Slot = {
  id: string;
  available_weekdays: string[] | null;
  start_time: string;
  end_time: string;
};

type AppointmentRow = {
  id: string;
  appointment_date: string;
  status: string;
  reason: string | null;
  patients: { id: string; first_name: string | null; last_name: string | null } | null;
};

export default function DoctorSchedule() {
  const queryClient = useQueryClient();
  const { data: doctor, isLoading: loadingDoctor } = useDoctorRecord();
  const doctorId = doctor?.id;

  const [newSlot, setNewSlot] = useState({
    weekdays: [] as string[],
    startTime: "",
    endTime: "",
  });
  const [addingSlot, setAddingSlot] = useState(false);
  const [slotToDelete, setSlotToDelete] = useState<string | null>(null);
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: slots = [], isLoading: loadingSlots } = useQuery({
    queryKey: ["doctor-slots", doctorId],
    enabled: !!doctorId,
    queryFn: async (): Promise<Slot[]> => {
      const { data, error } = await supabase
        .from("doctor_available_slots")
        .select("*")
        .eq("doctor_id", doctorId!)
        .order("start_time", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Slot[];
    },
  });

  const { data: appointments = [], isLoading: loadingAppointments } = useQuery({
    queryKey: ["doctor-upcoming", doctorId],
    enabled: !!doctorId,
    queryFn: async (): Promise<AppointmentRow[]> => {
      const { data, error } = await supabase
        .from("appointments")
        .select("id, appointment_date, status, reason, patients ( id, first_name, last_name )")
        .eq("doctor_id", doctorId!)
        .gte("appointment_date", new Date().toISOString())
        .order("appointment_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as AppointmentRow[];
    },
  });

  const refreshSlots = () =>
    queryClient.invalidateQueries({ queryKey: ["doctor-slots", doctorId] });

  /**
   * Refresh after every write.
   *
   * The old reschedule handler closed the modal with a comment saying "the
   * useEffect will refetch appointments" — but that effect only depended on
   * `user`/`profile`, so the list kept showing the old time until a full page
   * reload.
   */
  const refreshAppointments = () =>
    queryClient.invalidateQueries({ queryKey: ["doctor-upcoming", doctorId] });

  const toggleWeekday = (day: string) =>
    setNewSlot((prev) => ({
      ...prev,
      weekdays: prev.weekdays.includes(day)
        ? prev.weekdays.filter((d) => d !== day)
        : [...prev.weekdays, day],
    }));

  const handleAddSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doctorId) return;

    if (!newSlot.weekdays.length) {
      toast.error("Choose at least one weekday.");
      return;
    }
    if (!newSlot.startTime || !newSlot.endTime) {
      toast.error("Set both a start and an end time.");
      return;
    }
    // The old form accepted 17:00 → 09:00, which produced an empty slot list on
    // the booking page with no explanation.
    if (newSlot.startTime >= newSlot.endTime) {
      toast.error("The end time must be after the start time.");
      return;
    }

    setAddingSlot(true);
    const { error } = await supabase.from("doctor_available_slots").insert([
      {
        doctor_id: doctorId,
        available_weekdays: newSlot.weekdays,
        start_time: newSlot.startTime,
        end_time: newSlot.endTime,
      },
    ]);
    setAddingSlot(false);

    if (error) {
      toast.error(`Could not add the slot: ${error.message}`);
      return;
    }
    toast.success("Availability added.");
    setNewSlot({ weekdays: [], startTime: "", endTime: "" });
    void refreshSlots();
  };

  const confirmDeleteSlot = async () => {
    if (!slotToDelete) return;
    const { error } = await supabase
      .from("doctor_available_slots")
      .delete()
      .eq("id", slotToDelete);
    setSlotToDelete(null);

    if (error) {
      toast.error(`Could not remove the slot: ${error.message}`);
      return;
    }
    toast.success("Availability removed.");
    void refreshSlots();
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
    void refreshAppointments();
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
    void refreshAppointments();
  };

  const selected = appointments.find((apt) => apt.id === rescheduleId);
  const patientName = (apt: AppointmentRow) =>
    apt.patients
      ? [apt.patients.first_name, apt.patients.last_name].filter(Boolean).join(" ")
      : "";

  if (!loadingDoctor && !doctorId) {
    return (
      <div className="space-y-8">
        <DashboardHeader heading="Schedule" />
        <EmptyState
          title="Finish your clinician profile"
          description="Publish availability once your specialization and licence number are on file."
          action={{ label: "Complete profile", to: "/complete-profile" }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <DashboardHeader
        heading="Schedule"
        description="Publish the hours you're available and manage the bookings that come in."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add weekly availability</CardTitle>
          <CardDescription>
            Patients can book 30-minute slots inside these hours, on the days you select.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddSlot} className="space-y-5">
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Weekdays</legend>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map((day) => {
                  const active = newSlot.weekdays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggleWeekday(day)}
                      className={cn(
                        "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border text-muted-foreground hover:bg-muted"
                      )}
                    >
                      {day.slice(0, 3)}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <div className="space-y-2">
                <Label htmlFor="start-time">Start time</Label>
                <Input
                  id="start-time"
                  type="time"
                  value={newSlot.startTime}
                  onChange={(e) => setNewSlot((prev) => ({ ...prev, startTime: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-time">End time</Label>
                <Input
                  id="end-time"
                  type="time"
                  value={newSlot.endTime}
                  onChange={(e) => setNewSlot((prev) => ({ ...prev, endTime: e.target.value }))}
                  required
                />
              </div>
              <Button type="submit" disabled={addingSlot}>
                {addingSlot ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                Add slot
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <section className="space-y-4">
        <h2 className="font-display text-lg font-semibold">Published availability</h2>
        {loadingSlots ? (
          <div className="space-y-3">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        ) : slots.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title="No availability published"
            description="Add a weekly slot above so patients can book with you."
          />
        ) : (
          <ul className="space-y-3">
            {slots.map((slot) => (
              <li
                key={slot.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4"
              >
                <div>
                  <p className="font-medium">
                    {(slot.available_weekdays ?? []).join(", ") || "No days set"}
                  </p>
                  <p className="font-data text-sm text-muted-foreground">
                    {formatClockTime(slot.start_time)} – {formatClockTime(slot.end_time)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setSlotToDelete(slot.id)}
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-lg font-semibold">Upcoming bookings</h2>
        {loadingAppointments ? (
          <CardGridSkeleton count={3} />
        ) : appointments.length === 0 ? (
          <EmptyState
            title="Nothing booked yet"
            description="Confirmed appointments will appear here as patients book your published slots."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {appointments.map((apt) => (
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
      </section>

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

      <ConfirmDialog
        open={!!slotToDelete}
        onOpenChange={(open) => !open && setSlotToDelete(null)}
        title="Remove this availability?"
        description="Patients will no longer be able to book new appointments in this window. Existing bookings are unaffected."
        confirmLabel="Remove slot"
        destructive
        onConfirm={confirmDeleteSlot}
      />
    </div>
  );
}
