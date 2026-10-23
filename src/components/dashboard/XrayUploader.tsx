import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertTriangle,
  CheckCircle2,
  FileImage,
  Loader2,
  ScanLine,
  Stethoscope,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { ACCEPTED_SCAN_TYPES, uploadScan, validateScanFile } from "@/lib/storage";
import { useAuth } from "@/context/AuthContext";
import { usePatientRecord } from "@/hooks/useRoleRecord";
import { InvalidImageError, Modality, generateCaption } from "@/lib/ai";

type Stage = "idle" | "uploading" | "analyzing" | "saving" | "done";

const MODALITIES: { value: Modality; label: string; icon: typeof ScanLine }[] = [
  { value: "xray", label: "X-Ray", icon: ScanLine },
  { value: "ct", label: "CT Scan", icon: Stethoscope },
];

export function XrayUploader() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: patient, isLoading: loadingPatient } = usePatientRecord();

  const [modality, setModality] = useState<Modality>("xray");
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState(0);
  const [findings, setFindings] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<"invalid" | "unavailable">("unavailable");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inFlight = useRef(false);

  // The old preview used FileReader → a base64 data URL, which holds the whole
  // image in a JS string. Object URLs are cheap, but must be revoked or they
  // leak for the lifetime of the tab.
  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const busy = stage === "uploading" || stage === "analyzing" || stage === "saving";

  const acceptFile = useCallback((candidate: File) => {
    const problem = validateScanFile(candidate);
    if (problem) {
      toast.error(problem);
      return;
    }
    setFile(candidate);
    setFindings(null);
    setError(null);
    setStage("idle");
    setProgress(0);
  }, []);

  const clearFile = () => {
    setFile(null);
    setFindings(null);
    setError(null);
    setStage("idle");
    setProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleUpload = async () => {
    // A ref, not `busy`: two clicks in the same frame both see busy === false.
    if (!file || !user || inFlight.current) return;
    if (!patient?.id) {
      toast.error("Complete your patient profile before uploading a scan.");
      return;
    }

    inFlight.current = true;
    setError(null);
    setFindings(null);

    let uploaded: Awaited<ReturnType<typeof uploadScan>> | null = null;
    try {
      // 1. Validate + analyse first. The backend refuses anything that is not a
      //    genuine scan of the selected type, and we never store a rejected image.
      setStage("analyzing");
      setProgress(20);

      let caption: string;
      try {
        caption = await generateCaption(file, modality);
      } catch (err) {
        setStage("idle");
        setProgress(0);
        const message =
          err instanceof Error && err.message ? err.message : "AI analysis failed.";
        setError(message);
        setErrorKind(err instanceof InvalidImageError ? "invalid" : "unavailable");
        if (err instanceof InvalidImageError) toast.error(message);
        else toast.warning("Analysis did not complete. Nothing was saved.");
        return;
      }

      // 2. Only a validated, analysed scan is uploaded and saved.
      setStage("uploading");
      setProgress(60);

      uploaded = await uploadScan(file, `xrays/${user.id}`);

      setStage("saving");
      setProgress(85);

      const { error: insertError } = await supabase.from("reports").insert([
        {
          patient_id: patient.id,
          xray_image_url: uploaded.url,
          status: "completed",
          ai_analysis_result: {
            caption,
            modality,
            title: `${modality === "ct" ? "CT" : "X-Ray"} analysis`,
          },
        },
      ]);
      if (insertError) throw insertError;

      setProgress(100);
      setStage("done");
      setFindings(caption);
      toast.success("Scan analysed and saved to your reports.");

      void queryClient.invalidateQueries({ queryKey: ["patient-reports"] });
    } catch (err) {
      // Don't leave an image behind that no report points at.
      await uploaded?.discard();
      setStage("idle");
      setProgress(0);
      const message = err instanceof Error ? err.message : "Something went wrong during upload.";
      setError(message);
      setErrorKind("unavailable");
      toast.error(message);
    } finally {
      inFlight.current = false;
    }
  };

  const stageLabel: Record<Stage, string> = {
    idle: "Upload scan",
    uploading: "Uploading…",
    analyzing: "Analysing…",
    saving: "Saving report…",
    done: "Upload another scan",
  };

  const canUpload = !!file && !busy && !!patient?.id;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-lg">Upload a scan</CardTitle>
        <CardDescription>
          Drop in a chest X-ray or CT image and Dr Xora will draft the findings.
        </CardDescription>

        <div
          role="radiogroup"
          aria-label="Scan type"
          className="grid grid-cols-2 gap-2 pt-3"
        >
          {MODALITIES.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={modality === option.value}
              disabled={busy}
              onClick={() => {
                setModality(option.value);
                setError(null);
                setFindings(null);
              }}
              className={cn(
                "flex items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
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
      </CardHeader>

      <CardContent className="space-y-4">
        {!file ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const dropped = e.dataTransfer.files?.[0];
              if (dropped) acceptFile(dropped);
            }}
            className={cn(
              "rounded-xl border-2 border-dashed p-10 text-center transition-colors",
              isDragging ? "border-primary bg-primary/5" : "border-border"
            )}
          >
            <div className="flex flex-col items-center gap-4">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                <Upload className="h-6 w-6 text-primary" aria-hidden="true" />
              </span>
              <div className="space-y-1">
                <p className="font-medium">
                  Drag your {modality === "ct" ? "CT scan" : "X-ray"} here
                </p>
                <p className="text-sm text-muted-foreground">JPG, PNG or WebP · up to 10 MB</p>
              </div>
              <Button variant="outline" type="button" onClick={() => fileInputRef.current?.click()}>
                <FileImage className="mr-2 h-4 w-4" /> Browse files
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div
              className={cn(
                "scan-frame relative overflow-hidden rounded-xl border border-border bg-slate-950",
                stage === "analyzing" && "scan-sweep"
              )}
            >
              <div className="scan-corner-tl" />
              {preview && (
                <img src={preview} alt="Scan preview" className="max-h-72 w-full object-contain" />
              )}
              <Button
                variant="ghost"
                size="icon"
                aria-label="Remove selected file"
                disabled={busy}
                className="absolute right-2 top-2 rounded-full bg-background/80 backdrop-blur hover:bg-background"
                onClick={clearFile}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center justify-between gap-3 text-sm">
              <p className="min-w-0 truncate font-medium">{file.name}</p>
              <p className="shrink-0 font-data text-xs text-muted-foreground">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>

            {busy && (
              <div className="space-y-2">
                <Progress value={progress} className="h-1.5" />
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {stageLabel[stage]}
                </p>
              </div>
            )}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          className="sr-only"
          accept={ACCEPTED_SCAN_TYPES.join(",")}
          onChange={(e) => {
            const chosen = e.target.files?.[0];
            if (chosen) acceptFile(chosen);
          }}
        />

        {!loadingPatient && !patient?.id && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Profile incomplete</AlertTitle>
            <AlertDescription>
              Add your patient details before uploading, so the report attaches to your record.
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>
              {errorKind === "invalid" ? "Image not accepted" : "Analysis unavailable"}
            </AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {findings && (
          <div className="animate-fade-in space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-primary">
              <CheckCircle2 className="h-4 w-4" /> Findings
            </p>
            <p className="whitespace-pre-line text-sm leading-relaxed">{findings}</p>
          </div>
        )}
      </CardContent>

      <CardFooter>
        <Button className="w-full" disabled={!canUpload} onClick={handleUpload}>
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {busy ? stageLabel[stage] : `Analyse ${modality === "ct" ? "CT scan" : "X-ray"}`}
        </Button>
      </CardFooter>
    </Card>
  );
}
