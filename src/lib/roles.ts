import type { UserRole } from "@/context/AuthContext";

/** Where each role should land when it hits a page it isn't allowed to see. */
export const roleHome: Record<UserRole, string> = {
  patient: "/dashboard",
  doctor: "/doctor/dashboard",
  admin: "/admin/dashboard",
};

/** Role-scoped route for the shared Settings screen. */
export const settingsPath: Record<UserRole, string> = {
  patient: "/settings",
  doctor: "/doctor/settings",
  admin: "/admin/settings",
};
