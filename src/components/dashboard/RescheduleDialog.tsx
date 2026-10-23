import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toDateTimeParts, todayAsInputValue, toTimestamp } from "@/lib/datetime";

type RescheduleDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Current appointment timestamp, used to prefill the form. */
  currentDate?: string | null;
  subtitle?: string;
  submitting?: boolean;
  /** Receives a real ISO timestamp built from local wall-clock input. */
  onSubmit: (isoTimestamp: string) => void | Promise<void>;
};

/**
 * One reschedule dialog for every screen that needs it.
 *
 * Four pages each hand-rolled the same overlay: a `fixed inset-0` div with a
 * hardcoded `bg-white` panel (invisible text in dark mode), a bare `×` button,
 * no Escape handling, no focus trap and no returned focus. This uses the Radix
 * dialog everything else in the app is built on.
 */
export function RescheduleDialog({
  open,
  onOpenChange,
  currentDate,
  subtitle,
  submitting = false,
  onSubmit,
}: RescheduleDialogProps) {
  const [form, setForm] = useState({ date: "", time: "" });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(toDateTimeParts(currentDate));
      setError(null);
    }
  }, [open, currentDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const timestamp = toTimestamp(form.date, form.time);
    if (!timestamp) {
      setError("Choose both a date and a time.");
      return;
    }
    if (new Date(timestamp).getTime() <= Date.now()) {
      setError("Pick a slot in the future.");
      return;
    }
    setError(null);
    await onSubmit(timestamp);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reschedule appointment</DialogTitle>
          <DialogDescription>
            {subtitle || "Pick a new date and time. Everyone involved keeps the same booking."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="reschedule-date">New date</Label>
              <Input
                id="reschedule-date"
                type="date"
                min={todayAsInputValue()}
                value={form.date}
                onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reschedule-time">New time</Label>
              <Input
                id="reschedule-time"
                type="time"
                value={form.time}
                onChange={(e) => setForm((prev) => ({ ...prev, time: e.target.value }))}
                required
              />
            </div>
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Keep current time
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {submitting ? "Saving…" : "Confirm reschedule"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
