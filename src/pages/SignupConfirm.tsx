import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export default function SignupConfirm() {
  const location = useLocation();
  const navigate = useNavigate();
  const { email, name } = location.state || {};
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    if (!email) {
      navigate("/signup");
    }
  }, [email, navigate]);

  const handleResendEmail = async () => {
    if (!email) return;
    
    setIsResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: `${window.location.origin}/complete-profile`
        }
      });

      if (error) throw error;
      
      toast.success("Confirmation email resent successfully!");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to resend confirmation email";
      toast.error(message);
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="flex items-center justify-center py-16">
        <div className="container px-4 md:px-6">
          <Card className="w-full max-w-md mx-auto">
            <CardHeader>
              <div className="flex justify-center mb-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Mail className="h-6 w-6 text-primary" />
                </div>
              </div>
              <CardTitle className="text-2xl font-bold text-center">
                Check your email
              </CardTitle>
              <CardDescription className="text-center">
                We've sent a confirmation link to {email}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground text-center">
                <p>Hi {name},</p>
                <p className="mt-2">
                  Please check your email and click the confirmation link to activate your account.
                  If you don't see the email, check your spam folder.
                </p>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => navigate("/login")}
              >
                Back to login
              </Button>
              <Button
                className="w-full"
                onClick={handleResendEmail}
                disabled={isResending}
              >
                {isResending ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Resending...
                  </div>
                ) : (
                  "Resend confirmation email"
                )}
              </Button>
            </CardFooter>
          </Card>
        </div>
    </div>
  );
} 