import { useEffect, useState } from "react";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { StatCard } from "@/components/dashboard/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Info, Users, FileText, Stethoscope, CalendarDays } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Counts = {
  doctors: number | null;
  patients: number | null;
  reports: number | null;
  appointments: number | null;
};

/**
 * Admin overview.
 *
 * Every number here used to be an invented constant ("3,245 users", "98%
 * system health") and the page linked to `/admin/users`, `/admin/system` and
 * `/admin/activity`, none of which are routes — so each one dead-ended on the
 * 404 page. The counts are now real `head: true` count queries, and the
 * placeholder links are gone.
 */
export default function AdminDashboard() {
  const [counts, setCounts] = useState<Counts>({
    doctors: null,
    patients: null,
    reports: null,
    appointments: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadCounts() {
      setLoading(true);
      const tables = ["doctors", "patients", "reports", "appointments"] as const;

      const results = await Promise.all(
        tables.map(async (table) => {
          const { count, error } = await supabase
            .from(table)
            .select("id", { count: "exact", head: true });
          return error ? null : count ?? 0;
        })
      );

      if (cancelled) return;
      setCounts({
        doctors: results[0],
        patients: results[1],
        reports: results[2],
        appointments: results[3],
      });
      setLoading(false);
    }

    void loadCounts();
    return () => {
      cancelled = true;
    };
  }, []);

  const show = (value: number | null) => (loading ? "…" : value ?? "—");

  const stats = [
    { title: "Registered patients", value: show(counts.patients), icon: Users },
    { title: "Registered doctors", value: show(counts.doctors), icon: Stethoscope },
    { title: "Reports generated", value: show(counts.reports), icon: FileText },
    { title: "Appointments booked", value: show(counts.appointments), icon: CalendarDays },
  ];

  const services = [
    { name: "Database", detail: counts.patients === null ? "Unreachable" : "Reachable" },
    { name: "Storage (xrays bucket)", detail: "Configured" },
    { name: "AI analysis service", detail: "Checked at upload time" },
  ];

  return (
    <div className="space-y-8">
      <DashboardHeader
        heading="Admin overview"
        description="Platform-wide totals pulled live from the database."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.title} title={stat.title} value={stat.value} icon={stat.icon} />
        ))}
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Row-level security applies here too</AlertTitle>
        <AlertDescription>
          These counts reflect only the rows the signed-in account is permitted to read. Grant an
          admin policy in Supabase to see platform-wide totals.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Service status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {services.map((service) => (
              <div key={service.name} className="flex items-center justify-between gap-4">
                <span className="text-sm font-medium">{service.name}</span>
                <span className="text-sm text-muted-foreground">{service.detail}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Content mix</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {[
              { label: "Reports", value: counts.reports ?? 0 },
              { label: "Appointments", value: counts.appointments ?? 0 },
              { label: "Patients", value: counts.patients ?? 0 },
            ].map((row) => {
              const max = Math.max(
                counts.reports ?? 0,
                counts.appointments ?? 0,
                counts.patients ?? 0,
                1
              );
              return (
                <div key={row.label} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{row.label}</span>
                    <span className="font-data text-muted-foreground">{show(row.value)}</span>
                  </div>
                  <Progress value={(row.value / max) * 100} className="h-1.5" />
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
