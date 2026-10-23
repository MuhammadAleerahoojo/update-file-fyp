import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { CalendarDays, Clock, Stethoscope, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate, formatTime } from "@/lib/datetime";
import {
  AppointmentStatus,
  STATUS_CLASS,
  STATUS_LABEL,
  isActionable,
} from "@/lib/appointments";

type AppointmentCardProps = {
  id: string;
  /** Raw timestamp from the database; formatting happens here, once. */
  appointmentDate: string;
  status: AppointmentStatus;
  userRole: "patient" | "doctor";
  doctorName?: string;
  patientName?: string;
  reason?: string | null;
  onCancel?: (id: string) => void;
  onReschedule?: (id: string) => void;
  busy?: boolean;
};

export function AppointmentCard({
  id,
  appointmentDate,
  status,
  userRole,
  doctorName,
  patientName,
  reason,
  onCancel,
  onReschedule,
  busy = false,
}: AppointmentCardProps) {
  const isPatientView = userRole === "patient";
  const counterpart = isPatientView
    ? doctorName
      ? `Dr. ${doctorName}`
      : "Doctor unassigned"
    : patientName || "Unknown patient";

  // Patients could never cancel or reschedule from the UI: the footer was
  // gated on `userRole === "doctor"`, so the handlers the patient screens
  // passed in were unreachable. Actions now depend on whether a handler exists
  // and whether the appointment is still changeable.
  const canAct = isActionable(status, appointmentDate);
  const showActions = canAct && (onReschedule || onCancel);

  return (
    <Card className="flex flex-col transition-shadow duration-200 hover:shadow-md">
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0 pb-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
            {isPatientView ? (
              <Stethoscope className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            ) : (
              <UserRound className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            )}
          </span>
          <div className="min-w-0">
            <p className="truncate font-display text-base font-semibold leading-tight">
              {counterpart}
            </p>
            <p className="text-xs text-muted-foreground">
              {isPatientView ? "Your clinician" : "Patient"}
            </p>
          </div>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium",
            STATUS_CLASS[status]
          )}
        >
          {STATUS_LABEL[status]}
        </span>
      </CardHeader>

      <CardContent className="flex-1 space-y-2.5 pb-4">
        <div className="flex items-center gap-2 text-sm">
          <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span>{formatDate(appointmentDate)}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span>{formatTime(appointmentDate)}</span>
        </div>
        {reason && (
          <p className="line-clamp-2 border-t border-border pt-2.5 text-sm text-muted-foreground">
            {reason}
          </p>
        )}
      </CardContent>

      {showActions && (
        <CardFooter className="gap-2 border-t border-border pt-4">
          {onReschedule && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              disabled={busy}
              onClick={() => onReschedule(id)}
            >
              Reschedule
            </Button>
          )}
          {onCancel && (
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
              disabled={busy}
              onClick={() => onCancel(id)}
            >
              Cancel
            </Button>
          )}
        </CardFooter>
      )}
    </Card>
  );
}
