import { expect, test as base, type Locator, type Page } from "@playwright/test";
import {
  createInitialSampleTransferState,
  SAMPLE_TRANSFER_STORAGE_KEY,
} from "../src/lib/demo/sample-transfer";

const state = createInitialSampleTransferState();
state.records["CLI-001"] = {
  ...state.records["CLI-001"]!,
  status: "draft",
  label: "Synthetic regression draft",
  notes: "Preserve this browser-local synthetic record.",
  updatedAt: "2026-01-01T12:00:00.000Z",
};
state.activity = [{
  id: "synthetic-regression-event",
  at: "2026-01-01T12:00:00.000Z",
  message: "CLI-001: Draft saved",
}];
export const savedState = { version: 2, ...state };

export const test = base.extend<{ backendWriteGuard: void }>({
  backendWriteGuard: [async ({ context }, use) => {
    const blocked: string[] = [];
    await context.route("**/*", async (route) => {
      const request = route.request();
      if (!["GET", "HEAD", "OPTIONS"].includes(request.method())
        || /\/api\/(?:[^/]+\/)*reset(?:[/-]|$)/i.test(new URL(request.url()).pathname)) {
        blocked.push(`${request.method()} ${new URL(request.url()).pathname}`);
        await route.abort("blockedbyclient");
      } else {
        await route.continue();
      }
    });
    // Each test has a disposable context. Seed only its missing demo key, and
    // never clear localStorage or overwrite it on reload.
    await context.addInitScript(({ key, value }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON.stringify(value));
    }, { key: SAMPLE_TRANSFER_STORAGE_KEY, value: savedState });
    await use();
    expect(blocked, "Workflow navigation must not write to or reset a backend").toEqual([]);
  }, { auto: true }],
});

export async function expectSavedStateUnchanged(page: Page) {
  await expect.poll(() => page.evaluate((key) => {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  }, SAMPLE_TRANSFER_STORAGE_KEY)).toEqual(savedState);
}

export async function openJourney(page: Page, place = "network") {
  await page.goto(`clinic/samples?place=${place}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("text-demo-warning")).toContainText("Synthetic demo");
  const wrapper = page.getByTestId("journey-scene");
  await wrapper.scrollIntoViewIfNeeded();
  const scene = wrapper.locator(".myos-scene");
  // No mocked Canvas: fallback or loading indefinitely must fail this suite.
  await expect(scene.locator("canvas")).toBeVisible({ timeout: 45_000 });
  await expectSavedStateUnchanged(page);
  return scene;
}

export const places = [
  { id: "centre", label: "Fertility clinic", features: ["Document check", "Consent records", "Shipment booking"] },
  { id: "transport", label: "Cryo transport", features: ["GPS monitor", "Time outside the freezer", "Witnessed pickup"] },
  { id: "storage", label: "Cryogenic storage", features: ["Acceptance check", "Witnessed storage", "Tank alerts"] },
  { id: "patient", label: "Patient", features: ["Cryo demo chat", "Where is my sample?"] },
] as const;

export async function choosePlace(page: Page, scene: Locator, place: typeof places[number]) {
  await page.getByTestId(`button-place-${place.id}`).click();
  await scene.scrollIntoViewIfNeeded();
  await expect(scene.getByRole("group", { name: place.label, exact: true })).toBeVisible();
  await expect(scene.locator(".tone-feature")).toHaveCount(place.features.length);
  for (const label of place.features) {
    await expect(scene.getByRole("button", { name: label, exact: true })).toBeVisible();
  }
  await expect(scene.getByTestId("panel-feature-detail")).toHaveCount(0);
}

/** Check actual browser rectangles, not CSS class names or screenshots alone. */
export async function expectNoOverlap(scene: Locator, selectors: string) {
  await expect.poll(() => scene.evaluate((root, selector) => {
    const bounds = root.getBoundingClientRect();
    const boxes = Array.from(root.querySelectorAll<HTMLElement>(selector))
      .filter((el) => {
        const style = getComputedStyle(el);
        return style.visibility !== "hidden" && style.display !== "none" && el.getClientRects().length > 0;
      })
      .map((el) => ({ name: el.getAttribute("aria-label") ?? el.textContent?.trim(), rect: el.getBoundingClientRect() }));
    const problems: string[] = [];
    for (const [i, a] of boxes.entries()) {
      if (a.rect.left < bounds.left - 1 || a.rect.right > bounds.right + 1
        || a.rect.top < bounds.top - 1 || a.rect.bottom > bounds.bottom + 1) {
        problems.push(`${a.name} is clipped by scene bounds`);
      }
      for (const b of boxes.slice(i + 1)) {
        const overlapWidth = Math.min(a.rect.right, b.rect.right) - Math.max(a.rect.left, b.rect.left);
        const overlapHeight = Math.min(a.rect.bottom, b.rect.bottom) - Math.max(a.rect.top, b.rect.top);
        if (overlapWidth > 1 && overlapHeight > 1) problems.push(`${a.name} overlaps ${b.name}`);
      }
    }
    return problems;
  }, selectors), { message: "Visible scene controls and labels should be separate and inside the scene" }).toEqual([]);
}
