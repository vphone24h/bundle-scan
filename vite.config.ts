import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const buildId = new Date().toISOString();

  return {
  define: {
    __APP_BUILD_ID__: JSON.stringify(buildId),
  },
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    mode === "production" && {
      name: "emit-build-version",
      generateBundle(_options: any, bundle: any) {
        bundle['version.json'] = {
          fileName: 'version.json',
          type: 'asset',
          source: JSON.stringify({ buildId }, null, 2),
        };
      },
    },
    mode === "production" && VitePWA({
      registerType: "autoUpdate",
      injectRegister: 'auto',
      selfDestroying: true,
      includeAssets: ["favicon.ico"],
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        globIgnores: ['**/version.json'],
        navigateFallbackDenylist: [/^\/~oauth/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/rodpbhesrwykmpywiiyd\.supabase\.co\/rest\/v1\/rpc\/(get_company_attendance_enabled|lookup_company_by_domain)$/i,
            handler: "NetworkOnly",
          },
          {
            urlPattern: /^https:\/\/rodpbhesrwykmpywiiyd\.supabase\.co\/rest\/v1\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              expiration: { maxEntries: 50, maxAgeSeconds: 300 },
            },
          },
        ],
      },
      manifest: {
        name: "VKHO - Quản lý chấm công",
        short_name: "VKHO",
        description: "Hệ thống quản lý chấm công và tính lương SaaS",
        theme_color: "#2563eb",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "portrait",
        start_url: "/checkin",
        icons: [
          { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png" },
          { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    cssMinify: 'esbuild',
    minify: 'esbuild',
    sourcemap: false,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Function-based manualChunks: more aggressive vendor splitting
        // so heavy libs only load when their consumer pages mount.
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined;

          // React core - must load first, cache long-term
          if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/scheduler/')) {
            return 'vendor-react';
          }
          if (id.includes('react-router')) return 'vendor-router';
          if (id.includes('@tanstack/react-query') || id.includes('@tanstack/query-')) {
            return 'vendor-query';
          }
          if (id.includes('@supabase')) return 'vendor-supabase';

          // Heavy libs — isolate so they only load when needed
          if (id.includes('recharts') || id.includes('d3-')) return 'vendor-charts';
          if (id.includes('/xlsx/')) return 'vendor-xlsx';
          if (id.includes('exceljs')) return 'vendor-exceljs';
          if (id.includes('html2canvas')) return 'vendor-html2canvas';
          if (id.includes('jspdf')) return 'vendor-jspdf';
          if (id.includes('qrcode') || id.includes('jsbarcode')) return 'vendor-qr';
          if (id.includes('framer-motion')) return 'vendor-motion';
          if (id.includes('dompurify')) return 'vendor-sanitize';
          if (id.includes('date-fns')) return 'vendor-date';
          if (id.includes('i18next')) return 'vendor-i18n';

          // Radix - many small packages, group together (shared across UI)
          if (id.includes('@radix-ui')) return 'vendor-radix';
          if (id.includes('lucide-react')) return 'vendor-icons';

          return 'vendor-misc';
        },
      },
    },
  },
  };
});
