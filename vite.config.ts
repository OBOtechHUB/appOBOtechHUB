import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import tsconfigPaths from "vite-tsconfig-paths";

// VITE_BASE: percorso di pubblicazione. Su GitHub Pages "/<nome-repository>/", in locale "/".
export default defineConfig({
  base: process.env["VITE_BASE"] ?? "/",
  plugins: [
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    tsconfigPaths(),
  ],
  resolve: { dedupe: ["react", "react-dom", "@tanstack/react-router"] },
});
