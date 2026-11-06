import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import App from "./app";
import { createCepHost } from "./infrastructure/cep-host";
import {
  createTestHost,
  curveTarget,
  motionBlurTarget,
} from "../tests/fixtures/curve-target";
import type { EasingPlan } from "./domain/easing-curve";

afterEach(cleanup);

describe("curve-only panel", () => {
  it("does not query Adobe during startup before the editor is entered", async () => {
    let inspections = 0;
    render(
      <App
        host={createTestHost({
          inspect: async () => {
            inspections += 1;
            return {
              hostVersion: "26.5.1",
              targets: [curveTarget],
              message: "",
            };
          },
        })}
      />,
    );
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(inspections).toBe(0);
  });
  it("shows the graph and preview with a single apply action and no toolkit sections", () => {
    render(<App host={createCepHost()} />);
    expect(screen.getByRole("heading", { name: "Z Motion" })).toBeTruthy();
    expect(screen.getByLabelText("Editable easing curve")).toBeTruthy();
    expect(screen.queryByRole("tab")).toBeNull();
    expect(screen.queryByText("Timeline selection")).toBeNull();
    expect(screen.queryByText("Movement")).toBeNull();
    expect(screen.queryByText("Stagger (frames)")).toBeNull();
    expect(
      (
        screen.getByRole("button", {
          name: "Apply animation",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("applies the visible curve to the loaded endpoint values and duration", async () => {
    let applied: EasingPlan | undefined;
    const host = createTestHost({
      apply: async (target, plan) => {
        applied = plan;
        return {
          keyframesWritten: 24,
          message:
            "Curve applied. Both endpoint values and times were preserved.",
          target,
        };
      },
    });
    render(<App host={host} />);
    fireEvent.pointerEnter(
      screen.getByRole("main", { name: "Curve editor" }).parentElement!,
    );
    await screen.findByText("Motion / Position");
    fireEvent.click(screen.getByRole("button", { name: "Ease in" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply animation" }));
    await screen.findByRole("status");
    expect(applied?.curve).toEqual([0.42, 0, 1, 1]);
    expect(applied?.durationSeconds).toBe(1);
    expect(applied?.samples[0]).toMatchObject({
      timeTicks: curveTarget.startTicks,
      value: [0.2, 0.5],
    });
    expect(applied?.samples.at(-1)).toMatchObject({
      timeTicks: curveTarget.endTicks,
      value: [0.8, 0.5],
    });
  });

  it("requires a compact property choice only when the target is ambiguous", async () => {
    const other = {
      ...curveTarget,
      id: "rotation",
      label: "Motion / Rotation",
      kind: "rotation" as const,
      startValue: 0,
      endValue: 90,
    };
    render(
      <App
        host={createTestHost({
          inspect: async () => ({
            hostVersion: "26.5.1",
            targets: [curveTarget, other],
            message: "",
          }),
        })}
      />,
    );
    fireEvent.pointerEnter(
      screen.getByRole("main", { name: "Curve editor" }).parentElement!,
    );
    const choice = await screen.findByLabelText("Animated property");
    expect(
      (
        screen.getByRole("button", {
          name: "Apply animation",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    fireEvent.change(choice, { target: { value: other.id } });
    await waitFor(() =>
      expect(
        (
          screen.getByRole("button", {
            name: "Apply animation",
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false),
    );
  });

  it("reports a stale pair without claiming an applied curve", async () => {
    render(
      <App
        host={createTestHost({
          apply: async () => {
            throw new Error("The keyframes changed after the preview.");
          },
        })}
      />,
    );
    fireEvent.pointerEnter(
      screen.getByRole("main", { name: "Curve editor" }).parentElement!,
    );
    await screen.findByText("Motion / Position");
    fireEvent.click(screen.getByRole("button", { name: "Apply animation" }));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(
        "changed after the preview",
      ),
    );
    expect(screen.queryByRole("status")).toBeNull();
  });
});

describe("motion blur controls", () => {
  function enterPanel() {
    fireEvent.pointerEnter(
      screen.getByRole("main", { name: "Curve editor" }).parentElement!,
    );
  }

  it("applies blur independently of keyframe creation or curve application", async () => {
    const applied: number[] = [];
    let curves = 0;
    const base = createTestHost();
    render(
      <App
        host={createTestHost({
          inspect: async () => ({
            hostVersion: "26.5.1",
            message: "No pair",
            targets: [],
            motionBlur: {
              targets: [motionBlurTarget],
              message: "",
              clipName: "mouse-arrow.png",
            },
          }),
          apply: async () => {
            curves++;
            throw new Error("Should not edit keyframes");
          },
          applyMotionBlur: async (target, angle) => {
            applied.push(angle);
            return base.applyMotionBlur(target, angle);
          },
        })}
      />,
    );
    enterPanel();
    await screen.findByText("Current: composition");
    expect(screen.getByText("Clip: mouse-arrow.png")).toBeTruthy();
    expect(
      (
        screen.getByRole("button", {
          name: "Apply animation",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "360°" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply blur to clip" }));
    expect((await screen.findByRole("status")).textContent).toContain(
      "360 degrees",
    );
    expect(screen.getByText("Current: 360°")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Off" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply blur to clip" }));
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toContain("disabled"),
    );
    expect(applied).toEqual([360, 0]);
    expect(curves).toBe(0);
  });

  it("refreshes the selected clip without requiring a keyframe pair", async () => {
    let selected = false;
    render(
      <App
        host={createTestHost({
          inspect: async () => ({
            hostVersion: "26.5.1",
            targets: [],
            message: "Place the playhead between two existing keyframes.",
            motionBlur: {
              targets: selected ? [motionBlurTarget] : [],
              clipName: selected ? "mouse-arrow.png" : "",
              message: selected ? "" : "Select one video clip in the timeline.",
            },
          }),
        })}
      />,
    );
    enterPanel();
    await screen.findByText("Select one video clip in the timeline.");
    expect(
      (
        screen.getByRole("button", {
          name: "Apply blur to clip",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    selected = true;
    fireEvent.click(screen.getByRole("button", { name: "Refresh clip" }));
    await screen.findByText("Clip: mouse-arrow.png");
    expect(
      (
        screen.getByRole("button", {
          name: "Apply blur to clip",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
    expect(
      (
        screen.getByRole("button", {
          name: "Apply animation",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("does not apply blur when only the curve action is used", async () => {
    let blurWrites = 0;
    render(
      <App
        host={createTestHost({
          applyMotionBlur: async () => {
            blurWrites++;
            throw new Error("Should not set blur");
          },
        })}
      />,
    );
    enterPanel();
    await screen.findByText("Current: composition");
    fireEvent.click(screen.getByRole("button", { name: "Apply animation" }));
    await screen.findByRole("status");
    expect(blurWrites).toBe(0);
  });

  it("requires a choice when multiple Transform effects qualify", async () => {
    render(
      <App
        host={createTestHost({
          inspect: async () => ({
            hostVersion: "26.5.1",
            message: "",
            targets: [],
            motionBlur: {
              targets: [
                motionBlurTarget,
                {
                  ...motionBlurTarget,
                  id: "transform-2",
                  label: "Transform (4)",
                  shutterAngle: 90,
                },
              ],
              message: "",
            },
          }),
        })}
      />,
    );
    enterPanel();
    const select = await screen.findByLabelText("Transform effect");
    expect(
      (
        screen.getByRole("button", {
          name: "Apply blur to clip",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    fireEvent.change(select, { target: { value: "transform-2" } });
    expect(
      (screen.getByLabelText("Shutter angle (°)") as HTMLInputElement).value,
    ).toBe("90");
    expect(
      (
        screen.getByRole("button", {
          name: "Apply blur to clip",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
  });

  it("keeps offline writes disabled and rejects an empty or out-of-range angle", async () => {
    const { unmount } = render(<App host={createCepHost()} />);
    expect(
      (
        screen.getByRole("button", {
          name: "Apply blur to clip",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    unmount();
    render(<App host={createTestHost()} />);
    enterPanel();
    await screen.findByText("Current: composition");
    for (const value of ["", "361", "-1"]) {
      fireEvent.change(screen.getByLabelText("Shutter angle (°)"), {
        target: { value },
      });
      expect(screen.getByRole("alert").textContent).toContain("0° and 360°");
      expect(
        (
          screen.getByRole("button", {
            name: "Apply blur to clip",
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(true);
    }
  });

  it("preserves the draft during an unchanged refresh and reports native rejection", async () => {
    render(
      <App
        host={createTestHost({
          applyMotionBlur: async () => {
            throw new Error("Shutter settings changed. Reload them.");
          },
        })}
      />,
    );
    enterPanel();
    await screen.findByText("Current: composition");
    fireEvent.change(screen.getByLabelText("Shutter angle (°)"), {
      target: { value: "270" },
    });
    enterPanel();
    await waitFor(() =>
      expect(
        (
          screen.getByRole("button", {
            name: "Apply blur to clip",
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false),
    );
    expect(
      (screen.getByLabelText("Shutter angle (°)") as HTMLInputElement).value,
    ).toBe("270");
    fireEvent.click(screen.getByRole("button", { name: "Apply blur to clip" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Shutter settings changed",
    );
    expect(screen.queryByRole("status")).toBeNull();
  });
});
