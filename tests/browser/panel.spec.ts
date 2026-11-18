import { expect, test, type Page } from "@playwright/test";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { curveTarget, motionBlurTarget } from "../fixtures/curve-target";

async function attachHost(
  page: Page,
  options: {
    ambiguous?: boolean;
    reject?: boolean;
    blur?: boolean;
    noPair?: boolean;
    multipleBlur?: boolean;
    /** Milliseconds each ExtendScript round trip takes. */
    delay?: number;
  } = {},
) {
  await page.addInitScript(
    ({ target, blur, options }) => {
      let active = target;
      let activeBlur = blur;
      let transformAdded = false;
      const requests: {
        operation: string;
        payload: Record<string, unknown>;
      }[] = [];
      Object.assign(window, {
        curveRequests: requests,
        __adobe_cep__: {
          evalScript(script: string, reply: (value: string) => void) {
            const callback = (value: string) =>
              options.delay
                ? setTimeout(() => reply(value), options.delay)
                : reply(value);
            const encoded = JSON.parse(
              script.slice(script.indexOf("decodeURIComponent(") + 19, -2),
            );
            const request = JSON.parse(decodeURIComponent(encoded));
            requests.push(request);
            if (request.operation === "inspect") {
              const targets = options.noPair ? [] : [active];
              if (options.ambiguous)
                targets.push({
                  ...active,
                  id: "rotation",
                  label: "Motion / Rotation",
                  kind: "rotation",
                  startValue: 0,
                  endValue: 90,
                } as typeof active);
              callback(
                JSON.stringify({
                  protocol: 2,
                  ok: true,
                  data: {
                    hostVersion: "26.5.1",
                    targets,
                    message: "",
                    motionBlur: {
                      clipName: "mouse-arrow.png",
                      selectedClips: 1,
                      selectionToken: "selection-1",
                      targets:
                        options.blur || transformAdded
                          ? options.multipleBlur
                            ? [
                                activeBlur,
                                {
                                  ...activeBlur,
                                  id: "transform-2",
                                  label: "Transform (4)",
                                },
                              ]
                            : [activeBlur]
                          : [],
                      message: "Add the Transform effect to the selected clip.",
                    },
                  },
                }),
              );
            } else if (request.operation === "add-transform") {
              transformAdded = true;
              callback(
                JSON.stringify({
                  protocol: 2,
                  ok: true,
                  data: {
                    added: 1,
                    message:
                      "Transform added to mouse-arrow.png. Animate its Position, Scale or Rotation to see motion blur.",
                    transformId: activeBlur.id,
                  },
                }),
              );
            } else if (options.reject)
              callback(
                JSON.stringify({
                  protocol: 2,
                  ok: false,
                  error: "The keyframes changed after the preview.",
                }),
              );
            else if (request.operation === "apply-motion-blur") {
              activeBlur = {
                ...request.payload.target,
                shutterAngle: request.payload.shutterAngle,
                useCompositionShutterAngle: false,
                stateToken: `shutter-${request.payload.shutterAngle}`,
              };
              callback(
                JSON.stringify({
                  protocol: 2,
                  ok: true,
                  data: {
                    target: activeBlur,
                    message:
                      activeBlur.shutterAngle === 0
                        ? "Motion blur disabled for this Transform effect."
                        : `Motion blur applied at ${activeBlur.shutterAngle} degrees. Check playback in Premiere.`,
                  },
                }),
              );
            } else {
              active = {
                ...request.payload.target,
                rangeToken: "updated-pair",
              };
              callback(
                JSON.stringify({
                  protocol: 2,
                  ok: true,
                  data: {
                    keyframesWritten: request.payload.plan.samples.length - 2,
                    message: "Curve applied.",
                    target: active,
                  },
                }),
              );
            }
          },
        },
      });
    },
    { target: curveTarget, blur: motionBlurTarget, options },
  );
}

