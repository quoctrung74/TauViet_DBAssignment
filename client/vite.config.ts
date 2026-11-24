import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Cấu hình Vite độc lập. Không cần file nội bộ .figma/make/site.json.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173, host: "127.0.0.1" },
  preview: { port: 4173, host: "127.0.0.1" },
});
