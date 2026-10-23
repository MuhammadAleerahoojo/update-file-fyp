import { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RotateCcw } from "lucide-react";

type Props = { children: ReactNode };
type State = { error: Error | null };

/**
 * Catches render-time crashes so a single bad component doesn't leave the user
 * staring at a blank white page with no way to recover.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled UI error:", error, info.componentStack);
  }

  private reset = () => {
    this.setState({ error: null });
    window.location.assign("/");
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="w-full max-w-md space-y-5 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <div className="space-y-2">
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              Something went wrong
            </h1>
            <p className="text-sm text-muted-foreground">
              The page hit an unexpected error. Your data is safe — reloading usually clears it.
            </p>
          </div>
          {import.meta.env.DEV && (
            <pre className="max-h-40 overflow-auto rounded-lg border border-border bg-muted p-3 text-left font-data text-[11px] leading-relaxed text-muted-foreground">
              {error.message}
            </pre>
          )}
          <Button onClick={this.reset}>
            <RotateCcw className="mr-2 h-4 w-4" /> Back to safety
          </Button>
        </div>
      </div>
    );
  }
}
