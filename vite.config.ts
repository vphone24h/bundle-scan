import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks: {
          // Core framework - loaded first, cached long-term
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-query': ['@tanstack/react-query'],
          // Supabase client - needed early for auth/data
          'vendor-supabase': ['@supabase/supabase-js'],
          // UI primitives - shared across pages
          'vendor-ui': [
            '@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-popover', '@radix-ui/react-select',
            '@radix-ui/react-tabs', '@radix-ui/react-tooltip',
            '@radix-ui/react-accordion', '@radix-ui/react-checkbox',
            '@radix-ui/react-switch', '@radix-ui/react-label',
          ],
          // i18n - only needed for admin pages, separate chunk
          'vendor-i18n': ['i18next', 'react-i18next'],
          // Charts - only loaded on reports page
          'vendor-charts': ['recharts'],
          // Heavy export libs - only loaded when exporting
          'vendor-export': ['xlsx', 'jspdf', 'file-saver', 'html2canvas'],
          // Sanitizer - used by store templates and editor
          'vendor-sanitize': ['dompurify'],
          // Date utils
          'vendor-date': ['date-fns'],
        },
      },
    },
  },
}));
