import type { Modality } from "./ai";

export type ReportRow = {
  id: string;
  patient_id: string | null;
  doctor_id: string | null;
  xray_image_url: string | null;
  ai_analysis_result: {
    title?: string;
    caption?: string;
    modality?: Modality;
    error?: string;
  } | null;
  created_at: string;
  status: string | null;
};

export type NormalizedReport = {
  id: string;
  title: string;
  findings: string;
  createdAt: string;
  imageUrl: string | null;
  modality: Modality;
  failed: boolean;
};

/**
 * Turn a raw `reports` row into something the UI can render.
 */
export function normalizeReport(row: ReportRow, fallbackTitle = "Imaging report"): NormalizedReport {
  const analysis = row.ai_analysis_result ?? {};
  const failed = !!analysis.error || !analysis.caption;

  return {
    id: row.id,
    title: analysis.title?.trim() || fallbackTitle,
    findings: analysis.caption?.trim() || "No findings were recorded for this scan.",
    createdAt: row.created_at,
    imageUrl: row.xray_image_url,
    modality: analysis.modality === "ct" ? "ct" : "xray",
    failed,
  };
}

export const MODALITY_LABEL: Record<Modality, string> = {
  xray: "X-Ray",
  ct: "CT Scan",
};

type PdfOptions = {
  report: NormalizedReport;
  patientName?: string | null;
  patientAge?: number | null;
  patientGender?: string | null;
  clinician?: string | null;
};

// ---------------------------------------------------------------------------
// Findings parsing — turns the backend's plain-text caption into a structured
// table (label + probability) instead of one long wrapped paragraph.
// ---------------------------------------------------------------------------
type FindingRow = { label: string; percent: number };
type FindingSection = { heading: string; rows: FindingRow[] };
type ParsedFindings = { sections: FindingSection[]; paragraphs: string[] };

const BULLET_RE = /^[•\-]\s*(.+?):\s*(\d{1,3})%/;
const DISCLAIMER_HINTS = ["licensed radiologist", "not a diagnosis", "screening classifier"];

function parseFindingsText(raw: string): ParsedFindings {
  const lines = raw.split("\n").map((l) => l.trim());
  const sections: FindingSection[] = [];
  const paragraphs: string[] = [];
  let current: FindingSection | null = null;
  let sawAnySection = false;

  lines.forEach((line, i) => {
    if (!line) return;
    // Drop the redundant first line, e.g. "Chest X-ray — AI-assisted findings" —
    // the modality and title are already shown in the letterhead above.
    if (i === 0 && !line.endsWith(":") && !BULLET_RE.test(line)) return;
    if (DISCLAIMER_HINTS.some((h) => line.toLowerCase().includes(h))) return; // our own disclaimer covers this

    const bulletMatch = BULLET_RE.exec(line);
    if (bulletMatch) {
      sawAnySection = true;
      if (!current) {
        current = { heading: "Findings", rows: [] };
        sections.push(current);
      }
      current.rows.push({ label: bulletMatch[1].trim(), percent: Math.min(100, parseInt(bulletMatch[2], 10)) });
      return;
    }

    if (line.endsWith(":") && line.length < 80) {
      current = { heading: line.replace(/:$/, ""), rows: [] };
      sections.push(current);
      sawAnySection = true;
      return;
    }

    paragraphs.push(line);
  });

  return { sections: sawAnySection ? sections.filter((s) => s.rows.length > 0) : [], paragraphs };
}

