import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3000,
    open: true,
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React
          react: ["react", "react-dom"],

          tanstack: ["@tanstack/react-table", "@tanstack/react-virtual"],

          xstate: ["xstate"],

          dateFns: ["date-fns"],

          papaparse: ["papaparse"],

          clsx: ["clsx"],

          dropzone: ["react-dropzone"],

          country: [
            "react-country-flag",
            "i18n-iso-countries",
            "country-codes-list",
          ],

          fuse: ["fuse.js"],

          tailwind: ["tailwindcss", "tailwind-merge"],

          // Phone number handling
          phone: ["libphonenumber-js"],
        },
      },
    },
  },
});
