import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const versionFilePath = resolve(__dirname, "../VERSION");
const appVersion = existsSync(versionFilePath)
  ? readFileSync(versionFilePath, "utf8").trim() || "dev"
  : "dev";

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  build: {
    outDir: "dist",
  },
});
