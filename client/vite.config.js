import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Em dev, o front roda em :5173 e manda /api para o backend em :3001.
export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api": "http://localhost:3001" } },
});
