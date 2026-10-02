import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(process.cwd(), "android-life-ops-native-entry.js"),
      name: "LifeRpgLifeOpsNative",
      formats: ["iife"],
      fileName: () => "android-life-ops-native.js"
    },
    outDir: resolve(process.cwd(), "dist"),
    emptyOutDir: false,
    minify: false
  }
});
