import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";

const port = Number(process.env.PORT);
if (!port || !process.env.BASE_PATH) {
  throw new Error("Start MYOS using its configured workflow so PORT and BASE_PATH are provided.");
}

export default defineConfig({
  base: process.env.BASE_PATH,
  plugins: [
    {
      name: "myos-exported-media",
      enforce: "pre",
      transform(code, id) {
        if (!id.endsWith(".asset.json") || !process.env.MYOS_ASSET_ORIGIN) return;
        const asset = JSON.parse(code);
        if (typeof asset.url !== "string" || !asset.url.startsWith("/__l5e/assets-v1/")) return;
        const origin = new URL(process.env.MYOS_ASSET_ORIGIN);
        if (origin.protocol !== "https:") throw new Error("MYOS_ASSET_ORIGIN must use HTTPS.");
        asset.url = new URL(asset.url, origin.origin).href;
        return { code: JSON.stringify(asset), map: null };
      },
    },
    tanstackStart({ server: { entry: "server" } }),
    nitro({ preset: "node-server" }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
    dedupe: ["react", "react-dom"],
  },
  // These two values are Supabase's intentionally public browser configuration.
  // Never add the service role key or other server credentials here.
  define: {
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(process.env.SUPABASE_URL || ""),
    "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(process.env.SUPABASE_PUBLISHABLE_KEY || ""),
  },
  server: { host: "0.0.0.0", port, strictPort: true, allowedHosts: true },
  preview: { host: "0.0.0.0", port, allowedHosts: true },
});
