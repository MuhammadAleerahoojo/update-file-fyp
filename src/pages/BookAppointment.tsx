import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { usePatientRecord } from "@/hooks/useRoleRecord";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { CardGridSkeleton } from "@/components/dashboard/CardGridSkeleton";
import { toast } from "sonner";
import { BriefcaseMedical, CalendarClock, Loader2, Stethoscope } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatClockTime, todayAsInputValue, toTimestamp } from "@/lib/datetime";

const SLOT_MINUTES = 30;
const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

type Slot = {
  id: string;
  available_weekdays: string[] | null;
  start_time: string;
  end_time: string;
};

type Doctor = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  specialization: string | null;
  experience_years: number | null;
  contact_number: string | null;
  doctor_available_slots: Slot[] | null;
};

const doctorName = (d: Doctor) =>
  [d.first_name, d.last_name].filter(Boolean).join(" ") || "Unnamed clinician";

const initials = (d: Doctor) =>
  [d.first_name?.[0], d.last_name?.[0]].filter(Boolean).join("").toUpperCase() || "DR";

/**
 * Expand a doctor's recurring availability rule into concrete `HH:mm` slots.
 * Slots in the past on today's date are dropped.
 */
function buildSlots(rule: Slot, selectedDate: Date): string[] {
  const [startHour, startMinute] = rule.start_time.split(":").map(Number);
  const [endHour, endMinute] = rule.end_time.split(":").map(Number);
  if ([startHour, startMinute, endHour, endMinute].some(Number.isNaN)) return [];

  const cursor = new Date(selectedDate);
  cursor.setHours(startHour, startMinute, 0, 0);
  const end = new Date(selectedDate);
  end.setHours(endHour, endMinute, 0, 0);

  const now = Date.now();
  const out: string[] = [];
  while (cursor < end) {
    if (cursor.getTime() > now) {
      out.push(
        `${cursor.getHours().toString().padStart(2, "0")}:${cursor
          .getMinutes()
          .toString()
          .padStart(2, "0")}`
      );
    }
    cursor.setMinutes(cursor.getMinutes() + SLOT_MINUTES);
  }
  return out;
}

