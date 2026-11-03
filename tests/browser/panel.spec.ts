import { expect, test, type Page } from "@playwright/test";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { curveTarget } from "../fixtures/curve-target";

async function attachHost(
  page: Page,
  options: { ambiguous?: boolean; reject?: boolean } = {},
) {
  await page.addInitScript(
    ({ target, options }) => {
      let active = target;
      const requests: {
        operation: string;
        payload: Record<string, unknown>;
      }[] = [];
      Object.assign(window, {
        curveRequests: requests,
        __adobe_cep__: {
          evalScript(script: string, callback: (value: string) => void) {
            const encoded = JSON.parse(
              script.slice(script.indexOf("decodeURIComponent(") + 19, -2),
            );
            const request = JSON.parse(decodeURIComponent(encoded));
            requests.push(request);
            if (request.operation === "inspect") {
              const targets = [active];
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
                  data: { hostVersion: "26.5.1", targets, message: "" },
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
            else {
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
    { target: curveTarget, options },
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
  test(`curve-only graph and preview fit at ${width}px`, async ({ page }) => {
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
    await page.getByRole("button", { name: "Replay preview" }).click();
    await expect(page.getByRole("tab")).toHaveCount(0);
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

test("preview and apply use the same samples of the loaded pair", async ({
  page,
}) => {
  await attachHost(page);
  await page.goto("/");
  await page.locator(".workspace").hover();
  await expect(
    page.getByText("Motion / Position", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Ease in", exact: true }).click();
  await page.getByRole("button", { name: "Replay preview" }).click();
  const previewX = await page.locator(".preview-shape").evaluate((element) => {
    const effect = element.getAnimations()[0].effect as KeyframeEffect;
    return effect
      .getKeyframes()
      .map((frame) => new DOMMatrix(String(frame.transform)).m41);
  });
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
  expect(samples).toHaveLength(previewX.length);
  expect(samples[0]).toMatchObject({
    timeTicks: curveTarget.startTicks,
    value: curveTarget.startValue,
  });
  expect(samples.at(-1)).toMatchObject({
    timeTicks: curveTarget.endTicks,
    value: curveTarget.endValue,
  });
  for (let index = 0; index < samples.length; index += 1) {
    const visualProgress =
      (previewX[index] - previewX[0]) / (previewX.at(-1)! - previewX[0]);
    const valueProgress = (samples[index].value[0] - 0.2) / 0.6;
    expect(visualProgress).toBeCloseTo(valueProgress, 5);
  }
});

test("ambiguous properties require a choice and native errors remain errors", async ({
  page,
}) => {
  await attachHost(page, { ambiguous: true, reject: true });
  await page.goto("/");
  await page.locator(".workspace").hover();
  await expect(page.getByLabel("Animated property")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Apply animation" }),
  ).toBeDisabled();
  await page.getByLabel("Animated property").selectOption("rotation");
  await page.getByRole("button", { name: "Apply animation" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "changed after the preview",
  );
  await expect(page.getByRole("status")).toHaveCount(0);
});
