import { Outlet, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";

/**
 * Chrome for every non-dashboard page.
 *
 * About, Features, Contact, Blog, Case Studies, Support, Documentation, Terms
 * and Privacy all rendered as bare content with no header and no footer, so
 * anyone who followed a footer link landed on a page with no way back. They now
 * share this layout, which also restores scroll-to-top between routes.
 */
export function PublicLayout() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
