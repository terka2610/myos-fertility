import { expect } from "@playwright/test";
import {
  choosePlace,
  expectNoOverlap,
  expectSavedStateUnchanged,
  openJourney,
  places,
  test,
} from "./workflow-fixture";

test("overview stays sparse; every place reveals only the chosen detail", async ({ page }) => {
  const scene = await openJourney(page);
  await expect(scene.locator(".tone-default")).toHaveCount(4);
  await expect(scene.locator("aside, .myos-card, .myos-detail, .myos-placebar")).toHaveCount(0);
  await expect(scene.locator("p, h1, h2, h3")).toHaveCount(0);

  for (const place of places) {
    await choosePlace(page, scene, place);
    for (const label of place.features) {
      await scene.getByRole("button", { name: label, exact: true }).click();
      const detail = scene.getByTestId("panel-feature-detail");
      await expect(detail).toHaveCount(1);
      await expect(detail).toHaveAccessibleName(label);
      await expect(detail.getByRole("heading", { name: label, exact: true })).toBeVisible();
      await expect(detail.locator("p")).toBeVisible();
      await expect(scene.locator("aside")).toHaveCount(1);
    }
    // Clicking the selected pin toggles it closed; close-button dismissal also works.
    const last = place.features[place.features.length - 1];
    await scene.getByRole("button", { name: last, exact: true }).click();
    await expect(scene.getByTestId("panel-feature-detail")).toHaveCount(0);
    await scene.getByRole("button", { name: place.features[0], exact: true }).click();
    await scene.getByTestId("button-feature-close").click();
    await expect(scene.getByTestId("panel-feature-detail")).toHaveCount(0);
  }
  await scene.getByTestId("button-scene-back").click();
  await expect(scene.locator(".tone-default")).toHaveCount(4);
  await expect(scene.locator("aside, .myos-placebar, p, h1, h2, h3")).toHaveCount(0);
  await expectSavedStateUnchanged(page);
});

test("forms hide all overlays; dismissing restores navigation without changing saved data", async ({ page }) => {
  const scene = await openJourney(page, "centre");
  await scene.getByRole("button", { name: "Document check", exact: true }).click();
  await scene.getByTestId("button-feature-open-documents").click();
  const dialog = page.getByRole("dialog", { name: "Document Form" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Record Title", { exact: true })).toHaveValue("Synthetic regression draft");
  await expect(dialog.getByLabel("Additional Notes", { exact: true }))
    .toHaveValue("Preserve this browser-local synthetic record.");
  await expect(scene.locator(".myos-pill, .myos-detail, .myos-placebar, .myos-nav")).toHaveCount(0);
  await expect(scene.locator("canvas")).toBeAttached();

  // Typing a feature shortcut in a form must not change the scene selection.
  await dialog.getByLabel("Record Title", { exact: true }).fill("Unsaved synthetic draft 2");
  await dialog.getByLabel("Record Title", { exact: true }).press("2");
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await scene.scrollIntoViewIfNeeded();
  await expect(scene.getByTestId("panel-feature-detail")).toHaveAccessibleName("Document check");
  await expect(scene.getByTestId("button-scene-back")).toBeVisible();
  await scene.getByRole("button", { name: "Consent records", exact: true }).click();
  await expect(scene.getByTestId("panel-feature-detail")).toHaveAccessibleName("Consent records");
  await expect(scene.getByTestId("panel-feature-detail")).toHaveCount(1);

  // The work-area entry point must hide an already-selected scene detail too.
  await page.getByTestId("button-open-CLI-001").click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Record Title", { exact: true })).toHaveValue("Synthetic regression draft");
  await expect(scene.locator(".myos-pill, .myos-detail, .myos-placebar, .myos-nav")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await scene.scrollIntoViewIfNeeded();
  await expect(scene.getByTestId("panel-feature-detail")).toHaveAccessibleName("Consent records");
  await scene.getByTestId("button-scene-back").click();
  await expect(scene.locator(".tone-default")).toHaveCount(4);
  await expectSavedStateUnchanged(page);
  await page.reload();
  // Reload uses the URL's initial place, not the previous in-memory selection.
  await expect(scene.locator(".tone-feature")).toHaveCount(3);
  await expect(scene.getByTestId("panel-feature-detail")).toHaveCount(0);
  await expectSavedStateUnchanged(page);
});

test("AI form and voice checks stay local without synthetic-data consent", async ({ page }) => {
  const reviewRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/_serverFn/")) reviewRequests.push(request.method());
  });
  const scene = await openJourney(page, "centre");
  await scene.getByRole("button", { name: "Document check", exact: true }).click();
  await scene.getByTestId("button-feature-open-documents").click();
  const dialog = page.getByRole("dialog", { name: "Document Form" });
  await expect(dialog).toBeVisible();

  await expect(dialog.getByTestId("checkbox-synthetic-ai")).not.toBeChecked();
  await dialog.getByTestId("button-validate-form").click();
  await expect(dialog.getByRole("status").filter({ hasText: "AI review is off" })).toBeVisible();

  await dialog.getByRole("button", { name: "Fill by Voice" }).click();
  const transcript = dialog.getByLabel("Recognized transcript (or type/paste)");
  await transcript.fill("Destination Demo Storage");
  await expect(dialog.getByTestId("checkbox-voice-synthetic-ai")).not.toBeChecked();
  await dialog.getByTestId("button-ai-voice-review").click();
  await expect(
    dialog.getByRole("status").filter({
      hasText: "AI review is off. Local matching ran only",
    }),
  ).toBeVisible();
  expect(reviewRequests).toEqual([]);
});

for (const width of [390, 320]) {
  test(`mobile ${width}px: labels, navigation and selected details do not overlap`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    const scene = await openJourney(page);
    for (const label of await scene.locator(".tone-default").all()) await expect(label).toBeHidden();
    await expect(scene.locator("aside, .myos-placebar, p, h1, h2, h3")).toHaveCount(0);
    await expectNoOverlap(page.getByRole("navigation", { name: "Choose a journey step" }), "button");

    for (const place of places) {
      await choosePlace(page, scene, place);
      await expectNoOverlap(scene, ".myos-pill, .myos-placebar");
      for (const pin of await scene.locator(".tone-feature").all()) {
        await expect(pin.locator(".myos-pill-text")).toBeHidden();
        await expect(pin.locator(".myos-num")).toBeVisible();
      }
      await scene.getByRole("button", { name: place.features[0], exact: true }).click();
      await expect(scene.getByTestId("panel-feature-detail")).toHaveCount(1);
      await expectNoOverlap(scene, ".myos-pill, .myos-placebar, .myos-detail");
      await scene.getByTestId("button-feature-close").click();
    }
    await expectSavedStateUnchanged(page);
  });
}
