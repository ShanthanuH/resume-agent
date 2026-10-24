import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // The same "@/..." shortcut the app uses (see paths in tsconfig.json).
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    // The tested code is plain logic: no browser is needed, so tests start fast.
    environment: "node",
    include: ["lib/**/*.test.ts", "scripts/**/*.test.ts"],
  },
});
