import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Check, Eye, EyeOff, Loader2, Mail, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase, isSupabaseConfigured, supabaseConfigError } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { roleHome } from "@/lib/roles";
import type { UserRole } from "@/context/AuthContext";

type AuthFormProps = {
  type: "login" | "signup";
};

const PASSWORD_RULES = [
  { label: "8+ characters", test: (v: string) => v.length >= 8 },
  { label: "Uppercase letter", test: (v: string) => /[A-Z]/.test(v) },
  { label: "Lowercase letter", test: (v: string) => /[a-z]/.test(v) },
  { label: "Number", test: (v: string) => /[0-9]/.test(v) },
  { label: "Special character", test: (v: string) => /[^A-Za-z0-9]/.test(v) },
];

const strongPassword = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Add at least one uppercase letter")
  .regex(/[a-z]/, "Add at least one lowercase letter")
  .regex(/[0-9]/, "Add at least one number")
  .regex(/[^A-Za-z0-9]/, "Add at least one special character");

/**
 * Login only checks that a password was typed.
 *
 * The old form applied the full complexity rules to sign-in too, so anyone
 * whose account predated those rules was told their own correct password was
 * invalid and could never get past client-side validation to find out.
 */
const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

const signupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().min(1, "Email is required").email("Enter a valid email address"),
  password: strongPassword,
  role: z.enum(["patient", "doctor"]),
});

type FormValues = {
  name?: string;
  email: string;
  password: string;
  role?: "patient" | "doctor";
};

export function AuthForm({ type }: AuthFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const isSignup = type === "signup";

  const form = useForm<FormValues>({
    resolver: zodResolver(isSignup ? signupSchema : loginSchema),
    defaultValues: isSignup
      ? { name: "", email: "", password: "", role: "patient" }
      : { email: "", password: "" },
  });

  const passwordValue = form.watch("password") ?? "";

  async function onSubmit(values: FormValues) {
    if (!isSupabaseConfigured) {
      toast.error(supabaseConfigError || "Supabase is not configured.");
      return;
    }

    setIsLoading(true);
    const email = values.email.toLowerCase().trim();

    try {
      if (!isSignup) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password: values.password,
        });

        if (error) {
          if (error.message.includes("Invalid login credentials")) {
            throw new Error("That email and password don't match an account.");
          }
          if (error.message.includes("Email not confirmed")) {
            throw new Error("Confirm your email address before signing in.");
          }
          throw error;
        }

        const { data: userProfile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", data.user.id)
          .maybeSingle();

        toast.success("Signed in.");

        // Send the user back where they were headed, if a guard bounced them.
        const from = (location.state as { from?: string } | null)?.from;
        const role = (userProfile?.role as UserRole) ?? "patient";
        navigate(from && from !== "/login" ? from : roleHome[role], { replace: true });
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password: values.password,
        options: {
          data: { name: values.name, role: values.role },
          emailRedirectTo: `${window.location.origin}/complete-profile`,
        },
      });

      if (error) {
        if (error.message.includes("User already registered")) {
          throw new Error("An account with this email already exists.");
        }
        if (error.message.includes("For security purposes")) {
          throw new Error("Please wait a moment before trying again.");
        }
        throw error;
      }

      if (data.user) {
        // NOTE: no client-side `profiles` insert here.
        //
        // The old form inserted the row itself, which almost always failed:
        // before email confirmation there's no session, so the "Users can
        // insert own profile" RLS policy rejects it, and the error was
        // swallowed with a console warning. supabase-setup.sql already installs
        // an `on_auth_user_created` trigger that creates the row server-side.
        toast.success("Account created. Check your email to confirm it.");
        navigate("/signup/confirm", {
          state: { email, name: values.name },
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message === "Failed to fetch" || (error as Error)?.name === "TypeError") {
        toast.error(
          "Can't reach Supabase. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env, then restart the dev server."
        );
      } else {
        toast.error(message || "Authentication failed. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card className="w-full">
      <CardHeader className="space-y-1.5">
        {/* A real <h1>. `CardTitle` renders an <h3>, which left the login and
            signup pages with no top-level heading at all — the first thing a
            screen reader announces on a page whose entire job is one form. */}
        <h1 className="font-display text-2xl font-semibold leading-tight tracking-tight">
          {isSignup ? "Create your account" : "Welcome back"}
        </h1>
        <CardDescription>
          {isSignup
            ? "A minute to sign up, then you're reading scans."
            : "Sign in to pick up where you left off."}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        {!isSupabaseConfigured && (
          <Alert variant="destructive">
            <AlertTitle>Supabase not connected</AlertTitle>
            <AlertDescription>
              Your <code className="font-data text-xs">.env</code> still has placeholder values. Add
              your Project URL and anon key from Supabase → Project Settings → API, then restart{" "}
              <code className="font-data text-xs">npm run dev</code>.
            </AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {isSignup && (
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full name</FormLabel>
                    <FormControl>
                      <Input placeholder="Jane Doe" autoComplete="name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  {/* FormControl clones its *direct child* and puts the
                      generated id on it. With a wrapper <div> inside, the id
                      landed on the div, so the label's htmlFor pointed at a
                      non-input and both fields had no accessible name at all.
                      The wrapper now lives outside FormControl. */}
                  <div className="relative">
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="name@example.com"
                        autoComplete="email"
                        className="pr-10"
                        {...field}
                      />
                    </FormControl>
                    <Mail
                      className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                      aria-hidden="true"
                    />
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <div className="relative">
                    <FormControl>
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        autoComplete={isSignup ? "new-password" : "current-password"}
                        className="pr-10"
                        {...field}
                      />
                    </FormControl>
                    <button
                      type="button"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => setShowPassword((prev) => !prev)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Live checklist beats discovering the five rules one failed
                submit at a time. */}
            {isSignup && passwordValue.length > 0 && (
              <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                {PASSWORD_RULES.map((rule) => {
                  const ok = rule.test(passwordValue);
                  return (
                    <li
                      key={rule.label}
                      className={cn(
                        "flex items-center gap-1.5 text-xs transition-colors",
                        ok ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                      )}
                    >
                      {ok ? (
                        <Check className="h-3 w-3 shrink-0" />
                      ) : (
                        <X className="h-3 w-3 shrink-0" />
                      )}
                      {rule.label}
                    </li>
                  );
                })}
              </ul>
            )}

            {isSignup && (
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>I am a</FormLabel>
                    <FormControl>
                      {/* Was a ToggleGroup, which allowed deselecting to an
                          empty value and left the form silently invalid. */}
                      <div role="radiogroup" className="grid grid-cols-2 gap-2">
                        {(["patient", "doctor"] as const).map((role) => (
                          <button
                            key={role}
                            type="button"
                            role="radio"
                            aria-checked={field.value === role}
                            onClick={() => field.onChange(role)}
                            className={cn(
                              "rounded-lg border py-2.5 text-sm font-medium capitalize transition-colors",
                              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                              field.value === role
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border text-muted-foreground hover:bg-muted"
                            )}
                          >
                            {role}
                          </button>
                        ))}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLoading
                ? isSignup
                  ? "Creating account…"
                  : "Signing in…"
                : isSignup
                  ? "Create account"
                  : "Sign in"}
            </Button>
          </form>
        </Form>
      </CardContent>

      <CardFooter>
        <p className="w-full text-center text-sm text-muted-foreground">
          {isSignup ? "Already have an account? " : "Don't have an account? "}
          <Link
            to={isSignup ? "/login" : "/signup"}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            {isSignup ? "Sign in" : "Sign up"}
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
