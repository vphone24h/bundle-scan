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
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        // Conservative chunking: only split a few stable, shared vendors.
        // Heavy libs (xlsx/jspdf/html2canvas/recharts/qrcode) are left to
        // Rollup so they stay co-located with the lazy page that imports them
        // and don't end up preloaded on initial app boot.
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom', 'scheduler'],
          'vendor-query': [
            '@tanstack/react-query',
            '@tanstack/react-query-persist-client',
            '@tanstack/query-sync-storage-persister',
          ],
          'vendor-supabase': ['@supabase/supabase-js'],
        },
      },
    },
  },
  };
});
