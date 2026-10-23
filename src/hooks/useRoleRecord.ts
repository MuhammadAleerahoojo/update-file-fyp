import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

export type PatientRecord = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  gender: string | null;
  date_of_birth: string | null;
};

export type DoctorRecord = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  specialization: string | null;
};

/**
 * The signed-in user's `patients` row.
 *
 * Nearly every patient screen opened with its own
 * `from('patients').select('id').eq('user_id', …)` round-trip, and the
 * dashboard did it twice on a single mount (once for appointments, once for
 * reports). React Query dedupes and caches it for the session instead.
 */
export function usePatientRecord() {
  const { user, profile } = useAuth();
  const enabled = !!user && profile?.role === "patient";

  return useQuery({
    queryKey: ["patient-record", user?.id],
    enabled,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<PatientRecord | null> => {
      const { data, error } = await supabase
        .from("patients")
        .select("id, first_name, last_name, gender, date_of_birth")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data as PatientRecord) ?? null;
    },
  });
}

/** The signed-in user's `doctors` row, cached the same way. */
export function useDoctorRecord() {
  const { user, profile } = useAuth();
  const enabled = !!user && profile?.role === "doctor";

  return useQuery({
    queryKey: ["doctor-record", user?.id],
    enabled,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<DoctorRecord | null> => {
      const { data, error } = await supabase
        .from("doctors")
        .select("id, first_name, last_name, specialization")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data as DoctorRecord) ?? null;
    },
  });
}
