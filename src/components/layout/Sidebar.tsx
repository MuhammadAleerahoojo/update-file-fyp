import { Link, NavLink, useLocation } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  CalendarDays,
  FilePlus2,
  FileText,
  Gauge,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Upload,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ThemeToggle } from "./ThemeToggle";
import { Logo } from "./Logo";
import { useAuth, UserRole } from "@/context/AuthContext";

type SidebarProps = {
  userRole: UserRole;
};

type NavItem = { name: string; href: string; icon: typeof Gauge };

/**
 * Navigation per role.
 *
 * The admin list previously pointed at /admin/users, /admin/reports and
 * /admin/system — none of which are registered routes, so all three landed on
 * the 404 page. The patient list pointed at /settings, which only existed
 * behind the doctor guard and bounced patients back to their dashboard.
 */
const NAV_BY_ROLE: Record<UserRole, NavItem[]> = {
  patient: [
    { name: "Dashboard", href: "/dashboard", icon: Gauge },
    { name: "Upload scan", href: "/upload", icon: Upload },
    { name: "Appointments", href: "/appointments", icon: CalendarDays },
    { name: "Reports", href: "/reports", icon: FileText },
    { name: "Settings", href: "/settings", icon: Settings },
  ],
  doctor: [
    { name: "Dashboard", href: "/doctor/dashboard", icon: LayoutDashboard },
    { name: "Patients", href: "/doctor/patients", icon: Users },
    { name: "Appointments", href: "/doctor/appointments", icon: CalendarDays },
    { name: "Schedule", href: "/doctor/appointments/schedule", icon: FilePlus2 },
    { name: "Reports", href: "/doctor/reports", icon: FileText },
    { name: "Settings", href: "/doctor/settings", icon: Settings },
  ],
  admin: [
    { name: "Overview", href: "/admin/dashboard", icon: LayoutDashboard },
    { name: "Settings", href: "/admin/settings", icon: Settings },
  ],
};

function NavLinks({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  return (
    <nav className="grid gap-1 px-3" aria-label="Main">
      {items.map((item) => (
        <NavLink
          key={item.href}
          to={item.href}
          end
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium",
              "outline-none transition-colors duration-150",
              "focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar",
              isActive
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
            )
          }
        >
          {({ isActive }) => (
            <>
              <span
                aria-hidden="true"
                className={cn(
                  "absolute left-0 h-5 w-0.5 rounded-r-full bg-sidebar-primary transition-opacity",
                  isActive ? "opacity-100" : "opacity-0"
                )}
              />
              <item.icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
              {item.name}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

function UserPanel({ role }: { role: UserRole }) {
  const { profile, signOut } = useAuth();
  const initials =
    profile?.name
      ?.split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "U";

  return (
    <div className="border-t border-sidebar-border p-3">
      <div className="flex items-center gap-3 rounded-lg px-2 py-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-xs font-semibold text-sidebar-accent-foreground">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-sidebar-foreground">
            {profile?.name || "User"}
          </p>
          <p className="truncate text-xs capitalize text-sidebar-foreground/60">
            {profile?.role || role}
          </p>
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="mt-1 w-full justify-start gap-2 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
        onClick={signOut}
      >
        <LogOut className="h-4 w-4" />
        Sign out
      </Button>
    </div>
  );
}

export function Sidebar({ userRole }: SidebarProps) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const items = useMemo(() => NAV_BY_ROLE[userRole] ?? [], [userRole]);

  // Close the drawer on navigation so the mobile back button doesn't leave a
  // sheet floating over the new page.
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  return (
    <>
      {/* Mobile top bar */}
      <div className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-sidebar-border bg-sidebar px-4 text-sidebar-foreground md:hidden">
        <Link to="/" className="flex items-center gap-2">
          <Logo size="sm" />
        </Link>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
              >
                <Menu className="h-5 w-5" />
                <span className="sr-only">Open navigation</span>
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="flex w-72 flex-col gap-0 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground"
            >
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <div className="flex h-16 items-center border-b border-sidebar-border px-5">
                <Logo />
              </div>
              <div className="flex-1 overflow-y-auto py-4">
                <NavLinks items={items} onNavigate={() => setMobileOpen(false)} />
              </div>
              <UserPanel role={userRole} />
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Desktop sidebar */}
      {/* `text-sidebar-foreground` is required, not decorative: the sidebar is
          a dark slab in *both* themes, so anything inheriting the page's
          `--foreground` (near-black in light mode) renders invisible on it.
          The logo wordmark did exactly that. */}
      <aside
        aria-label="Sidebar"
        className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex"
      >
        <div className="flex h-16 shrink-0 items-center border-b border-sidebar-border px-5">
          <Link to="/" className="flex items-center gap-2.5">
            <Logo />
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto py-4">
          <NavLinks items={items} />
        </div>
        <UserPanel role={userRole} />
      </aside>
    </>
  );
}
