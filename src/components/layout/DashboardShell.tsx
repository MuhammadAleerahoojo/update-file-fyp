import { ReactNode, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { ThemeToggle } from "./ThemeToggle";
import { UserRole } from "@/context/AuthContext";

type DashboardShellProps = {
  children: ReactNode;
  userRole: UserRole;
};

export function DashboardShell({ children, userRole }: DashboardShellProps) {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname]);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar userRole={userRole} />

      {/* `md:pl-64` clears the fixed sidebar. The previous `md:ml-64` combined
          with Tailwind's centred `container` (2rem padding, 1400px cap) pushed
          content off-centre and let wide tables overflow the viewport. */}
      <div className="flex min-h-screen flex-col md:pl-64">
        {/* Desktop top bar. Dashboard users previously had no theme control at
            all — the toggle only existed in the public navbar. */}
        <header className="sticky top-0 z-20 hidden h-16 items-center justify-end gap-2 border-b border-border bg-background/80 px-6 backdrop-blur-md md:flex">
          <ThemeToggle />
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 md:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
