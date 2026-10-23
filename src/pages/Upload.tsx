import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { XrayUploader } from "@/components/dashboard/XrayUploader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck } from "lucide-react";

const STEPS = [
  "Upload a clear X-ray or CT image",
  "Our model analyses it in seconds",
  "Findings are saved to your reports",
  "Download the PDF or share it with your doctor",
];

export default function Upload() {
  return (
    <div className="space-y-8">
      <DashboardHeader
        heading="Upload a scan"
        description="Get AI-drafted findings for a chest X-ray or CT scan in seconds."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <XrayUploader />
        </div>

        {/* Labelled because the nav is also an <aside>; two unlabelled
            "complementary" landmarks are indistinguishable to a screen reader. */}
        <aside className="space-y-6" aria-label="Upload guidance">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">How it works</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-4">
                {STEPS.map((step, index) => (
                  <li key={step} className="flex gap-3 text-sm">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 font-data text-xs font-semibold text-primary">
                      {index + 1}
                    </span>
                    <span className="leading-relaxed">{step}</span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Supported files</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {/* The old sidebar advertised DICOM support, but the uploader
                  only ever accepted `image/*` and rejected .dcm files. */}
              <ul className="space-y-2">
                {["JPEG / JPG", "PNG", "WebP"].map((type) => (
                  <li key={type} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
                    {type}
                  </li>
                ))}
              </ul>
              <p className="border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
                Maximum 10 MB. Export DICOM studies to PNG or JPG before uploading. A clear,
                correctly oriented image gives the best results.
              </p>
            </CardContent>
          </Card>

          <div className="flex gap-3 rounded-xl border border-border bg-muted/40 p-4">
            <ShieldCheck className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <p className="text-xs leading-relaxed text-muted-foreground">
              Scans are stored against your record only. Findings are decision support and must be
              confirmed by a licensed physician.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
