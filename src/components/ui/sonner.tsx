import { Toaster as Sonner, toast } from "sonner"

import { useTheme } from "@/components/layout/ThemeProvider"

type ToasterProps = React.ComponentProps<typeof Sonner>

/**
 * Toast host.
 *
 * This read `useTheme()` from `next-themes`, but the app has never rendered a
 * next-themes provider — it uses its own ThemeProvider. The hook therefore
 * always fell back to "system", so toasts followed the OS setting and appeared
 * light-on-light whenever a user had explicitly chosen dark mode (or vice
 * versa). It now reads the app's own resolved theme.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const { resolvedTheme } = useTheme()

  return (
    <Sonner
      theme={resolvedTheme}
      className="toaster group"
      position="top-right"
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-card group-[.toaster]:text-card-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:rounded-xl",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          error: "group-[.toaster]:border-destructive/30",
          success: "group-[.toaster]:border-primary/30",
        },
      }}
      {...props}
    />
  )
}

export { Toaster, toast }
