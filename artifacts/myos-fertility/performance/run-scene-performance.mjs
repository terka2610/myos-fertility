import { chromium, expect } from "@playwright/test";
import { spawn } from "node:child_process";
import { createWriteStream, existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { checkBudgets, percentile } from "./budgets.mjs";

const cwd = fileURLToPath(new URL("../", import.meta.url));
const output = fileURLToPath(new URL("../../../generated-artifacts/scene-performance/", import.meta.url));
const measureOnly = process.argv.includes("--measure");
const profileFilter = process.argv.find((arg) => arg.startsWith("--profile="))?.split("=")[1];
const runs = Number(process.argv.find((arg) => arg.startsWith("--runs="))?.split("=")[1] ?? 3);
if ((!measureOnly && (profileFilter || runs !== 3)) || !Number.isInteger(runs) || runs < 1) {
  throw new Error("Reduced runs/profiles are diagnostic only; use --measure. Gates always require both profiles and three runs.");
}
if (profileFilter && !["desktop", "mobile"].includes(profileFilter)) throw new Error("Unknown profile");
const views = ["network", "centre", "transport", "storage", "patient"];
const profiles = [
  { name: "desktop", viewport: { width: 1440, height: 1000 }, cpu: 1, network: null },
  { name: "mobile", viewport: { width: 390, height: 844 }, cpu: 4,
    network: { offline: false, latency: 150, downloadThroughput: 1_600_000 / 8, uploadThroughput: 750_000 / 8 } },
];
await mkdir(output, { recursive: true });

// Build and own a short-lived production test server, not another development
// workflow. Never measure Vite's module transforms or reuse a user's browser.
const port = await new Promise((resolve, reject) => {
  const socket = createServer();
  socket.on("error", reject);
  socket.listen(0, "127.0.0.1", () => {
    const port = socket.address().port;
    socket.close(() => resolve(port));
  });
});
const env = { ...process.env, PORT: String(port), BASE_PATH: "/", NITRO_PORT: String(port), NITRO_HOST: "127.0.0.1" };
const log = createWriteStream(`${output}/server.log`);
function start(command, args) {
  const child = spawn(command, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout.pipe(log, { end: false });
  child.stderr.pipe(log, { end: false });
  return child;
}
async function build() {
  const child = start("pnpm", ["run", "build"]);
  await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`Production build failed (${code}); see ${output}/server.log`)));
  });
}
const snapshot = (page) => page.evaluate(() => structuredClone(window.__MYOS_SCENE_PERF__));
async function rendered(page) {
  await page.waitForFunction(() => window.__MYOS_SCENE_PERF__?.readyAt != null, undefined, { timeout: 90_000 });
}
async function renderCost(page) {
  await page.evaluate(() => { window.__MYOS_SCENE_PERF__.samples = []; });
  await page.waitForTimeout(2000);
  const { samples } = await snapshot(page);
  expect(samples.length, "Actual rendered frames, not DOM presence").toBeGreaterThanOrEqual(5);
  const p95 = (key) => percentile(samples.map((sample) => sample[key]));
  return {
    sampledFrames: samples.length,
    cpuP95Ms: p95("cpuMs"),
    intervalP95Ms: percentile(samples.map((sample) => sample.intervalMs).filter((ms) => ms > 0)),
    calls: p95("calls"), triangles: p95("triangles"),
    geometries: p95("geometries"), textures: p95("textures"),
  };
}
async function expectPaused(page) {
  await expect.poll(async () => (await snapshot(page)).paused).toBe(true);
  await page.waitForTimeout(200); // Allow an already submitted frame to finish.
  const before = (await snapshot(page)).frames;
  await page.waitForTimeout(700);
  expect((await snapshot(page)).frames, "Paused scene must submit no frames").toBe(before);
}
async function expectResumed(page) {
  await expect.poll(async () => (await snapshot(page)).paused).toBe(false);
  const before = (await snapshot(page)).frames;
  await expect.poll(async () => (await snapshot(page)).frames).toBeGreaterThan(before);
}
async function pauseChecks(page, scene) {
  await page.getByTestId("button-place-centre").click();
  await expect.poll(async () => (await snapshot(page)).view).toBe("centre");
  await scene.scrollIntoViewIfNeeded();
  await scene.getByRole("button", { name: "Document check", exact: true }).click();
  await scene.getByTestId("button-feature-open-documents").click();
  const dialog = page.getByRole("dialog", { name: "Document Form" });
  await expect(dialog).toBeVisible();
  await expectPaused(page);
  await expect(scene.locator(".myos-pill, .myos-detail, .myos-placebar")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await scene.scrollIntoViewIfNeeded();
  await expectResumed(page);

  // Use real scrolling and the real IntersectionObserver, not a mocked callback.
  await page.locator("footer").last().scrollIntoViewIfNeeded();
  if (await scene.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return rect.bottom > 0 && rect.top < innerHeight;
  })) {
    // Mobile orders the work area before the scene; at the footer the scene
    // can still be visible. The top of this page puts it below the viewport.
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  }
  await expect.poll(() => scene.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return rect.bottom <= 0 || rect.top >= innerHeight;
  })).toBe(true);
  await expectPaused(page);
  await scene.scrollIntoViewIfNeeded();
  await expectResumed(page);

  // Headless tabs don't reliably become background tabs. Exercise the real
  // visibilitychange handler deterministically; rendering itself is not mocked.
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expectPaused(page);
  await page.evaluate(() => {
    delete document.hidden;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expectResumed(page);
}

let server;
let browser;
const report = {
  schemaVersion: 1, measuredAt: new Date().toISOString(),
  environment: { renderer: "Chromium SwiftShader (software WebGL)", profiles, runsPerProfile: runs,
    note: "Production Node server, no content compression; fresh contexts, disabled cache, no service workers. Frame CPU is submission cost, not GPU time." },
  runs: [], failures: [],
};
try {
  console.log("Building production app (build duration is not a performance metric)...");
  await build();
  server = start("node", [".output/server/index.mjs"]);
  server.once("error", (error) => { report.failures.push(error.message); });
  const url = `http://127.0.0.1:${port}/`;
  let online = false;
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw new Error(`Production server exited; see ${output}/server.log`);
    try { online = (await fetch(url)).ok; } catch { /* startup */ }
    if (online) break;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  if (!online) throw new Error("Production test server did not start");
  browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ?? (existsSync("/repl/tools/bin/chromium") ? "/repl/tools/bin/chromium" : undefined),
    args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
  report.environment.browser = browser.version();
  for (const profile of profiles) {
    if (profileFilter && profile.name !== profileFilter) continue;
    for (let iteration = 1; iteration <= runs; iteration++) {
      console.log(`${profile.name} cold run ${iteration}/${runs}: loading`);
      const context = await browser.newContext({
        viewport: profile.viewport, deviceScaleFactor: 1,
        isMobile: profile.name === "mobile", hasTouch: profile.name === "mobile",
        serviceWorkers: "block", reducedMotion: "reduce",
      });
      let page;
      try {
        page = await context.newPage();
        page.setDefaultTimeout(90_000);
        const errors = [];
        page.on("pageerror", (error) => errors.push(error.message));
        const cdp = await context.newCDPSession(page);
        await cdp.send("Network.enable");
        await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
        await cdp.send("Emulation.setCPUThrottlingRate", { rate: profile.cpu });
        if (profile.network) await cdp.send("Network.emulateNetworkConditions", profile.network);
        const types = new Map();
        let downloadBytes = 0;
        let scriptBytes = 0;
        cdp.on("Network.responseReceived", ({ requestId, type }) => types.set(requestId, type));
        cdp.on("Network.loadingFinished", ({ requestId, encodedDataLength }) => {
          downloadBytes += encodedDataLength;
          if (types.get(requestId) === "Script") scriptBytes += encodedDataLength;
        });
        await page.goto(`${url}clinic/samples?scenePerf=1`, { waitUntil: "domcontentloaded" });
        const scene = page.getByTestId("journey-scene");
        await expect(scene.locator("canvas")).toBeAttached({ timeout: 90_000 });
        await scene.scrollIntoViewIfNeeded();
        await rendered(page);
        const ready = await snapshot(page);
        console.log(`${profile.name} ${iteration}: rendered at ${Math.round(ready.readyAt)} ms; checking interaction`);
        const run = { profile: profile.name, iteration, readyMs: ready.readyAt, downloadBytes, scriptBytes, views: {} };
        // Verify a real pointer interaction, not just Canvas attachment or labels.
        const clickStart = await page.evaluate(() => performance.now());
        await page.getByTestId("button-place-centre").click();
        await scene.scrollIntoViewIfNeeded();
        await scene.getByRole("button", { name: "Document check", exact: true }).click();
        await expect(scene.getByTestId("panel-feature-detail")).toBeVisible();
        run.interactiveMs = await page.evaluate(() => performance.now());
        run.interactionMs = run.interactiveMs - clickStart;
        await scene.getByTestId("button-feature-close").click();
        for (const view of views) {
          console.log(`${profile.name} ${iteration}: sampling ${view}`);
          if (view === "network") await scene.getByTestId("button-scene-back").click();
          else await page.getByTestId(`button-place-${view}`).click();
          await scene.scrollIntoViewIfNeeded();
          await expect.poll(async () => (await snapshot(page)).view).toBe(view);
          await page.waitForTimeout(1500); // Exclude camera transitions/geometry startup.
          run.views[view] = await renderCost(page);
        }
        console.log(`${profile.name} ${iteration}: checking pause/resume`);
        report.runs.push(run);
        await pauseChecks(page, scene);
        expect(errors, "No uncaught errors during cold load or interaction").toEqual([]);
        run.pauseChecks = "passed: form, off-screen, visibilitychange handler, resume";
        console.log(JSON.stringify(run));
      } catch (error) {
        if (page) {
          console.error("Failure diagnostics:", await page.evaluate(() => ({
            metrics: window.__MYOS_SCENE_PERF__ ? {
              ...window.__MYOS_SCENE_PERF__,
              samples: window.__MYOS_SCENE_PERF__.samples.slice(-3),
            } : null,
            hidden: document.hidden,
            canvas: document.querySelector("canvas")?.getBoundingClientRect().toJSON(),
            stage: document.querySelector('[data-testid="journey-scene"]')?.getBoundingClientRect().toJSON(),
          })).catch(() => "Page unavailable"));
          await page.screenshot({ path: `${output}/${profile.name}-${iteration}-failure.png` }).catch(() => {});
        }
        throw error;
      } finally {
        await context.close();
      }
    }
  }
  if (!measureOnly) {
    const baseline = JSON.parse(await readFile(new URL("./scene-baseline.json", import.meta.url), "utf8"));
    report.failures.push(...checkBudgets(report, baseline));
  }
} catch (error) {
  report.failures.push(error.stack ?? String(error));
} finally {
  await browser?.close();
  if (server) {
    server.kill("SIGTERM");
    await Promise.race([
      new Promise((resolve) => server.once("exit", resolve)),
      new Promise((resolve) => setTimeout(() => { if (server.exitCode === null) server.kill("SIGKILL"); resolve(); }, 3000)),
    ]);
  }
  log.end();
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
}
if (report.failures.length) {
  console.error(report.failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`${measureOnly ? "Measurement" : "Performance gate"} passed. Report: ${output}/report.json`);
}
