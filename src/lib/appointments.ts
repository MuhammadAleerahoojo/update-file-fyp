import { supabase } from "@/lib/supabase";

/**
 * Shared vocabulary for appointment status.
 *
 * The app had three spellings in play at once: the database writes `cancelled`
 * (doctor cancel), the `AppointmentCard` prop type only allowed `canceled`, and
 * the patient screens invented a fourth value `upcoming` that no row ever has.
 * `getStatusColor` had no branch for `cancelled`, so it returned `undefined`
 * and the badge rendered with no styling at all.
 */
export type AppointmentStatus = "scheduled" | "completed" | "cancelled" | "no_show";

const ALIASES: Record<string, AppointmentStatus> = {
  scheduled: "scheduled",
  upcoming: "scheduled",
  booked: "scheduled",
  completed: "completed",
  consulted: "completed",
  done: "completed",
  cancelled: "cancelled",
  canceled: "cancelled",
  no_show: "no_show",
  "no-show": "no_show",
};

/** Normalise whatever the database (or older code) hands us. */
export function normalizeStatus(value: string | null | undefined): AppointmentStatus {
  if (!value) return "scheduled";
  return ALIASES[value.toLowerCase().trim()] ?? "scheduled";
}

export const STATUS_LABEL: Record<AppointmentStatus, string> = {
  scheduled: "Scheduled",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No show",
};

/** Semantic badge classes that work in both light and dark themes. */
export const STATUS_CLASS: Record<AppointmentStatus, string> = {
  scheduled:
    "bg-primary/10 text-primary ring-1 ring-inset ring-primary/20 dark:bg-primary/15",
  completed:
    "bg-emerald-500/10 text-emerald-700 ring-1 ring-inset ring-emerald-500/20 dark:text-emerald-400",
  cancelled:
    "bg-destructive/10 text-destructive ring-1 ring-inset ring-destructive/20",
  no_show:
    "bg-muted text-muted-foreground ring-1 ring-inset ring-border",
};

/** Only future, still-scheduled appointments can be changed. */
export function isActionable(status: AppointmentStatus, appointmentDate: string): boolean {
  if (status !== "scheduled") return false;
  const when = new Date(appointmentDate).getTime();
  return !Number.isNaN(when) && when > Date.now();
}

export type AppointmentActionResult = { ok: boolean; message: string };

/**
 * Update one appointment and report what actually happened.
 *
 * Supabase returns no error when RLS filters an UPDATE down to zero rows, so
 * the old inline handlers toasted "cancelled" for writes that never landed.
 * Selecting the id back lets us tell the difference, and the unique
 * (doctor_id, appointment_date) index surfaces as a readable message instead
 * of a raw Postgres error.
 */
async function updateAppointment(
  id: string,
  patch: Record<string, unknown>,
  failure: string
): Promise<AppointmentActionResult> {
  const { data, error } = await supabase
    .from("appointments")
    .update(patch)
    .eq("id", id)
    .select("id");

  if (error) {
    if (error.code === "23505") {
      return { ok: false, message: "That time slot is already booked. Please choose another." };
    }
    return { ok: false, message: `${failure}: ${error.message}` };
  }
  if (!data || data.length === 0) {
    return { ok: false, message: `${failure}: the appointment was not found or can't be changed.` };
  }
  return { ok: true, message: "" };
}

export const cancelAppointment = (id: string) =>
  updateAppointment(id, { status: "cancelled" }, "Could not cancel the appointment");

export const rescheduleAppointment = (id: string, isoTimestamp: string) =>
  updateAppointment(
    id,
    { appointment_date: isoTimestamp, status: "scheduled" },
    "Could not reschedule the appointment"
  );
