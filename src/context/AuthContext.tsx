import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from 'react';
import { supabase } from '@/lib/supabase';
import { Session, User } from '@supabase/supabase-js';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';

export type UserRole = 'patient' | 'doctor' | 'admin';

interface UserProfile {
  id: string;
  name: string;
  role: UserRole;
  email: string;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  /** True once we know whether the signed-in user has a patients/doctors row. */
  hasRoleRecord: boolean | null;
  /** Set when the profile lookup failed (network, RLS); `refreshProfile` retries it. */
  profileError: string | null;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

/** Routes a half-onboarded user is allowed to sit on without being bounced. */
/**
 * Roles a user may pick for themselves. `admin` is never self-assignable, and
 * `user_metadata` is writable by the user, so it must not be trusted for it.
 */
const SELF_SERVICE_ROLES: UserRole[] = ['patient', 'doctor'];

const ONBOARDING_SAFE_PATHS = ['/complete-profile', '/login', '/signup', '/signup/confirm'];

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [hasRoleRecord, setHasRoleRecord] = useState<boolean | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  // `location.pathname` is read inside a callback owned by a long-lived
  // Supabase subscription. Keeping it in a ref means that callback always sees
  // the current route instead of the one captured when it was registered.
  const pathnameRef = useRef(location.pathname);
  pathnameRef.current = location.pathname;

  const fetchedForUserId = useRef<string | null>(null);

  /**
   * Load the `profiles` row for a user, creating it from auth metadata if the
   * signup trigger never ran, then work out whether the role-specific
   * patients/doctors record exists yet.
   *
   * Previously this read the `user` state variable to build the fallback insert
   * — but on the initial `getSession()` pass that state is still `null`, so the
   * recovery path could never actually run.  Everything it needs is now passed
   * in explicitly.
   */
  const loadProfile = useCallback(
    async (authUser: User) => {
      // Sign-out or an account switch while a request is in flight must not let
      // the slow response overwrite the newer user's state.
      const isStale = () => fetchedForUserId.current !== authUser.id;
      setProfileError(null);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authUser.id)
          .maybeSingle();

        if (error) throw error;

        let resolved = data as UserProfile | null;

        if (!resolved) {
          const meta = authUser.user_metadata ?? {};
          const insert = {
            id: authUser.id,
            name: (meta.name as string) || '',
            email: (meta.email as string) || authUser.email || '',
            role: SELF_SERVICE_ROLES.includes(meta.role as UserRole)
              ? (meta.role as UserRole)
              : ('patient' satisfies UserRole),
            created_at: new Date().toISOString(),
          };

          const { data: created, error: insertError } = await supabase
            .from('profiles')
            .insert([insert])
            .select()
            .maybeSingle();

          if (insertError) {
            // RLS can legitimately block this before email confirmation. Fall
            // back to the metadata we already have so the app stays usable.
            resolved = { ...insert } as UserProfile;
          } else {
            resolved = created as UserProfile;
          }
        }

        if (isStale()) return;
        setProfile(resolved);

        if (resolved?.role === 'doctor' || resolved?.role === 'patient') {
          const table = resolved.role === 'doctor' ? 'doctors' : 'patients';
          const { data: roleRow } = await supabase
            .from(table)
            .select('id')
            .eq('user_id', resolved.id)
            .maybeSingle();

          if (isStale()) return;
          const exists = !!roleRow;
          setHasRoleRecord(exists);

          if (!exists && !ONBOARDING_SAFE_PATHS.includes(pathnameRef.current)) {
            navigate('/complete-profile', { replace: true });
          }
        } else {
          setHasRoleRecord(true);
        }
      } catch (err) {
        console.error('Failed to load user profile:', err);
        if (isStale()) return;
        setHasRoleRecord(null);
        setProfileError(
          err instanceof Error && err.message
            ? err.message
            : 'We could not load your profile. Check your connection and try again.'
        );
      } finally {
        if (!isStale()) setIsLoading(false);
      }
    },
    [navigate]
  );

  useEffect(() => {
    let active = true;

    supabase.auth
      .getSession()
      .then(({ data: { session: initialSession } }) => {
        if (!active) return;
        setSession(initialSession);
        setUser(initialSession?.user ?? null);
        if (initialSession?.user) {
          fetchedForUserId.current = initialSession.user.id;
          void loadProfile(initialSession.user);
        } else {
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to restore session:', err);
        if (active) setIsLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (nextSession?.user) {
        // Token refreshes fire this listener constantly. Only re-read the
        // profile when the identity actually changed.
        if (fetchedForUserId.current === nextSession.user.id) return;
        fetchedForUserId.current = nextSession.user.id;
        // Never show the previous account's profile while the new one loads.
        setProfile(null);
        setHasRoleRecord(null);
        setIsLoading(true);
        void loadProfile(nextSession.user);
      } else {
        fetchedForUserId.current = null;
        setProfile(null);
        setHasRoleRecord(null);
        setProfileError(null);
        // Cached clinical data must not outlive the session (shared computers).
        queryClient.clear();
        setIsLoading(false);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [loadProfile, queryClient]);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    await loadProfile(user);
  }, [user, loadProfile]);

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      // A failed network call must not leave the UI looking signed in.
      console.error('Sign-out request failed:', err);
    } finally {
      fetchedForUserId.current = null;
      queryClient.clear();
      setProfile(null);
      setHasRoleRecord(null);
      setProfileError(null);
      setSession(null);
      setUser(null);
      navigate('/login', { replace: true });
    }
  }, [navigate, queryClient]);

  const value = {
    session,
    user,
    profile,
    hasRoleRecord,
    profileError,
    refreshProfile,
    signOut,
    isLoading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
