import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, CalendarDays, Download, Eye, Loader2, ScanLine } from "lucide-react";
import { toast } from "sonner";
import { formatDate, formatTime } from "@/lib/datetime";
import { MODALITY_LABEL, NormalizedReport, downloadReportPdf } from "@/lib/reports";

type ReportCardProps = {
  report: NormalizedReport;
  patientName?: string | null;
  patientAge?: number | null;
  patientGender?: string | null;
  clinician?: string | null;
  /** Doctors see the patient line; patients see their own demographics. */
  viewerRole: "patient" | "doctor" | "admin";
};

export function ReportCard({
  report,
  patientName,
  patientAge,
  patientGender,
  clinician,
  viewerRole,
}: ReportCardProps) {
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  // jsPDF loads on demand, so the click has real latency the first time.
  const handleDownload = async () => {
    setExporting(true);
    try {
      await downloadReportPdf({ report, patientName, patientAge, patientGender, clinician });
    } catch {
      toast.error("Could not generate the PDF. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const meta = [
    typeof patientAge === "number" ? `Age ${patientAge}` : null,
    patientGender ? capitalize(patientGender) : null,
  ].filter(Boolean);

  return (
    <>
      <Card className="flex flex-col overflow-hidden transition-shadow duration-200 hover:shadow-md">
        {report.imageUrl && (
          <div className="scan-frame relative aspect-[16/10] overflow-hidden border-b border-border bg-slate-950">
            <div className="scan-corner-tl" />
            <img
              src={report.imageUrl}
              alt={`${MODALITY_LABEL[report.modality]} for ${report.title}`}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-contain"
            />
          </div>
        )}

        <CardHeader className="space-y-2.5 pb-3">
          <div className="flex items-start justify-between gap-3">
            <h3 className="min-w-0 font-display text-base font-semibold leading-snug">
              {report.title}
            </h3>
            <Badge variant="secondary" className="shrink-0 gap-1">
              <ScanLine className="h-3 w-3" />
              {MODALITY_LABEL[report.modality]}
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3 w-3" />
              {formatDate(report.createdAt)} · {formatTime(report.createdAt)}
            </span>
            {viewerRole === "doctor" && patientName && <span>Patient: {patientName}</span>}
            {viewerRole === "patient" && meta.length > 0 && <span>{meta.join(" · ")}</span>}
          </div>
        </CardHeader>

        <CardContent className="flex-1 pb-4">
          {report.failed ? (
            <p className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              Analysis did not complete for this scan. Try uploading it again.
            </p>
          ) : (
            <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
              {report.findings}
            </p>
          )}
        </CardContent>

        <CardFooter className="gap-2 border-t border-border pt-4">
          {/* The old "View" button linked to /reports/:id, a route that was
              never registered — every click landed on the 404 page. */}
          <Button variant="outline" size="sm" className="flex-1" onClick={() => setOpen(true)}>
            <Eye className="mr-2 h-4 w-4" /> View
          </Button>
          <Button
            variant="subtle"
            size="sm"
            className="flex-1"
            disabled={exporting}
            onClick={handleDownload}
          >
            {exporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            PDF
          </Button>
        </CardFooter>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="pr-6">{report.title}</DialogTitle>
            <DialogDescription>
              {MODALITY_LABEL[report.modality]} · {formatDate(report.createdAt)} ·{" "}
              {formatTime(report.createdAt)}
            </DialogDescription>
          </DialogHeader>

          {report.imageUrl && (
            <div className="scan-frame overflow-hidden rounded-lg border border-border bg-slate-950">
              <div className="scan-corner-tl" />
              <img
                src={report.imageUrl}
                alt="Scan"
                className="max-h-80 w-full object-contain"
                loading="lazy"
              />
            </div>
          )}

          <section className="space-y-2">
            <h4 className="data-chip">Findings</h4>
            <p className="whitespace-pre-line rounded-lg border border-border bg-muted/40 p-4 text-sm leading-relaxed">
              {report.findings}
            </p>
          </section>

          <p className="text-xs leading-relaxed text-muted-foreground">
            Generated with AI assistance. Intended to support, not replace, clinical judgement —
            confirm all findings with a licensed physician.
          </p>

          <Button onClick={handleDownload} disabled={exporting}>
            {exporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Download PDF
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