export default function BookAppointment() {
  const navigate = useNavigate();
  const { data: patient, isLoading: loadingPatient } = usePatientRecord();

  const [bookingDoctor, setBookingDoctor] = useState<Doctor | null>(null);
  const [form, setForm] = useState({ date: "", time: "", reason: "" });
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [slotsState, setSlotsState] = useState<"idle" | "loading" | "ready">("idle");
  const [submitting, setSubmitting] = useState(false);

  const today = useMemo(() => todayAsInputValue(), []);

  const { data: doctors = [], isLoading: loadingDoctors } = useQuery({
    queryKey: ["bookable-doctors"],
    queryFn: async (): Promise<Doctor[]> => {
      const { data, error } = await supabase
        .from("doctors")
        .select(
          "id, first_name, last_name, specialization, experience_years, contact_number, doctor_available_slots(*)"
        )
        .order("first_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Doctor[];
    },
  });

  // Work out which slots are still free for the chosen day.
  useEffect(() => {
    let cancelled = false;

    async function resolveSlots() {
      if (!form.date || !bookingDoctor) {
        setAvailableSlots([]);
        setSlotsState("idle");
        return;
      }

      setSlotsState("loading");
      setAvailableSlots([]);

      const [year, month, day] = form.date.split("-").map(Number);
      const selectedDate = new Date(year, month - 1, day);
      if (Number.isNaN(selectedDate.getTime())) {
        setSlotsState("ready");
        return;
      }

      const weekday = WEEKDAYS[selectedDate.getDay()];
      const rule = (bookingDoctor.doctor_available_slots ?? []).find((slot) =>
        (slot.available_weekdays ?? []).includes(weekday)
      );

      if (!rule) {
        if (!cancelled) setSlotsState("ready");
        return;
      }

      const generated = buildSlots(rule, selectedDate);

      const dayStart = new Date(selectedDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(selectedDate);
      dayEnd.setHours(23, 59, 59, 999);

      // RLS only lets a patient see their own appointments, so ask the
      // `get_booked_slots` function (supabase-phase2-security.sql), which
      // returns just the taken timestamps for every patient. If it isn't
      // installed yet, fall back to the direct query.
      const range = { p_doctor_id: bookingDoctor.id, p_from: dayStart.toISOString(), p_to: dayEnd.toISOString() };
      let booked: { appointment_date: string; status?: string | null }[] | null = null;
      let error: unknown = null;

      const rpc = await supabase.rpc("get_booked_slots", range);
      if (!rpc.error) {
        booked = rpc.data as { appointment_date: string }[] | null;
      } else {
        const direct = await supabase
          .from("appointments")
          .select("appointment_date, status")
          .eq("doctor_id", bookingDoctor.id)
          .gte("appointment_date", range.p_from)
          .lte("appointment_date", range.p_to);
        booked = direct.data;
        error = direct.error;
      }

      if (cancelled) return;

      if (error) {
        // The unique index still prevents a double booking, so offering the
        // full set beats showing nothing at all.
        setAvailableSlots(generated);
        setSlotsState("ready");
        return;
      }

      /**
       * The old code ran the stored timestamp through
       * `parse(value, 'yyyy-MM-dd HH:mm:ssZ', …)`. Supabase returns ISO-8601,
       * which that mask never matches, so `parse` produced an Invalid Date and
       * `format` threw "Invalid time value" — inside a `try` with only a
       * `finally`. The rejection escaped, and every date that already had a
       * booking silently rendered zero available slots.
       */
      const takenTimes = new Set(
        (booked ?? [])
          .filter((row) => (row.status ?? "scheduled") !== "cancelled")
          .map((row) => {
            const d = new Date(row.appointment_date);
            if (Number.isNaN(d.getTime())) return null;
            return `${d.getHours().toString().padStart(2, "0")}:${d
              .getMinutes()
              .toString()
              .padStart(2, "0")}`;
          })
          .filter((value): value is string => value !== null)
      );

      setAvailableSlots(generated.filter((slot) => !takenTimes.has(slot)));
      setSlotsState("ready");
    }

    void resolveSlots();
    return () => {
      cancelled = true;
    };
  }, [form.date, bookingDoctor]);

  const openBooking = (doctor: Doctor) => {
    setBookingDoctor(doctor);
    setForm({ date: "", time: "", reason: "" });
    setAvailableSlots([]);
    setSlotsState("idle");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patient?.id || !bookingDoctor) return;

    const appointmentDate = toTimestamp(form.date, form.time);
    if (!appointmentDate || !form.reason.trim()) {
      toast.error("Pick a date, a time slot, and tell us the reason for the visit.");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("appointments").insert([
        {
          doctor_id: bookingDoctor.id,
          patient_id: patient.id,
          appointment_date: appointmentDate,
          status: "scheduled",
          reason: form.reason.trim(),
        },
      ]);

      if (error) {
        // Surfaces the unique index added in supabase-phase1-fixes.sql, which
        // stops two patients claiming the same slot in a race.
        if (error.code === "23505") {
          throw new Error("That slot was just taken. Please choose another time.");
        }
        throw error;
      }

      toast.success("Appointment booked.");
      setBookingDoctor(null);
      navigate("/appointments");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to book the appointment.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingPatient || loadingDoctors) {
    return (
      <div className="space-y-8">
        <DashboardHeader heading="Book an appointment" />
        <CardGridSkeleton count={3} />
      </div>
    );
  }

  if (!patient?.id) {
    return (
      <div className="space-y-8">
        <DashboardHeader heading="Book an appointment" />
        <EmptyState
          title="Finish your profile first"
          description="We need your patient details before an appointment can be booked."
          action={{ label: "Complete profile", to: "/complete-profile" }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <DashboardHeader
        heading="Book an appointment"
        description="Choose a specialist and pick a slot from their published availability."
      />

      {doctors.length === 0 ? (
        <EmptyState
          icon={Stethoscope}
          title="No clinicians available yet"
          description="Once doctors register and publish their availability, they'll be listed here."
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {doctors.map((doctor) => {
            const slots = doctor.doctor_available_slots ?? [];
            return (
              <Card key={doctor.id} className="flex flex-col">
                <CardHeader className="flex-row items-center gap-4 space-y-0">
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary/10 font-display text-lg font-semibold text-primary">
                    {initials(doctor)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-display text-base font-semibold">
                      Dr. {doctorName(doctor)}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {doctor.specialization || "General practice"}
                    </p>
                  </div>
                </CardHeader>

                <CardContent className="flex-1 space-y-3 text-sm">
                  <div className="flex flex-wrap gap-2">
                    {typeof doctor.experience_years === "number" && (
                      <Badge variant="secondary" className="gap-1">
                        <BriefcaseMedical className="h-3 w-3" />
                        {doctor.experience_years} yrs
                      </Badge>
                    )}
                    <Badge variant={slots.length ? "secondary" : "outline"} className="gap-1">
                      <CalendarClock className="h-3 w-3" />
                      {slots.length ? `${slots.length} availability rule${slots.length > 1 ? "s" : ""}` : "No availability"}
                    </Badge>
                  </div>

                  {slots.length > 0 && (
                    <ul className="space-y-1.5 border-t border-border pt-3 text-xs text-muted-foreground">
                      {slots.slice(0, 3).map((slot) => (
                        <li key={slot.id} className="flex justify-between gap-3">
                          <span className="truncate">
                            {(slot.available_weekdays ?? []).join(", ") || "—"}
                          </span>
                          <span className="shrink-0 font-data">
                            {formatClockTime(slot.start_time)} – {formatClockTime(slot.end_time)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>

                <CardFooter>
                  <Button
                    className="w-full"
                    onClick={() => openBooking(doctor)}
                    disabled={slots.length === 0}
                  >
                    {slots.length === 0 ? "No slots published" : "Book appointment"}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!bookingDoctor} onOpenChange={(open) => !open && setBookingDoctor(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {bookingDoctor ? `Book with Dr. ${doctorName(bookingDoctor)}` : "Book appointment"}
            </DialogTitle>
            <DialogDescription>
              Slots already taken or in the past are hidden automatically.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="booking-date">Date</Label>
              <Input
                id="booking-date"
                type="date"
                min={today}
                value={form.date}
                onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value, time: "" }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Available times</Label>
              {slotsState === "idle" ? (
                <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                  Pick a date to see open slots.
                </p>
              ) : slotsState === "loading" ? (
                <p className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border px-3 py-6 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Checking availability…
                </p>
              ) : availableSlots.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                  No open slots on this day. Try another date.
                </p>
              ) : (
                <div
                  role="radiogroup"
                  aria-label="Available times"
                  className="grid max-h-44 grid-cols-3 gap-2 overflow-y-auto rounded-lg border border-border p-2"
                >
                  {availableSlots.map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      role="radio"
                      aria-checked={form.time === slot}
                      onClick={() => setForm((prev) => ({ ...prev, time: slot }))}
                      className={cn(
                        "rounded-md border px-2 py-2 font-data text-xs transition-colors",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        form.time === slot
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border hover:bg-muted"
                      )}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="booking-reason">Reason for visit</Label>
              <Textarea
                id="booking-reason"
                rows={3}
                value={form.reason}
                onChange={(e) => setForm((prev) => ({ ...prev, reason: e.target.value }))}
                placeholder="Persistent cough, follow-up on chest X-ray…"
                required
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setBookingDoctor(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting || !form.time}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {submitting ? "Booking…" : "Confirm booking"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
