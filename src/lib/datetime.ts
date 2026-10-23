/**
 * Date/time helpers shared by every appointment screen.
 *
 * The app previously built timestamps by hand in four different places, three
 * of which appended a literal "Z" to a local wall-clock value
 * (`${date}T${time}:00Z`). That told Postgres the doctor's 09:00 local slot was
 * 09:00 UTC, so every appointment silently shifted by the user's UTC offset —
 * and the fourth place omitted the Z, producing a different result again. All
 * of them now go through `toTimestamp`, which keeps wall-clock time honest.
 */

/** Combine a `yyyy-MM-dd` date and an `HH:mm` time into a real ISO timestamp. */
export function toTimestamp(date: string, time: string): string | null {
  if (!date || !time) return null;
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  if ([year, month, day, hour, minute].some((n) => Number.isNaN(n))) return null;
  const local = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (Number.isNaN(local.getTime())) return null;
  // `Date` silently rolls 2025-02-30 over to March 2; reject instead of booking the wrong day.
  if (
    local.getFullYear() !== year ||
    local.getMonth() !== month - 1 ||
    local.getDate() !== day ||
    local.getHours() !== hour ||
    local.getMinutes() !== minute
  ) {
    return null;
  }
  return local.toISOString();
}

/** Split a stored timestamp back into the `yyyy-MM-dd` / `HH:mm` a form needs. */
export function toDateTimeParts(value: string | null | undefined): {
  date: string;
  time: string;
} {
  if (!value) return { date: "", time: "" };
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return { date: "", time: "" };
  const pad = (n: number) => n.toString().padStart(2, "0");
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

/** Today as `yyyy-MM-dd`, for `min` attributes on date inputs. */
export function todayAsInputValue(): string {
  const { date } = toDateTimeParts(new Date().toISOString());
  return date;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** `HH:mm:ss` (Postgres `time`) → `9:00 AM`, without going through date-fns parse. */
export function formatClockTime(value: string | null | undefined): string {
  if (!value) return "—";
  const [rawHour, rawMinute] = value.split(":");
  const hour = Number(rawHour);
  const minute = Number(rawMinute);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return value;
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${minute.toString().padStart(2, "0")} ${suffix}`;
}

/** Age in whole years from a `yyyy-MM-dd` date of birth. */
export function ageFromDateOfBirth(dob: string | null | undefined): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDelta = now.getMonth() - birth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age >= 0 && age < 150 ? age : null;
}
