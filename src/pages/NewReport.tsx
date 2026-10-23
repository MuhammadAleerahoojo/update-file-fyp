import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  Download,
  FileText,
  Loader2,
  ScanLine,
  Stethoscope,
  UploadCloud,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { ACCEPTED_SCAN_TYPES, uploadScan, validateScanFile } from "@/lib/storage";
import { useDoctorRecord } from "@/hooks/useRoleRecord";
import { AiUnavailableError, InvalidImageError, Modality, generateCaption } from "@/lib/ai";
import { MODALITY_LABEL, downloadReportPdf } from "@/lib/reports";
import { ageFromDateOfBirth } from "@/lib/datetime";

const MODALITIES: { value: Modality; label: string; icon: typeof ScanLine }[] = [
  { value: "xray", label: "X-Ray", icon: ScanLine },
  { value: "ct", label: "CT Scan", icon: Stethoscope },
];

type PatientOption = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  gender: string | null;
  date_of_birth: string | null;
};

export default function NewReport() {
  const queryClient = useQueryClient();
  const { data: doctor, isLoading: loadingDoctor } = useDoctorRecord();
  const doctorId = doctor?.id;

  const [modality, setModality] = useState<Modality>("xray");
  const [title, setTitle] = useState("");
  const [patientId, setPatientId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [findings, setFindings] = useState("");
  const [error, setError] = useState("");
  const [invalidImage, setInvalidImage] = useState(false);
  const [savedReportId, setSavedReportId] = useState<string | null>(null);

  const { data: patients = [] } = useQuery({
    queryKey: ["all-patients"],
    queryFn: async (): Promise<PatientOption[]> => {
      const { data, error: queryError } = await supabase
        .from("patients")
        .select("id, first_name, last_name, gender, date_of_birth")
        .order("first_name", { ascending: true });
      if (queryError) throw queryError;
      return (data ?? []) as PatientOption[];
    },
  });

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const selectedPatient = patients.find((p) => p.id === patientId) ?? null;
  const patientName = selectedPatient
    ? [selectedPatient.first_name, selectedPatient.last_name].filter(Boolean).join(" ")
    : null;

  const clinician = useMemo(
    () =>
      doctor
        ? `Dr. ${[doctor.first_name, doctor.last_name].filter(Boolean).join(" ")}`
        : null,
    [doctor]
  );

  const today = new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const handleFile = (chosen: File | null) => {
    setError("");
    setInvalidImage(false);
    setFindings("");
    setSavedReportId(null);
    if (!chosen) {
      setFile(null);
      return;
    }
    const problem = validateScanFile(chosen);
    if (problem) {
      setError(problem);
      return;
    }
    setFile(chosen);
  };

  const reset = () => {
    setTitle("");
    setPatientId("");
    setFile(null);
    setFindings("");
    setError("");
    setSavedReportId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError("");
    setInvalidImage(false);

    if (!doctorId) {
      setError("Your clinician profile is incomplete.");
      return;
    }
    if (!file) {
      setError("Upload a scan image to generate findings.");
      return;
    }

    setLoading(true);
    setFindings("");
    let uploaded: Awaited<ReturnType<typeof uploadScan>> | null = null;
    try {
      // Validate + analyse first; a rejected image is never uploaded or saved.
      const caption = await generateCaption(file, modality);
      setFindings(caption);

      uploaded = await uploadScan(file, `doctor_reports/${doctorId}`);

      const { data: inserted, error: insertError } = await supabase
        .from("reports")
        .insert([
          {
            doctor_id: doctorId,
            // Previously hardcoded to `null`, so a doctor-generated report was
            // never attached to the patient it belonged to and never showed up
            // on that patient's own reports page.
            patient_id: patientId || null,
            xray_image_url: uploaded.url,
            status: "completed",
            ai_analysis_result: {
              title: title.trim() || `${MODALITY_LABEL[modality]} analysis`,
              caption,
              modality,
            },
          },
        ])
        .select("id")
        .single();
      if (insertError) throw insertError;

      setSavedReportId(inserted.id);
      toast.success("Report generated and saved.");
      void queryClient.invalidateQueries({ queryKey: ["doctor-reports", doctorId] });
    } catch (err) {
      await uploaded?.discard();
      const message =
        err instanceof AiUnavailableError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Report generation failed.";
      setError(message);
      setInvalidImage(err instanceof InvalidImageError);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (!loadingDoctor && !doctorId) {
    return (
      <div className="space-y-8">
        <DashboardHeader heading="Create a report" />
        <EmptyState
          title="Finish your clinician profile"
          description="Add your specialization and licence number before generating reports."
          action={{ label: "Complete profile", to: "/complete-profile" }}
        />
      </div>
    );
  }

  const displayTitle = title.trim() || `${MODALITY_LABEL[modality]} analysis report`;

  return (
    <div className="space-y-8">
      <DashboardHeader
        heading="Create a report"
        description="Upload a scan, generate AI findings, and export a clean, signed-off report."
      >
        <Button variant="outline" asChild>
          <Link to="/doctor/reports">
            <FileText className="mr-2 h-4 w-4" /> View reports
          </Link>
        </Button>
      </DashboardHeader>

      <div className="grid gap-6 xl:grid-cols-[minmax(340px,400px)_1fr]">
        {/* ---------------------------------------------------------------- */}
        {/* Input panel                                                       */}
        {/* ---------------------------------------------------------------- */}
        <div className="space-y-3">
          <h2 className="data-chip">1 · Upload &amp; generate</h2>
          <Card>
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit} className="space-y-5">
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium">Scan type</legend>
                  <div className="grid grid-cols-2 gap-2">
                    {MODALITIES.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={modality === option.value}
                        onClick={() => {
                          setModality(option.value);
                          setError("");
                          setInvalidImage(false);
                        }}
                        className={cn(
                          "flex items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-medium transition-colors",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          modality === option.value
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:bg-muted"
                        )}
                      >
                        <option.icon className="h-4 w-4" />
                        {option.label}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <div className="space-y-2">
                  <Label htmlFor="report-title">Report title</Label>
                  <Input
                    id="report-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={
                      modality === "ct" ? "e.g. Chest CT analysis" : "e.g. Chest X-ray analysis"
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="report-patient">
                    Patient <span className="text-muted-foreground">(optional)</span>
                  </Label>
                  <Select value={patientId} onValueChange={setPatientId}>
                    <SelectTrigger id="report-patient">
                      <SelectValue placeholder="Attach to a patient record" />
                    </SelectTrigger>
                    <SelectContent>
                      {patients.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {[p.first_name, p.last_name].filter(Boolean).join(" ") ||
                            "Unnamed patient"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="report-image">
                    {MODALITY_LABEL[modality]} image
                  </Label>

                  {!preview ? (
                    <label
                      htmlFor="report-image"
                      className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border py-9 text-center transition-colors hover:bg-muted/50"
                    >
                      <UploadCloud className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
                      <span className="text-sm text-muted-foreground">Click to choose an image</span>
                      <span className="text-xs text-muted-foreground">JPG, PNG, WebP · 10 MB</span>
                    </label>
                  ) : (
                    <div
                      className={cn(
                        "scan-frame overflow-hidden rounded-lg border border-border bg-slate-950",
                        loading && "scan-sweep"
                      )}
                    >
                      <div className="scan-corner-tl" />
                      <img
                        src={preview}
                        alt="Scan preview"
                        className="max-h-56 w-full object-contain"
                      />
                      {loading && (
                        <p className="bg-slate-950 py-1.5 text-center font-data text-[10px] tracking-wide text-secondary">
                          ● ANALYSING {MODALITY_LABEL[modality].toUpperCase()}…
                        </p>
                      )}
                    </div>
                  )}

                  <Input
                    id="report-image"
                    type="file"
                    accept={ACCEPTED_SCAN_TYPES.join(",")}
                    onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                    className={preview ? "mt-2" : "sr-only"}
                  />
                  {file && (
                    <p className="truncate text-xs text-muted-foreground">Selected: {file.name}</p>
                  )}
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>
                      {invalidImage ? "Image not accepted" : "Couldn&apos;t generate findings"}
                    </AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={reset} disabled={loading}>
                    Reset
                  </Button>
                  <Button type="submit" disabled={loading || !file}>
                    {loading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <FileText className="mr-2 h-4 w-4" />
                    )}
                    {loading ? "Analysing…" : "Generate findings"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {savedReportId && (
            <Button
              variant="subtle"
              className="w-full"
              onClick={() =>
                void downloadReportPdf({
                  report: {
                    id: savedReportId,
                    title: displayTitle,
                    findings,
                    createdAt: new Date().toISOString(),
                    imageUrl: null,
                    modality,
                    failed: false,
                  },
                  patientName,
                  patientAge: ageFromDateOfBirth(selectedPatient?.date_of_birth),
                  patientGender: selectedPatient?.gender,
                  clinician,
                })
              }
            >
              <Download className="mr-2 h-4 w-4" /> Download report as PDF
            </Button>
          )}
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Live preview of the printed report                                */}
        {/* ---------------------------------------------------------------- */}
        <div className="space-y-3">
          <h2 className="data-chip">2 · Report preview</h2>
          <div className="mx-auto w-full max-w-[720px] rounded-xl border border-border bg-white p-8 text-slate-900 shadow-sm md:p-10">
            <div className="mb-6 flex items-start justify-between gap-4 border-b-2 border-slate-900 pb-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-900">
                  <ScanLine className="h-5 w-5 text-white" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-display text-lg font-semibold leading-none">Dr Xora</p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Advanced imaging analysis &amp; reporting
                  </p>
                </div>
              </div>
              <div className="text-right font-data text-[11px] leading-relaxed text-slate-500">
                <p>REPORT #{savedReportId ? savedReportId.slice(0, 8).toUpperCase() : "PENDING"}</p>
                <p>DATE: {today}</p>
                <p>MODALITY: {MODALITY_LABEL[modality].toUpperCase()}</p>
              </div>
            </div>

            <h3 className="mb-4 font-display text-xl font-semibold">{displayTitle}</h3>

            {patientName && (
              <p className="mb-4 text-sm text-slate-600">
                Patient: <span className="font-medium text-slate-900">{patientName}</span>
                {selectedPatient?.gender && ` · ${selectedPatient.gender}`}
                {ageFromDateOfBirth(selectedPatient?.date_of_birth) !== null &&
                  ` · Age ${ageFromDateOfBirth(selectedPatient?.date_of_birth)}`}
              </p>
            )}

            {preview && (
              <div className="mb-6 overflow-hidden rounded-md border border-slate-200 bg-black">
                <img src={preview} alt="Scan" className="h-56 w-full object-contain" />
              </div>
            )}

            <div className="space-y-5 text-sm">
              <section>
                <h4 className="mb-1.5 font-data text-[11px] uppercase tracking-wide text-slate-500">
                  Findings
                </h4>
                <div className="whitespace-pre-line rounded-md border border-slate-200 bg-slate-50 p-4 leading-relaxed">
                  {findings || "Upload a scan and generate findings to populate this section."}
                </div>
              </section>

              <section>
                <h4 className="mb-1.5 font-data text-[11px] uppercase tracking-wide text-slate-500">
                  Impression
                </h4>
                <div className="rounded-md border border-slate-200 p-4 leading-relaxed text-slate-700">
                  {findings
                    ? "AI-assisted impression based on the findings above. To be reviewed and confirmed by the attending physician."
                    : "—"}
                </div>
              </section>

              <section className="grid grid-cols-2 gap-6 pt-4">
                <div>
                  <p className="mb-1 font-data text-[11px] uppercase tracking-wide text-slate-500">
                    Reporting physician
                  </p>
                  <div className="h-10 border-b border-slate-300" />
                  <p className="mt-1 text-xs text-slate-500">{clinician || "Signature"}</p>
                </div>
                <div>
                  <p className="mb-1 font-data text-[11px] uppercase tracking-wide text-slate-500">
                    Date reviewed
                  </p>
                  <div className="h-10 border-b border-slate-300" />
                </div>
              </section>
            </div>

            <p className="mt-8 border-t border-slate-200 pt-4 text-[10px] leading-relaxed text-slate-400">
              This report was generated with AI assistance and is intended to support, not replace,
              clinical judgment. All findings should be reviewed and confirmed by a licensed
              physician before use in diagnosis or treatment.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
