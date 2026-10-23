import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { StatCard } from "@/components/dashboard/StatCard";
import { AppointmentCard } from "@/components/dashboard/AppointmentCard";
import { ReportCard } from "@/components/dashboard/ReportCard";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { CardGridSkeleton, StatGridSkeleton } from "@/components/dashboard/CardGridSkeleton";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarDays, CalendarPlus, FilePlus2, FileText, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useDoctorRecord } from "@/hooks/useRoleRecord";
import { normalizeStatus } from "@/lib/appointments";
import { ReportRow, normalizeReport } from "@/lib/reports";

type AppointmentRow = {
  id: string;
  appointment_date: string;
  status: string;
  reason: string | null;
  patients: { id: string; first_name: string | null; last_name: string | null } | null;
};

const QUICK_ACTIONS = [
  { to: "/doctor/appointments/new", label: "New appointment", icon: CalendarPlus },
  { to: "/doctor/reports/new", label: "New report", icon: FilePlus2 },
  { to: "/doctor/appointments/schedule", label: "Manage schedule", icon: CalendarDays },
];

export default function DoctorDashboard() {
  const { profile } = useAuth();
  const { data: doctor, isLoading: loadingDoctor } = useDoctorRecord();
  const doctorId = doctor?.id;

  const { data: appointments = [], isLoading: loadingAppointments } = useQuery({
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

  const { data: reportRows = [], isLoading: loadingReports } = useQuery({
    queryKey: ["doctor-reports", doctorId],
    enabled: !!doctorId,
    queryFn: async (): Promise<ReportRow[]> => {
      const { data, error } = await supabase
        .from("reports")
        .select("*")
        .eq("doctor_id", doctorId!)
        .order("created_at", { ascending: false })
        .limit(6);
      if (error) throw error;
      return (data ?? []) as ReportRow[];
    },
  });

  const patientName = (apt: AppointmentRow) =>
    apt.patients
      ? [apt.patients.first_name, apt.patients.last_name].filter(Boolean).join(" ")
      : "";

  const todaysAppointments = useMemo(() => {
    const today = new Date();
    return appointments.filter((apt) => {
      const when = new Date(apt.appointment_date);
      return (
        when.getFullYear() === today.getFullYear() &&
        when.getMonth() === today.getMonth() &&
        when.getDate() === today.getDate() &&
        normalizeStatus(apt.status) === "scheduled"
      );
    });
  }, [appointments]);

  /**
   * Distinct patient count, derived from the appointments already in memory.
   *
   * The old version fired a `count: 'exact', head: true` query and then
   * immediately fired a second query fetching every `patient_id` anyway,
   * because the count was of rows, not distinct patients. The first request
   * was pure waste.
   */
  const recentPatients = useMemo(() => {
    const seen = new Map<string, { id: string; name: string; lastVisit: string }>();
    for (const apt of [...appointments].reverse()) {
      const id = apt.patients?.id;
      if (!id || seen.has(id)) continue;
      seen.set(id, {
        id,
        name: patientName(apt) || "Unnamed patient",
        lastVisit: apt.appointment_date,
      });
    }
    return [...seen.values()];
  }, [appointments]);

  const reports = useMemo(
    () => reportRows.map((row) => normalizeReport(row, "Imaging report")),
    [reportRows]
  );

  const stats = [
    { title: "Patients seen", value: recentPatients.length, icon: Users },
    { title: "Today's appointments", value: todaysAppointments.length, icon: CalendarDays },
    { title: "Reports generated", value: reports.length, icon: FileText },
  ];

  const clinicianName =
    [doctor?.first_name, doctor?.last_name].filter(Boolean).join(" ") ||
    profile?.name ||
    "Doctor";

  const loading = loadingDoctor || loadingAppointments;

  return (
    <div className="space-y-8">
      <DashboardHeader
        heading={`Good day, Dr. ${clinicianName.split(" ").pop()}`}
        description="Your clinic at a glance — today's list, recent reports and your patients."
      >
        <Button asChild>
          <Link to="/doctor/appointments/schedule">
            <CalendarDays className="mr-2 h-4 w-4" /> Manage schedule
          </Link>
        </Button>
      </DashboardHeader>

      <div className="grid gap-3 sm:grid-cols-3">
        {QUICK_ACTIONS.map((action) => (
          <Card
            key={action.to}
            className="group transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
          >
            <Link
              to={action.to}
              className="flex items-center gap-3 rounded-xl p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 transition-transform duration-200 group-hover:scale-105">
                <action.icon className="h-[18px] w-[18px] text-primary" aria-hidden="true" />
              </span>
              <span className="text-sm font-medium">{action.label}</span>
            </Link>
          </Card>
        ))}
      </div>

      {loading ? (
        <StatGridSkeleton count={3} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {stats.map((stat) => (
            <StatCard key={stat.title} title={stat.title} value={stat.value} icon={stat.icon} />
          ))}
        </div>
      )}

      <Tabs defaultValue="appointments" className="space-y-5">
        <TabsList>
          <TabsTrigger value="appointments" className="gap-2">
            <CalendarDays className="h-4 w-4" /> Today
          </TabsTrigger>
          <TabsTrigger value="reports" className="gap-2">
            <FileText className="h-4 w-4" /> Reports
          </TabsTrigger>
          <TabsTrigger value="patients" className="gap-2">
            <Users className="h-4 w-4" /> Patients
          </TabsTrigger>
        </TabsList>

        <TabsContent value="appointments" className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-display text-lg font-semibold">Today&apos;s appointments</h2>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/doctor/appointments">View all</Link>
            </Button>
          </div>

          {loadingAppointments ? (
            <CardGridSkeleton count={3} />
          ) : todaysAppointments.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="Nothing scheduled today"
              description="Your published availability decides what patients can book."
              action={{ label: "Manage schedule", to: "/doctor/appointments/schedule" }}
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {todaysAppointments.map((apt) => (
                <AppointmentCard
                  key={apt.id}
                  id={apt.id}
                  appointmentDate={apt.appointment_date}
                  status={normalizeStatus(apt.status)}
                  reason={apt.reason}
                  patientName={patientName(apt) || undefined}
                  userRole="doctor"
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-display text-lg font-semibold">Recent reports</h2>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/doctor/reports">View all</Link>
            </Button>
          </div>

          {/* This tab used to render two invented reports for "Michael Brown"
              and "Sarah Williams", complete with stock Unsplash imagery — they
              looked like real patient records on a medical dashboard. */}
          {loadingReports ? (
            <CardGridSkeleton count={2} />
          ) : reports.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No reports yet"
              description="Generate findings from a scan and the report will be listed here."
              action={{ label: "Create a report", to: "/doctor/reports/new" }}
            />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {reports.slice(0, 3).map((report) => (
                <ReportCard
                  key={report.id}
                  report={report}
                  viewerRole="doctor"
                  clinician={`Dr. ${clinicianName}`}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="patients" className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-display text-lg font-semibold">Recent patients</h2>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/doctor/patients">View all</Link>
            </Button>
          </div>

          {loadingAppointments ? (
            <CardGridSkeleton count={3} />
          ) : recentPatients.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No patients yet"
              description="Patients appear here once they book an appointment with you."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {recentPatients.slice(0, 6).map((patient) => (
                <Card key={patient.id} className="flex items-center gap-3 p-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                    {patient.name
                      .split(" ")
                      .slice(0, 2)
                      .map((part) => part[0]?.toUpperCase())
                      .join("")}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{patient.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      Last seen {new Date(patient.lastVisit).toLocaleDateString()}
                    </p>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
