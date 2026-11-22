import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";

// Use the already-running managed workflow through the shared preview proxy.
// Never start a second Vite server or use a persistent/user browser profile.
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:80/";
const target = new URL(baseURL);
if (!["localhost", "127.0.0.1"].includes(target.hostname) && !target.hostname.endsWith(".replit.dev")) {
  throw new Error("Workflow regression tests must target a local or Replit development preview.");
}
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
  ?? (existsSync("/repl/tools/bin/chromium") ? "/repl/tools/bin/chromium" : undefined);

export default defineConfig({
  testDir: "./e2e",
  testMatch: "workflow-panels.spec.ts",
  outputDir: "../../generated-artifacts/workflow-tests/results",
  reporter: [["list"], ["html", {
    outputFolder: "../../generated-artifacts/workflow-tests/report",
    open: "never",
  }]],
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: baseURL.endsWith("/") ? baseURL : `${baseURL}/`,
    browserName: "chromium",
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
    serviceWorkers: "block",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: {
      executablePath,
      args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
    },
  },
});
