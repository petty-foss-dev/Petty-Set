import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1000,
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes("node_modules/jspdf") ||
            id.includes("node_modules/html2canvas")
          )
            return "export";
          if (
            id.includes("node_modules/three/src/renderers") ||
            id.includes("node_modules/three/src/materials")
          )
            return "three-renderer";
          if (id.includes("node_modules/three/")) return "three-core";
          if (id.includes("node_modules/@react-three/drei"))
            return "stage-controls";
          if (id.includes("node_modules/@react-three/fiber"))
            return "stage-react";
        },
      },
    },
  },
});
