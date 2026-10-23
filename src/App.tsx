import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { AuthProvider } from "@/context/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { FullPageLoader } from "@/components/layout/FullPageLoader";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Eager: the three entry points a cold visitor is most likely to hit.
import Home from "./pages/Home";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

// Everything else is code-split. The whole app used to ship as one 1.5 MB
// bundle, so a patient checking an appointment also downloaded jsPDF,
// html2canvas, recharts and every doctor/admin screen before first paint.
const Signup = lazy(() => import("./pages/Signup"));
const SignupConfirm = lazy(() => import("./pages/SignupConfirm"));
const CompleteProfile = lazy(() => import("./pages/CompleteProfile"));

const About = lazy(() => import("./pages/About"));
const Contact = lazy(() => import("./pages/Contact"));
const Features = lazy(() => import("./pages/Features"));
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Blog = lazy(() => import("./pages/Blog"));
const CaseStudies = lazy(() => import("./pages/CaseStudies"));
const Support = lazy(() => import("./pages/Support"));
const Documentation = lazy(() => import("./pages/Documentation"));

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Upload = lazy(() => import("./pages/Upload"));
const Appointments = lazy(() => import("./pages/Appointments"));
const BookAppointment = lazy(() => import("./pages/BookAppointment"));
const Reports = lazy(() => import("./pages/Reports"));
const Settings = lazy(() => import("./pages/Settings"));

const DoctorDashboard = lazy(() => import("./pages/DoctorDashboard"));
const Patients = lazy(() => import("./pages/Patients"));
const NewPatient = lazy(() => import("./pages/NewPatient"));
const DoctorAppointments = lazy(() => import("./pages/DoctorAppointments"));
const NewAppointment = lazy(() => import("./pages/NewAppointment"));
const DoctorSchedule = lazy(() => import("./pages/DoctorSchedule"));
const NewReport = lazy(() => import("./pages/NewReport"));
const NewConsultation = lazy(() => import("./pages/NewConsultation"));

const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Medical data changes rarely within a session; don't refetch on every
      // window focus.
      refetchOnWindowFocus: false,
      staleTime: 30_000,
      retry: 1,
    },
  },
});

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system">
        <TooltipProvider delayDuration={200}>
          <BrowserRouter>
            <AuthProvider>
              <Toaster />
              <Suspense fallback={<FullPageLoader />}>
                <Routes>
                  {/* Public marketing + auth pages, all sharing the same
                      navbar/footer chrome. */}
                  <Route element={<PublicLayout />}>
                    <Route path="/" element={<Home />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/signup" element={<Signup />} />
                    <Route path="/signup/confirm" element={<SignupConfirm />} />
                    <Route path="/about" element={<About />} />
                    <Route path="/contact" element={<Contact />} />
                    <Route path="/features" element={<Features />} />
                    <Route path="/terms" element={<Terms />} />
                    <Route path="/privacy" element={<Privacy />} />
                    <Route path="/blog" element={<Blog />} />
                    <Route path="/case-studies" element={<CaseStudies />} />
                    <Route path="/support" element={<Support />} />
                    <Route path="/documentation" element={<Documentation />} />
                  </Route>

                  {/* Onboarding sits outside both shells — the user has an
                      account but no role record yet. */}
                  <Route path="/complete-profile" element={<CompleteProfile />} />

                  {/* Patient */}
                  <Route element={<ProtectedRoute requiredRole="patient" />}>
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/appointments" element={<Appointments />} />
                    <Route path="/appointments/new" element={<BookAppointment />} />
                    <Route path="/upload" element={<Upload />} />
                    <Route path="/reports" element={<Reports />} />
                    {/* The patient sidebar always linked to /settings, but the
                        route only existed under the doctor guard — so patients
                        were bounced straight back to the dashboard. */}
                    <Route path="/settings" element={<Settings />} />
                  </Route>

                  {/* Doctor */}
                  <Route element={<ProtectedRoute requiredRole="doctor" />}>
                    <Route path="/doctor/dashboard" element={<DoctorDashboard />} />
                    <Route path="/doctor/patients" element={<Patients />} />
                    <Route path="/doctor/patients/new" element={<NewPatient />} />
                    <Route path="/doctor/appointments" element={<DoctorAppointments />} />
                    <Route path="/doctor/appointments/new" element={<NewAppointment />} />
                    <Route path="/doctor/appointments/schedule" element={<DoctorSchedule />} />
                    <Route path="/doctor/reports" element={<Reports />} />
                    <Route path="/doctor/reports/new" element={<NewReport />} />
                    <Route path="/doctor/consultations" element={<NewConsultation />} />
                    <Route path="/doctor/settings" element={<Settings />} />
                  </Route>

                  {/* Admin */}
                  <Route element={<ProtectedRoute requiredRole="admin" />}>
                    <Route path="/admin/dashboard" element={<AdminDashboard />} />
                    <Route path="/admin/settings" element={<Settings />} />
                  </Route>

                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
