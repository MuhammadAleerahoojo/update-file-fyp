import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Compass } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { roleHome } from "@/lib/roles";

export default function NotFound() {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile } = useAuth();

  // Signed-in users get sent back into their own app rather than the marketing
  // homepage.
  const homeHref = profile ? roleHome[profile.role] : "/";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <div className="mx-auto max-w-md space-y-6">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
          <Compass className="h-7 w-7 text-muted-foreground" aria-hidden="true" />
        </div>

        <div className="space-y-2">
          <p className="data-chip">Error 404</p>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Page not found</h1>
          <p className="text-muted-foreground">
            We couldn&apos;t find{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-data text-[0.85em]">
              {location.pathname}
            </code>
            . It may have been moved or removed.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Go back
          </Button>
          <Button asChild>
            <Link to={homeHref}>{profile ? "Back to dashboard" : "Back to home"}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
