import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Mirror the tsconfig "@/*" -> "./*" path alias so tests resolve app imports.
const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: { environment: "node" },
  resolve: {
    alias: { "@": root },
  },
});