// ---------------------------------------------------------------------------
// Image loading — fetches the scan and re-encodes it as a JPEG data URL so it
// can be embedded with jsPDF's addImage regardless of the original format.
// ---------------------------------------------------------------------------
async function loadImageForPdf(
  url: string,
  maxDim = 1200
): Promise<{ dataUrl: string; width: number; height: number } | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error("decode failed"));
        el.src = objectUrl;
      });
      const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
      const width = Math.max(1, Math.round(img.naturalWidth * scale));
      const height = Math.max(1, Math.round(img.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.fillStyle = "#000"; // scans have a black background — avoids transparent-PNG artifacts
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      return { dataUrl: canvas.toDataURL("image/jpeg", 0.92), width, height };
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch {
    return null; // CORS failure, deleted file, offline — PDF still generates without the image
  }
}

/**
 * Build a paginated PDF for a report, with the scan image and a structured
 * findings table (not a single wrapped paragraph).
 */
export async function downloadReportPdf({
  report,
  patientName,
  patientAge,
  patientGender,
  clinician,
}: PdfOptions) {
  const { default: jsPDF } = await import("jspdf");
  const image = report.imageUrl ? await loadImageForPdf(report.imageUrl) : null;

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 48;
  const contentWidth = pageWidth - margin * 2;

  let y = margin;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  // --- Letterhead --------------------------------------------------------
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Dr Xora", margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text("Advanced imaging analysis & reporting", margin, y + 14);
  doc.setTextColor(0);

  doc.setFontSize(9);
  doc.setTextColor(120);
  const created = new Date(report.createdAt);
  const dateLabel = Number.isNaN(created.getTime())
    ? "—"
    : created.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  doc.text(`REPORT #${report.id.slice(0, 8).toUpperCase()}`, pageWidth - margin, y, { align: "right" });
  doc.text(`DATE: ${dateLabel}`, pageWidth - margin, y + 12, { align: "right" });
  doc.text(`MODALITY: ${MODALITY_LABEL[report.modality].toUpperCase()}`, pageWidth - margin, y + 24, {
    align: "right",
  });
  doc.setTextColor(0);

  y += 44;
  doc.setDrawColor(30);
  doc.setLineWidth(1.2);
  doc.line(margin, y, pageWidth - margin, y);
  y += 26;

  // --- Title ---------------------------------------------------------------
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(doc.splitTextToSize(report.title, contentWidth), margin, y);
  y += 28;

  // --- Patient block (left) + scan image (right), side by side -----------
  const imageBoxW = contentWidth * 0.38;
  const imageBoxH = 170;
  const textColW = contentWidth - imageBoxW - 18;

  ensureSpace(imageBoxH + 20);
  const rowTop = y;

  // Patient details — left column
  const details = [
    patientName ? `Patient: ${patientName}` : null,
    typeof patientAge === "number" ? `Age: ${patientAge}` : null,
    patientGender ? `Gender: ${patientGender}` : null,
    clinician ? `Reporting physician: ${clinician}` : null,
  ].filter(Boolean) as string[];

  let textY = rowTop;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  details.forEach((line) => {
    doc.text(doc.splitTextToSize(line, textColW), margin, textY);
    textY += 15;
  });

  // Scan image — right column
  const imgX = margin + textColW + 18;
  doc.setDrawColor(210);
  doc.setLineWidth(0.8);
  doc.roundedRect(imgX, rowTop - 10, imageBoxW, imageBoxH, 4, 4, "S");
  if (image) {
    const scale = Math.min((imageBoxW - 12) / image.width, (imageBoxH - 28) / image.height);
    const w = image.width * scale;
    const h = image.height * scale;
    doc.addImage(image.dataUrl, "JPEG", imgX + (imageBoxW - w) / 2, rowTop - 2, w, h);
  } else {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(150);
    doc.text("Image unavailable", imgX + imageBoxW / 2, rowTop - 10 + imageBoxH / 2, { align: "center" });
    doc.setTextColor(0);
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(120);
  doc.text(`${MODALITY_LABEL[report.modality]} image`, imgX + imageBoxW / 2, rowTop - 10 + imageBoxH - 8, {
    align: "center",
  });
  doc.setTextColor(0);

  y = Math.max(textY, rowTop - 10 + imageBoxH) + 24;

  // --- Findings (structured table) -----------------------------------------
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  ensureSpace(20);
  doc.text("FINDINGS", margin, y);
  y += 16;

  const parsed = parseFindingsText(report.findings);

  if (parsed.sections.length > 0) {
    parsed.sections.forEach((section) => {
      ensureSpace(22);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(40);
      doc.text(section.heading.toUpperCase(), margin, y);
      y += 14;

      const rowH = 18;
      section.rows.forEach((row, idx) => {
        ensureSpace(rowH + 2);
        if (idx % 2 === 0) {
          doc.setFillColor(246, 247, 249);
          doc.rect(margin, y - 11, contentWidth, rowH, "F");
        }
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(30);
        doc.text(row.label, margin + 8, y);

        const [r, g, b] =
          row.percent >= 70 ? [194, 65, 12] : row.percent >= 55 ? [202, 138, 4] : [100, 116, 139];
        const chipW = 46;
        const chipX = margin + contentWidth - chipW - 8;
        doc.setFillColor(r, g, b);
        doc.roundedRect(chipX, y - 11, chipW, 14, 3, 3, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text(`${row.percent}%`, chipX + chipW / 2, y - 1, { align: "center" });
        doc.setTextColor(30);
        y += rowH;
      });
      y += 10;
    });
  }

  if (parsed.paragraphs.length > 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    doc.setTextColor(30);
    parsed.paragraphs.forEach((para) => {
      const lines = doc.splitTextToSize(para, contentWidth) as string[];
      lines.forEach((line) => {
        ensureSpace(16);
        doc.text(line, margin, y);
        y += 15;
      });
      y += 4;
    });
  }

  // --- Impression ------------------------------------------------------------
  y += 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(0);
  ensureSpace(20);
  doc.text("IMPRESSION", margin, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  const impression = report.failed
    ? "Analysis was not completed for this scan. A repeat upload or manual review is required."
    : "AI-assisted impression based on the findings above. To be reviewed and confirmed by the attending physician.";
  (doc.splitTextToSize(impression, contentWidth) as string[]).forEach((line) => {
    ensureSpace(16);
    doc.text(line, margin, y);
    y += 15;
  });

  // --- Disclaimer (always last, on the final page) --------------------------
  const disclaimer =
    "This report was generated with AI assistance and is intended to support, not replace, clinical judgment. All findings should be reviewed and confirmed by a licensed physician before use in diagnosis or treatment.";
  const disclaimerLines = doc.splitTextToSize(disclaimer, contentWidth) as string[];
  ensureSpace(disclaimerLines.length * 11 + 24);
  y = Math.max(y + 20, pageHeight - margin - disclaimerLines.length * 11);
  doc.setDrawColor(200);
  doc.setLineWidth(0.6);
  doc.line(margin, y - 12, pageWidth - margin, y - 12);
  doc.setFontSize(8);
  doc.setTextColor(130);
  disclaimerLines.forEach((line) => {
    doc.text(line, margin, y);
    y += 10;
  });

  doc.save(`dr-xora-report-${report.id.slice(0, 8)}.pdf`);
}