import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarDays, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { toTimestamp, todayAsInputValue } from "@/lib/datetime";

const APPOINTMENT_TYPES = ["Consultation", "Follow-up", "Imaging review", "Emergency"];

type PatientOption = { id: string; first_name: string | null; last_name: string | null };

/**
 * Doctor-side appointment creation.
 *
 * The previous version was a form that `console.log`ed its values and cleared
 * itself — pressing "Book Appointment" looked successful but wrote nothing.
 * It now selects a real patient row and inserts into `appointments`.
 */
export default function NewAppointment() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    patientId: "",
    date: "",
    time: "",
    appointmentType: "",
    notes: "",
  });

  const today = useMemo(() => todayAsInputValue(), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!user) return;
      setLoadingPatients(true);

      const [{ data: doctor }, { data: patientRows, error }] = await Promise.all([
        supabase.from("doctors").select("id").eq("user_id", user.id).maybeSingle(),
        supabase
          .from("patients")
          .select("id, first_name, last_name")
          .order("first_name", { ascending: true }),
      ]);

      if (cancelled) return;
      setDoctorId(doctor?.id ?? null);
      if (error) {
        toast.error("Could not load the patient list.");
        setPatients([]);
      } else {
        setPatients(patientRows ?? []);
      }
      setLoadingPatients(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const update = (key: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (!doctorId) {
      toast.error("Your doctor profile is incomplete. Finish it in Settings first.");
      return;
    }

    const appointmentDate = toTimestamp(form.date, form.time);
    if (!appointmentDate) {
      toast.error("Please choose a valid date and time.");
      return;
    }
    if (new Date(appointmentDate).getTime() < Date.now()) {
      toast.error("Pick a date and time in the future.");
      return;
    }

    setSubmitting(true);
    try {
      const reason = [form.appointmentType, form.notes.trim()].filter(Boolean).join(" — ");
      const { error } = await supabase.from("appointments").insert([
        {
          doctor_id: doctorId,
          patient_id: form.patientId,
          appointment_date: appointmentDate,
          status: "scheduled",
          reason: reason || null,
        },
      ]);

      if (error) {
        // Unique (doctor_id, appointment_date) index from supabase-phase1-fixes.sql.
        if (error.code === "23505") {
          throw new Error("You already have an appointment at that time. Choose another slot.");
        }
        throw new Error(error.message);
      }

      toast.success("Appointment booked.");
      navigate("/doctor/appointments");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to book the appointment.";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const patientLabel = (p: PatientOption) =>
    [p.first_name, p.last_name].filter(Boolean).join(" ") || "Unnamed patient";

  return (
    <div className="space-y-8">
      <DashboardHeader
        heading="Book an appointment"
        description="Schedule a visit on behalf of one of your patients."
      >
        <Button variant="outline" asChild>
          <Link to="/doctor/appointments">
            <CalendarDays className="mr-2 h-4 w-4" /> View appointments
          </Link>
        </Button>
      </DashboardHeader>

      <Card className="max-w-2xl">
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="patient">Patient</Label>
              <Select
                value={form.patientId}
                onValueChange={(value) => update("patientId", value)}
                disabled={loadingPatients}
                required
              >
                <SelectTrigger id="patient">
                  <SelectValue
                    placeholder={
                      loadingPatients
                        ? "Loading patients…"
                        : patients.length
                          ? "Select a patient"
                          : "No patients registered yet"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {patients.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {patientLabel(p)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  min={today}
                  value={form.date}
                  onChange={(e) => update("date", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="time">Time</Label>
                <Input
                  id="time"
                  type="time"
                  value={form.time}
                  onChange={(e) => update("time", e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Appointment type</Label>
              <Select
                value={form.appointmentType}
                onValueChange={(value) => update("appointmentType", value)}
                required
              >
                <SelectTrigger id="type">
                  <SelectValue placeholder="Choose appointment type" />
                </SelectTrigger>
                <SelectContent>
                  {APPOINTMENT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">
                Notes <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="notes"
                rows={4}
                value={form.notes}
                onChange={(e) => update("notes", e.target.value)}
                placeholder="Anything the patient should know before the visit…"
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => navigate(-1)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting || !form.patientId}>
                {submitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CalendarDays className="mr-2 h-4 w-4" />
                )}
                {submitting ? "Booking…" : "Book appointment"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
