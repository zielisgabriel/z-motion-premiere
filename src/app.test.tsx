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
import { createTestHost, curveTarget } from "../tests/fixtures/curve-target";
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