test("loads the production curve editor directly from disk", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(pathToFileURL(resolve("dist/index.html")).href);
  await expect(
    page.getByRole("heading", { name: "Z Motion", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Apply animation" }),
  ).toBeDisabled();
  await expect(page.getByRole("tab")).toHaveCount(0);
  expect(errors).toEqual([]);
});

for (const width of [280, 400, 1100]) {
  test(`motion blur controls fit at ${width}px without movement-generation controls`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/");
    await page.getByRole("button", { name: "360°", exact: true }).click();
    await expect(page.getByLabel("Shutter angle (°)")).toHaveValue("360");
    await expect(
      page.getByRole("button", { name: "Apply blur to clip" }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Create movement" }),
    ).toHaveCount(0);
    await expect(page.getByRole("tab")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Apply animation" }),
    ).toBeInViewport();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `artifacts/motion-blur-${width}.png`,
      fullPage: true,
      animations: "disabled",
    });
  });
}

test("applies and disables blur without writing animation or needing a current keyframe pair", async ({
  page,
}) => {
  await attachHost(page, { blur: true, noPair: true });
  await page.setViewportSize({ width: 400, height: 1100 });
  await page.goto("/");
  await page.locator(".workspace").hover();
  await expect(page.getByText("Current: composition")).toBeVisible();
  await expect(page.getByText("Clip: mouse-arrow.png")).toBeVisible();
  await page.getByRole("button", { name: "Refresh clip" }).click();
  await expect(
    page.getByRole("button", { name: "Apply blur to clip" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "180°", exact: true }).click();
  await page.screenshot({
    path: "artifacts/motion-blur-connected.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Apply blur to clip" }).click();
  await expect(page.getByRole("status")).toContainText("180 degrees");
  await expect(page.getByText("Current: 180°")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Apply animation" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Off", exact: true }).click();
  await page.getByRole("button", { name: "Apply blur to clip" }).click();
  await expect(page.getByRole("status")).toContainText("disabled");
  const mutations = await page.evaluate(() =>
    (
      window as unknown as {
        curveRequests: { operation: string; payload: unknown }[];
      }
    ).curveRequests.filter((request) => request.operation !== "inspect"),
  );
  expect(mutations.map((request) => request.operation)).toEqual([
    "apply-motion-blur",
    "apply-motion-blur",
  ]);
  expect(mutations[0].payload).toEqual({
    target: motionBlurTarget,
    shutterAngle: 180,
  });
});

