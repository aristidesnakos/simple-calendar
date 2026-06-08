import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The Vitest config lives here too; the parser/ICS tests run in plain Node
// (no DOM needed) so the suite stays fast.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    include: ["src/**/*.test.js"],
  },
});
