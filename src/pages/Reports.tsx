import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { ReportCard } from "@/components/dashboard/ReportCard";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { CardGridSkeleton } from "@/components/dashboard/CardGridSkeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Search, Upload } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useDoctorRecord, usePatientRecord } from "@/hooks/useRoleRecord";
import { ReportRow, normalizeReport } from "@/lib/reports";
import { ageFromDateOfBirth } from "@/lib/datetime";

type ModalityFilter = "all" | "xray" | "ct";

export default function Reports() {
  const { profile } = useAuth();
  const isDoctor = profile?.role === "doctor";

  const { data: patient, isLoading: loadingPatient } = usePatientRecord();
  const { data: doctor, isLoading: loadingDoctor } = useDoctorRecord();

  const [search, setSearch] = useState("");
  const [modality, setModality] = useState<ModalityFilter>("all");

  const ownerId = isDoctor ? doctor?.id : patient?.id;
  const ownerColumn = isDoctor ? "doctor_id" : "patient_id";

  const { data: rows = [], isLoading } = useQuery({
    queryKey: isDoctor ? ["doctor-reports", ownerId] : ["patient-reports", ownerId],
    enabled: !!ownerId,
    queryFn: async (): Promise<ReportRow[]> => {
      const { data, error } = await supabase
        .from("reports")
        .select("*")
        .eq(ownerColumn, ownerId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ReportRow[];
    },
  });

  const patientName = patient
    ? [patient.first_name, patient.last_name].filter(Boolean).join(" ")
    : null;

  const clinician = doctor
    ? `Dr. ${[doctor.first_name, doctor.last_name].filter(Boolean).join(" ")}`
    : null;

  const reports = useMemo(() => {
    const fallback = patientName ? `${patientName} — imaging report` : "Imaging report";
    const term = search.trim().toLowerCase();
    return rows
      .map((row) => normalizeReport(row, fallback))
      .filter((report) => (modality === "all" ? true : report.modality === modality))
      .filter((report) =>
        term
          ? report.title.toLowerCase().includes(term) ||
            report.findings.toLowerCase().includes(term)
          : true
      );
  }, [rows, patientName, search, modality]);

  /**
   * Age is derived from `date_of_birth`.
   *
   * The old code read `patientDetails?.age` — but the query only ever selected
   * `id, gender, first_name, last_name`, so age was structurally `undefined`
   * and every report card printed "Age: N/A".
   */
  const patientAge = ageFromDateOfBirth(patient?.date_of_birth);

  const loading = isLoading || (isDoctor ? loadingDoctor : loadingPatient);

  return (
    <div className="space-y-8">
      <DashboardHeader
        heading={isDoctor ? "Reports" : "My reports"}
        description={
          isDoctor
            ? "Every report you've generated, newest first."
            : "AI-drafted findings from the scans you've uploaded."
        }
      >
        <Button asChild>
          <Link to={isDoctor ? "/doctor/reports/new" : "/upload"}>
            <Upload className="mr-2 h-4 w-4" />
            {isDoctor ? "New report" : "Upload scan"}
          </Link>
        </Button>
      </DashboardHeader>

      {rows.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Tabs value={modality} onValueChange={(value) => setModality(value as ModalityFilter)}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="xray">X-Ray</TabsTrigger>
              <TabsTrigger value="ct">CT</TabsTrigger>
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
              placeholder="Search findings"
              aria-label="Search reports"
              className="pl-9"
            />
          </div>
        </div>
      )}

      {loading ? (
        <CardGridSkeleton count={3} />
      ) : !ownerId ? (
        <EmptyState
          title="Finish your profile first"
          description="We need your details before reports can be linked to your record."
          action={{ label: "Complete profile", to: "/complete-profile" }}
        />
      ) : reports.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={search || modality !== "all" ? "No matching reports" : "No reports yet"}
          description={
            search || modality !== "all"
              ? "Try a different search term or filter."
              : isDoctor
                ? "Generate a report from a scan and it will be listed here."
                : "Upload a scan and your AI-drafted findings will appear here."
          }
          action={
            search || modality !== "all"
              ? undefined
              : { label: isDoctor ? "Create a report" : "Upload a scan", to: isDoctor ? "/doctor/reports/new" : "/upload" }
          }
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {reports.map((report) => (
            <ReportCard
              key={report.id}
              report={report}
              viewerRole={profile?.role ?? "patient"}
              patientName={isDoctor ? undefined : patientName}
              patientAge={isDoctor ? undefined : patientAge}
              patientGender={isDoctor ? undefined : patient?.gender}
              clinician={clinician}
            />
          ))}
        </div>
      )}
    </div>
  );
}
