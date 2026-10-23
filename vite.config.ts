/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 5173,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  build: {
    // The app shipped as a single 1.5 MB chunk. Route-level `lazy()` in App.tsx
    // splits the pages; this splits the vendor code they share so the framework
    // and Supabase client stay cached independently of app releases.
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          supabase: ["@supabase/supabase-js"],
          forms: ["react-hook-form", "@hookform/resolvers", "zod"],
          // jsPDF is deliberately absent: lib/reports.ts imports it
          // dynamically so it only downloads when a report is exported.
        },
      },
    },
    chunkSizeWarningLimit: 700,
  },
}));
