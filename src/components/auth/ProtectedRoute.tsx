import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth, UserRole } from '@/context/AuthContext';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { FullPageLoader } from '@/components/layout/FullPageLoader';
import { roleHome } from '@/lib/roles';
import { Button } from '@/components/ui/button';

interface ProtectedRouteProps {
  requiredRole?: UserRole;
}

export function ProtectedRoute({ requiredRole }: ProtectedRouteProps) {
  const { user, profile, profileError, isLoading, refreshProfile, signOut } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <FullPageLoader label="Checking your session…" />;
  }

  if (!user) {
    // Remember where they were heading so login can send them back.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  // The lookup failed outright: a spinner here would never resolve.
  if (!profile && profileError) {
    return (
      <div role="alert" className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="font-display text-xl font-semibold">We couldn't load your profile</h1>
        <p className="max-w-md text-sm text-muted-foreground">{profileError}</p>
        <div className="flex gap-2">
          <Button onClick={() => void refreshProfile()}>Try again</Button>
          <Button variant="outline" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </div>
    );
  }

  // The profile row is still resolving. Showing the spinner beats flashing a
  // redirect and bouncing the user somewhere they didn't ask for.
  if (!profile) {
    return <FullPageLoader label="Loading your profile…" />;
  }

  if (requiredRole && profile.role !== requiredRole) {
    // Previously this returned `null` for any pairing without an explicit rule
    // (e.g. an admin opening a patient page), leaving a blank white screen.
    return <Navigate to={roleHome[profile.role]} replace />;
  }

  return (
    <DashboardShell userRole={profile.role}>
      <Outlet />
    </DashboardShell>
  );
}