test("blurs every checked Transform and names native errors", async ({
  page,
}) => {
  await attachHost(page, { blur: true, multipleBlur: true, reject: true });
  await page.goto("/");
  await page.locator(".workspace").hover();
  await expect(
    page.getByRole("button", { name: "Transform effects to blur: 2 of 2" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Apply blur to clip" }).click();
  const blur = page.getByRole("region", { name: "Motion blur" });
  await expect(blur.getByRole("alert")).toContainText(
    "Transform (3): The keyframes changed after the preview.",
  );
  await expect(blur.getByRole("alert")).toContainText("Transform (4):");
  await expect(page.getByRole("status")).toHaveCount(0);
});

test("the Transform picker limits motion blur in a 280×400 panel", async ({
  page,
}) => {
  await attachHost(page, { blur: true, multipleBlur: true, noPair: true });
  await page.setViewportSize({ width: 280, height: 400 });
  await page.goto("/");
  await page.locator(".workspace").hover();
  const summary = page.getByRole("button", {
    name: "Transform effects to blur: 2 of 2",
  });
  await expect(summary).toContainText("Blurs Transform (3), Transform (4)");
  await summary.click();
  const dialog = page.getByRole("dialog", {
    name: "Transform effects to blur",
  });
  await expect(dialog).toBeInViewport({ ratio: 1 });
  await dialog.getByRole("checkbox", { name: /Transform \(3\)/ }).uncheck();
  await page.screenshot({
    path: "artifacts/blur-picker-280x400.png",
    animations: "disabled",
  });
  await dialog.getByRole("button", { name: "Done" }).click();
  await page.getByRole("button", { name: "Apply blur to clip" }).click();
  await expect(
    page.getByRole("region", { name: "Motion blur" }).getByRole("status"),
  ).toContainText("180 degrees");
  const blurred = await page.evaluate(() =>
    (
      window as unknown as {
        curveRequests: {
          operation: string;
          payload: { target: { id: string } };
        }[];
      }
    ).curveRequests
      .filter((request) => request.operation === "apply-motion-blur")
      .map((request) => request.payload.target.id),
  );
  expect(blurred).toEqual(["transform-2"]);
});

for (const width of [280, 400, 1100]) {
  test(`curve graph fits at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/");
    await page.locator(".workspace").hover();
    await page.getByRole("button", { name: "Overshoot", exact: true }).click();
    await expect(page.getByLabel("Curve Y1")).toHaveValue("1.56");
    await page
      .getByRole("button", { name: "First curve handle", exact: false })
      .focus();
    await page.keyboard.press("ArrowLeft");
    await expect(page.getByLabel("Curve X1")).toHaveValue("0.33");
    await expect(page.getByRole("tab")).toHaveCount(0);
    await expect(
      page.getByRole("region", { name: "Motion preview" }),
    ).toHaveCount(0);
    await expect(
      page.getByText("Timeline selection", { exact: true }),
    ).toHaveCount(0);
    await expect(page.getByLabel("Movement", { exact: true })).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await expect(
      page.getByRole("button", { name: "Apply animation" }),
    ).toBeInViewport();
    await page.screenshot({
      path: `artifacts/curves-${width}.png`,
      fullPage: true,
      animations: "disabled",
    });
  });
}

test("dragging a handle uses the rendered graph coordinates", async ({
  page,
}) => {
  await page.setViewportSize({ width: 400, height: 800 });
  await page.goto("/");
  await page.locator(".workspace").hover();
  await page.getByRole("button", { name: "Ease both", exact: true }).click();
  const handle = await page
    .getByRole("button", { name: "First curve handle", exact: false })
    .boundingBox();
  if (!handle) throw new Error("Curve handle was not rendered.");
  await page.mouse.move(
    handle.x + handle.width / 2,
    handle.y + handle.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    handle.x + handle.width / 2 + 24,
    handle.y + handle.height / 2 - 16,
    { steps: 6 },
  );
  await page.mouse.up();
  expect(
    Number(await page.getByLabel("Curve X1").inputValue()),
  ).toBeGreaterThan(0.42);
  expect(
    Number(await page.getByLabel("Curve Y1").inputValue()),
  ).toBeGreaterThan(0);
});

test("Apply sends one sample per frame of the loaded pair, endpoints intact", async ({
  page,
}) => {
  await attachHost(page);
  await page.goto("/");
  await page.locator(".workspace").hover();
  await expect(
    page.getByText("Motion / Position", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Ease in", exact: true }).click();
  await page.getByRole("button", { name: "Apply animation" }).click();
  await expect(page.getByRole("status")).toContainText(
    "24 intermediate keyframes",
  );
  const samples = await page.evaluate(() => {
    const requests = (
      window as unknown as {
        curveRequests: {
          operation: string;
          payload: {
            plan: { samples: { timeTicks: string; value: [number, number] }[] };
          };
        }[];
      }
    ).curveRequests;
    return requests.find((request) => request.operation === "apply-curve")!
      .payload.plan.samples;
  });
  // The fixture pair spans 25 sequence frames: 26 samples, both ends kept.
  expect(samples).toHaveLength(26);
  expect(samples[0]).toMatchObject({
    timeTicks: curveTarget.startTicks,
    value: curveTarget.startValue,
  });
  expect(samples.at(-1)).toMatchObject({
    timeTicks: curveTarget.endTicks,
    value: curveTarget.endValue,
  });
  // Ease in starts slowly: the first half covers well under half the move.
  expect(samples[13].value[0]).toBeLessThan(0.5);
});

test("one click applies the curve to every property keyed at the playhead", async ({
  page,
}) => {
  await attachHost(page, { ambiguous: true });
  await page.goto("/");
  await page.locator(".workspace").hover();
  await expect(page.getByText("2 animated properties")).toBeVisible();
  await expect(page.getByLabel("Animated property")).toHaveCount(0);
  await page.getByRole("button", { name: "Apply animation" }).click();
  await expect(page.getByRole("status")).toContainText("2 properties");
  const applied = await page.evaluate(() =>
    (
      window as unknown as {
        curveRequests: {
          operation: string;
          payload: { target: { id: string } };
        }[];
      }
    ).curveRequests
      .filter((request) => request.operation === "apply-curve")
      .map((request) => request.payload.target.id),
  );
  expect(applied).toEqual(["position-1", "rotation"]);
});

test("a native error names the property and claims nothing", async ({
  page,
}) => {
  await attachHost(page, { ambiguous: true, reject: true });
  await page.goto("/");
  await page.locator(".workspace").hover();
  await page.getByRole("button", { name: "Apply animation" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Motion / Position: The keyframes changed after the preview.",
  );
  await expect(page.getByRole("status")).toHaveCount(0);
});

for (const [width, height] of [
  [280, 400],
  [400, 750],
] as const) {
  test(`the ${width}×${height} panel fits without page scroll and explains Apply`, async ({
    page,
  }) => {
    await attachHost(page, { ambiguous: true });
    await page.setViewportSize({ width, height });
    await page.goto("/");
    await page.locator(".workspace").hover();
    await expect(page.getByText("2 animated properties")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Curves" })).toBeVisible();
    const apply = page.getByRole("button", { name: "Apply animation" });
    await expect(apply).toBeInViewport();
    await expect(apply).toHaveAccessibleDescription(
      "Animates Motion / Position, Motion / Rotation",
    );
    await expect(page.locator("#apply-targets")).toBeInViewport();
    const overflow = await page.evaluate(() => ({
      vertical: document.documentElement.scrollHeight - innerHeight,
      horizontal: document.documentElement.scrollWidth - innerWidth,
    }));
    expect(overflow).toEqual({ vertical: 0, horizontal: 0 });
    await page.screenshot({
      path: `artifacts/panel-${width}x${height}.png`,
      animations: "disabled",
    });
  });
}

test("one click coming from Premiere applies the curve while the panel reloads", async ({
  page,
}) => {
  await attachHost(page, { delay: 250 });
  await page.setViewportSize({ width: 400, height: 750 });
  await page.goto("/");
  await page.locator(".workspace").hover();
  await expect(
    page.getByText("Motion / Position", { exact: true }),
  ).toBeVisible();
  // Leave the panel as if the user went back to Premiere's timeline.
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
  await page.mouse.move(0, 0);
  await page.locator("body").dispatchEvent("pointerout");
  await page.getByRole("button", { name: "Apply animation" }).click();
  await expect(page.getByRole("status")).toContainText(
    "intermediate keyframes updated",
  );
  const writes = await page.evaluate(
    () =>
      (
        window as unknown as { curveRequests: { operation: string }[] }
      ).curveRequests.filter((request) => request.operation === "apply-curve")
        .length,
  );
  expect(writes).toBe(1);
});

test("motion blur results are reported inside the Motion blur section", async ({
  page,
}) => {
  await attachHost(page, { blur: true, noPair: true });
  await page.setViewportSize({ width: 280, height: 400 });
  await page.goto("/");
  await page.locator(".workspace").hover();
  await expect(page.getByText("Current: composition")).toBeVisible();
  await page.getByRole("button", { name: "Apply blur to clip" }).click();
  await expect(
    page.getByRole("region", { name: "Motion blur" }).getByRole("status"),
  ).toContainText("180 degrees");
});

test("one click adds Transform to the selected clip and readies motion blur", async ({
  page,
}) => {
  await attachHost(page, { noPair: true });
  await page.setViewportSize({ width: 280, height: 400 });
  await page.goto("/");
  await page.locator(".workspace").hover();
  const blur = page.getByRole("region", { name: "Motion blur" });
  await expect(blur.getByText("Add the Transform effect")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Apply blur to clip" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Add Transform to clip" }).click();
  await expect(blur.getByRole("status")).toContainText("Transform added");
  await expect(page.getByText("Current: composition")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Apply blur to clip" }),
  ).toBeEnabled();
  const operations = await page.evaluate(() =>
    (
      window as unknown as {
        curveRequests: { operation: string; payload: unknown }[];
      }
    ).curveRequests.filter((request) => request.operation !== "inspect"),
  );
  expect(operations).toEqual([
    {
      protocol: 2,
      operation: "add-transform",
      payload: { selectionToken: "selection-1" },
    },
  ]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollHeight - innerHeight,
    ),
  ).toBe(0);
  await blur.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "artifacts/add-transform-280x400.png",
    animations: "disabled",
  });
});

// Expected colours are the DESIGN.md palette values, not read from the CSS.
const palette = {
  vanilla: "rgb(255, 247, 211)",
  pitchBlack: "rgb(10, 10, 10)",
  ruleCharcoal: "rgb(26, 26, 26)",
  carmine: "rgb(171, 21, 9)",
  inversePrimary: "rgb(255, 180, 168)",
};

for (const [theme, expected] of [
  [
    "light",
    {
      canvas: palette.vanilla,
      text: palette.pitchBlack,
      applyFill: palette.pitchBlack,
      applyText: palette.vanilla,
      monitor: palette.pitchBlack,
      link: palette.carmine,
    },
  ],
  [
    "dark",
    {
      canvas: palette.pitchBlack,
      text: palette.vanilla,
      applyFill: palette.vanilla,
      applyText: palette.pitchBlack,
      monitor: palette.ruleCharcoal,
      link: palette.inversePrimary,
    },
  ],
] as const) {
  test(`the ${theme} theme follows the DESIGN.md palette in a 280×400 panel`, async ({
    page,
  }) => {
    await page.addInitScript(
      (value) => localStorage.setItem("z-motion-theme", value),
      theme,
    );
    await attachHost(page, { blur: true });
    await page.setViewportSize({ width: 280, height: 400 });
    await page.goto("/");
    await page.locator(".workspace").hover();
    await expect(
      page.getByText("Motion / Position", { exact: true }),
    ).toBeVisible();
    const colours = await page.evaluate(() => {
      const style = (selector: string) =>
        getComputedStyle(document.querySelector(selector)!);
      return {
        canvas: style("html").backgroundColor,
        text: style(".workspace").color,
        applyFill: style(".primary-button").backgroundColor,
        applyText: style(".primary-button").color,
        monitor: style(".curve-monitor").backgroundColor,
        link: style(".blur-selection button").color,
      };
    });
    expect(colours).toEqual(expected);
    // Type on carmine stays Vanilla in both themes.
    await page.getByRole("button", { name: "Apply animation" }).hover();
    await expect(
      page.getByRole("button", { name: "Apply animation" }),
    ).toHaveCSS("color", palette.vanilla);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - innerWidth,
      ),
    ).toBe(0);
    await page.mouse.move(0, 0);
    await page.screenshot({
      path: `artifacts/theme-${theme}-280x400.png`,
      animations: "disabled",
    });
    await page
      .getByRole("region", { name: "Motion blur" })
      .scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `artifacts/theme-${theme}-blur-280x400.png`,
      animations: "disabled",
    });
  });
}

test("the theme chosen in the header survives reopening the panel", async ({
  page,
}) => {
  await page.goto("/");
  const toggle = page.getByRole("button", { name: "Dark theme" });
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await toggle.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(
    page.getByRole("button", { name: "Dark theme" }),
  ).toHaveAttribute("aria-pressed", "true");
});

for (const theme of ["light", "dark"] as const) {
  test(`the property picker fits a 280×400 panel and limits Apply (${theme})`, async ({
    page,
  }) => {
    await page.addInitScript(
      (value) => localStorage.setItem("z-motion-theme", value),
      theme,
    );
    await attachHost(page, { ambiguous: true });
    await page.setViewportSize({ width: 280, height: 400 });
    await page.goto("/");
    await page.locator(".workspace").hover();
    const summary = page.getByRole("button", {
      name: "Properties to animate: 2 of 2",
    });
    await expect(summary).toContainText(
      "Animates Motion / Position, Motion / Rotation",
    );
    await summary.click();
    const dialog = page.getByRole("dialog", { name: "Properties to animate" });
    await expect(dialog).toBeInViewport({ ratio: 1 });
    await expect(
      dialog.getByRole("checkbox", { name: /Motion \/ Position/ }),
    ).toBeFocused();
    await dialog
      .getByRole("checkbox", { name: /Motion \/ Rotation/ })
      .uncheck();
    await page.screenshot({
      path: `artifacts/property-picker-${theme}-280x400.png`,
      animations: "disabled",
    });
    await dialog.getByRole("button", { name: "Done" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Properties to animate: 1 of 2" }),
    ).toBeFocused();
    await page.getByRole("button", { name: "Apply animation" }).click();
    await expect(page.getByRole("status")).toContainText(
      "24 intermediate keyframes",
    );
    const applied = await page.evaluate(() =>
      (
        window as unknown as {
          curveRequests: {
            operation: string;
            payload: { target: { id: string } };
          }[];
        }
      ).curveRequests
        .filter((request) => request.operation === "apply-curve")
        .map((request) => request.payload.target.id),
    );
    expect(applied).toEqual(["position-1"]);
    await page.screenshot({
      path: `artifacts/property-summary-${theme}-280x400.png`,
      animations: "disabled",
    });
  });
}
