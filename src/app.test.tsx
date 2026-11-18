import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import App from "./app";
import { createCepHost } from "./infrastructure/cep-host";
import {
  createTestHost,
  curveTarget,
  motionBlurTarget,
} from "../tests/fixtures/curve-target";
import type { EasingPlan } from "./domain/easing-curve";
import type { HostPort } from "./application/host-port";

afterEach(cleanup);

function enterPanel() {
  fireEvent.pointerEnter(
    screen.getByRole("main", { name: "Curve editor" }).parentElement!,
  );
}

/**
 * Premiere answers the first inspection at once; every later reload waits
 * until the test releases it, like a slow ExtendScript round trip.
 */
function hostWithSlowReloads(overrides: Partial<HostPort> = {}) {
  const base = createTestHost(overrides);
  const waiting: (() => void)[] = [];
  let inspections = 0;
  const host: HostPort = {
    ...base,
    inspect: async (preferred) => {
      inspections += 1;
      if (inspections > 1)
        await new Promise<void>((release) => waiting.push(release));
      return base.inspect(preferred);
    },
  };
  return {
    host,
    finishReloads: () =>
      act(async () => {
        waiting.splice(0).forEach((release) => release());
      }),
  };
}

describe("silent Premiere reloads", () => {
  it("applies the curve when the click that focuses the panel also starts a reload", async () => {
    const user = userEvent.setup();
    const applied: EasingPlan[] = [];
    const { host, finishReloads } = hostWithSlowReloads({
      apply: async (target, plan) => {
        applied.push(plan);
        return {
          keyframesWritten: plan.samples.length - 2,
          message: "",
          target,
        };
      },
    });
    render(<App host={host} />);
    enterPanel();
    await screen.findByText("Motion / Position");
    await user.click(screen.getByRole("button", { name: "Apply animation" }));
    await finishReloads();
    expect((await screen.findByRole("status")).textContent).toContain(
      "intermediate keyframes updated",
    );
    expect(applied).toHaveLength(1);
  });

  it("keeps Apply enabled and labelled while a background reload runs", async () => {
    const { host } = hostWithSlowReloads();
    render(<App host={host} />);
    enterPanel();
    await screen.findByText("Motion / Position");
    const workspace = screen.getByRole("main", {
      name: "Curve editor",
    }).parentElement!;
    fireEvent.pointerLeave(workspace);
    enterPanel();
    await act(async () => {});
    const button = screen.getByRole("button", {
      name: "Apply animation",
    }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    expect(button.textContent).not.toContain("Working in Premiere");
    expect(
      (screen.getByRole("button", { name: "Off" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });

  it("does not apply when the reload no longer finds the pair the user saw", async () => {
    const user = userEvent.setup();
    let pairs = [curveTarget];
    let writes = 0;
    const { host, finishReloads } = hostWithSlowReloads({
      inspect: async () => ({
        hostVersion: "26.5.1",
        targets: pairs,
        message: "Place the playhead between two existing keyframes.",
      }),
      apply: async (target) => {
        writes += 1;
        return { keyframesWritten: 0, message: "", target };
      },
    });
    render(<App host={host} />);
    enterPanel();
    await screen.findByText("Motion / Position");
    pairs = [];
    await user.click(screen.getByRole("button", { name: "Apply animation" }));
    await finishReloads();
    expect((await screen.findByRole("alert")).textContent).toContain(
      "selection changed before applying",
    );
    expect(writes).toBe(0);
  });

  it("applies blur when the click that focuses the panel also starts a reload", async () => {
    const user = userEvent.setup();
    const angles: number[] = [];
    const base = createTestHost();
    const { host, finishReloads } = hostWithSlowReloads({
      applyMotionBlur: async (target, angle) => {
        angles.push(angle);
        return base.applyMotionBlur(target, angle);
      },
    });
    render(<App host={host} />);
    enterPanel();
    await screen.findByText("Current: composition");
    await user.click(
      screen.getByRole("button", { name: "Apply blur to clip" }),
    );
    await finishReloads();
    expect((await screen.findByRole("status")).textContent).toContain(
      "180 degrees",
    );
    expect(angles).toEqual([180]);
  });
});

describe("motion blur feedback stays in the Motion blur section", () => {
  it("shows the applied shutter result inside the section", async () => {
    render(<App host={createTestHost()} />);
    enterPanel();
    await screen.findByText("Current: composition");
    fireEvent.click(screen.getByRole("button", { name: "Apply blur to clip" }));
    const blur = screen.getByRole("region", { name: "Motion blur" });
    expect((await within(blur).findByRole("status")).textContent).toContain(
      "180 degrees",
    );
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });

  it("shows a native blur rejection inside the section only", async () => {
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
    fireEvent.click(screen.getByRole("button", { name: "Apply blur to clip" }));
    const blur = screen.getByRole("region", { name: "Motion blur" });
    expect((await within(blur).findByRole("alert")).textContent).toContain(
      "Shutter settings changed",
    );
    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });

  it("clears an old blur result when the curve is applied", async () => {
    render(<App host={createTestHost()} />);
    enterPanel();
    await screen.findByText("Current: composition");
    fireEvent.click(screen.getByRole("button", { name: "Apply blur to clip" }));
    await screen.findByText(/180 degrees/);
    fireEvent.click(screen.getByRole("button", { name: "Apply animation" }));
    await screen.findByText(/intermediate keyframes updated/);
    expect(screen.queryByText(/180 degrees/)).toBeNull();
  });
});

describe("section headings stay put", () => {
  it("keeps the Curves heading with several animated properties", async () => {
    render(
      <App
        host={createTestHost({
          inspect: async () => ({
            hostVersion: "26.5.1",
            targets: [
              curveTarget,
              { ...curveTarget, id: "scale", label: "Motion / Scale" },
            ],
            message: "",
          }),
        })}
      />,
    );
    expect(screen.getByRole("heading", { name: "Curves" })).toBeTruthy();
    enterPanel();
    await screen.findByText("2 animated properties");
    expect(screen.getByRole("heading", { name: "Curves" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Motion blur" })).toBeTruthy();
  });

  it("shortens a long clip name but keeps the full name available", async () => {
    const clipName =
      "A001_C012_0612XY_very_long_camera_clip_name_graded_v3_final.mov";
    render(
      <App
        host={createTestHost({
          inspect: async () => ({
            hostVersion: "26.5.1",
            targets: [],
            message: "",
            motionBlur: {
              targets: [motionBlurTarget],
              message: "",
              clipName,
            },
          }),
        })}
      />,
    );
    enterPanel();
    const name = await screen.findByText(`Clip: ${clipName}`);
    expect(name.getAttribute("title")).toBe(clipName);
    expect(name.className).toContain("clip-name");
  });
});

describe("Apply explains itself next to the button", () => {
  it("lists every property the curve will change", async () => {
    render(
      <App
        host={createTestHost({
          inspect: async () => ({
            hostVersion: "26.5.1",
            targets: [
              curveTarget,
              { ...curveTarget, id: "scale", label: "Motion / Scale" },
            ],
            message: "",
          }),
        })}
      />,
    );
    enterPanel();
    expect(
      await screen.findByRole("button", {
        name: "Apply animation",
        description: "Applies to: Motion / Position, Motion / Scale",
      }),
    ).toBeTruthy();
  });

  it("shows the apply result in place of the hint to save room in small panels", async () => {
    render(<App host={createTestHost()} />);
    enterPanel();
    await screen.findByText("Motion / Position");
    expect(screen.getByText("Applies to: Motion / Position")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Apply animation" }));
    expect(
      await screen.findByRole("button", {
        name: "Apply animation",
        description: "24 intermediate keyframes updated. Endpoints preserved.",
      }),
    ).toBeTruthy();
    expect(screen.queryByText("Applies to: Motion / Position")).toBeNull();
  });

  it("tells the user to place the playhead when Premiere reports no pair", async () => {
    render(
      <App
        host={createTestHost({
          inspect: async () => ({
            hostVersion: "26.5.1",
            targets: [],
            message: "Place the playhead between two existing keyframes.",
          }),
        })}
      />,
    );
    enterPanel();
    expect(
      await screen.findByRole("button", {
        name: "Apply animation",
        description: "Place the playhead between two existing keyframes.",
      }),
    ).toBeTruthy();
  });
});

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

describe("Add Transform button", () => {
  const second = {
    ...motionBlurTarget,
    id: "transform-2",
    label: "Transform (4)",
  };

  /** A clip that gains one more Transform each time the button is used. */
  function clipGainingTransforms(
    initial: number,
    selectedClips = 1,
    overrides: Partial<HostPort> = {},
  ) {
    const tokens: string[] = [];
    let transforms = initial;
    const host = createTestHost({
      inspect: async () => ({
        hostVersion: "26.5.1",
        targets: [],
        message: "",
        motionBlur: {
          targets: [motionBlurTarget, second].slice(0, transforms),
          message: transforms
            ? ""
            : "Add the Transform effect to this clip to enable motion blur.",
          clipName: selectedClips === 1 ? "mouse-arrow.png" : "",
          selectedClips,
          selectionToken: `selection-${selectedClips}`,
        },
      }),
      addTransform: async (token) => {
        tokens.push(token);
        transforms += 1;
        return {
          added: selectedClips,
          message: "Transform added to mouse-arrow.png.",
          transformId: transforms === 1 ? motionBlurTarget.id : second.id,
        };
      },
      ...overrides,
    });
    return { host, tokens };
  }

  it("adds Transform with one click and makes it ready for motion blur", async () => {
    const { host, tokens } = clipGainingTransforms(0);
    render(<App host={host} />);
    enterPanel();
    await screen.findByText(/Add the Transform effect/);
    expect(
      (
        screen.getByRole("button", {
          name: "Apply blur to clip",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    fireEvent.click(
      screen.getByRole("button", { name: "Add Transform to clip" }),
    );
    const blur = screen.getByRole("region", { name: "Motion blur" });
    expect((await within(blur).findByRole("status")).textContent).toContain(
      "Transform added",
    );
    await screen.findByText("Current: composition");
    expect(tokens).toEqual(["selection-1"]);
    expect(
      (
        screen.getByRole("button", {
          name: "Apply blur to clip",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
  });

  it("still adds another Transform when the clip has one, and selects the new one", async () => {
    const { host, tokens } = clipGainingTransforms(1);
    render(<App host={host} />);
    enterPanel();
    await screen.findByText("Current: composition");
    fireEvent.click(
      screen.getByRole("button", { name: "Add Transform to clip" }),
    );
    const select = (await screen.findByLabelText(
      "Transform effect",
    )) as HTMLSelectElement;
    await waitFor(() => expect(select.value).toBe("transform-2"));
    expect(tokens).toHaveLength(1);
  });

  it("names how many selected clips will receive Transform", async () => {
    const { host, tokens } = clipGainingTransforms(0, 3);
    render(<App host={host} />);
    enterPanel();
    await screen.findByText("3 clips selected");
    fireEvent.click(
      screen.getByRole("button", { name: "Add Transform to 3 clips" }),
    );
    await waitFor(() => expect(tokens).toEqual(["selection-3"]));
  });

  it("is unavailable without a selected video clip or outside Premiere", async () => {
    const { unmount } = render(<App host={createCepHost()} />);
    expect(
      (
        screen.getByRole("button", {
          name: "Add Transform to clip",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    unmount();
    render(<App host={clipGainingTransforms(0, 0).host} />);
    enterPanel();
    await screen.findByText("Select a clip in the timeline");
    expect(
      (
        screen.getByRole("button", {
          name: "Add Transform to clip",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("adds Transform when the click that focuses the panel also starts a reload", async () => {
    const user = userEvent.setup();
    const tokens: string[] = [];
    const { host, finishReloads } = hostWithSlowReloads({
      addTransform: async (token) => {
        tokens.push(token);
        return { added: 1, message: "Transform added to mouse-arrow.png." };
      },
    });
    render(<App host={host} />);
    enterPanel();
    await screen.findByText("Current: composition");
    await user.click(
      screen.getByRole("button", { name: "Add Transform to clip" }),
    );
    await finishReloads();
    await waitFor(() => expect(tokens).toEqual(["selection-1"]));
  });

  it("shows a Premiere refusal inside the Motion blur section", async () => {
    const { host } = clipGainingTransforms(0, 1, {
      addTransform: async () => {
        throw new Error(
          "Premiere could not find the Transform effect in this language.",
        );
      },
    });
    render(<App host={host} />);
    enterPanel();
    await screen.findByText(/Add the Transform effect/);
    fireEvent.click(
      screen.getByRole("button", { name: "Add Transform to clip" }),
    );
    const blur = screen.getByRole("region", { name: "Motion blur" });
    expect((await within(blur).findByRole("alert")).textContent).toContain(
      "could not find the Transform effect",
    );
  });
});

describe("the curve applies to every property keyed around the playhead", () => {
  const position = { ...curveTarget, label: "Transform / Position" };
  const scale = {
    ...curveTarget,
    id: "scale-1",
    label: "Transform / Scale",
    kind: "scale" as const,
    startValue: 100,
    endValue: 126.9,
  };
  function pairHost(
    targets: (typeof curveTarget)[],
    overrides: Partial<HostPort> = {},
  ) {
    return createTestHost({
      inspect: async () => ({ hostVersion: "26.5.1", targets, message: "" }),
      ...overrides,
    });
  }

  it("applies one curve to Position and Scale with a single click", async () => {
    const applied: { id: string; curve: number[] }[] = [];
    render(
      <App
        host={pairHost([position, scale], {
          apply: async (target, plan) => {
            applied.push({ id: target.id, curve: plan.curve });
            return {
              keyframesWritten: plan.samples.length - 2,
              message: "",
              target,
            };
          },
        })}
      />,
    );
    enterPanel();
    await screen.findByText("2 animated properties");
    expect(screen.queryByLabelText("Animated property")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Ease in" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply animation" }));
    const status = await screen.findByRole("status");
    expect(status.textContent).toContain("2 properties");
    expect(status.textContent).toContain("48 intermediate keyframes updated");
    expect(applied).toEqual([
      { id: "position-1", curve: [0.42, 0, 1, 1] },
      { id: "scale-1", curve: [0.42, 0, 1, 1] },
    ]);
  });

  it("names the property whose range the curve would break and keeps Apply disabled", async () => {
    const opacity = {
      ...curveTarget,
      id: "opacity-1",
      label: "Opacity / Opacity",
      kind: "opacity" as const,
      startValue: 0,
      endValue: 100,
      limits: [0, 100] as [number, number],
    };
    render(<App host={pairHost([position, opacity])} />);
    enterPanel();
    await screen.findByText("2 animated properties");
    fireEvent.click(screen.getByRole("button", { name: "Overshoot" }));
    expect(screen.getByRole("alert").textContent).toContain(
      "Opacity / Opacity: This curve exceeds",
    );
    expect(
      (
        screen.getByRole("button", {
          name: "Apply animation",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("still applies the other properties when one fails, and reports both", async () => {
    const applied: string[] = [];
    render(
      <App
        host={pairHost([position, scale], {
          apply: async (target, plan) => {
            if (target.id === "position-1")
              throw new Error("Premiere rejected the Position keyframes.");
            applied.push(target.id);
            return {
              keyframesWritten: plan.samples.length - 2,
              message: "",
              target,
            };
          },
        })}
      />,
    );
    enterPanel();
    await screen.findByText("2 animated properties");
    fireEvent.click(screen.getByRole("button", { name: "Apply animation" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(
      "Transform / Position: Premiere rejected the Position keyframes.",
    );
    expect(alert.textContent).toContain("Applied to Transform / Scale.");
    expect(applied).toEqual(["scale-1"]);
  });

  it("adds a host warning to the result", async () => {
    render(
      <App
        host={pairHost([position], {
          apply: async (target, plan) => ({
            keyframesWritten: plan.samples.length - 2,
            message: "",
            target,
            warning:
              "Premiere did not confirm linear interpolation on 2 of 26 keys.",
          }),
        })}
      />,
    );
    enterPanel();
    await screen.findByText("Transform / Position");
    fireEvent.click(screen.getByRole("button", { name: "Apply animation" }));
    const status = await screen.findByRole("status");
    expect(status.textContent).toContain("24 intermediate keyframes updated");
    expect(status.textContent).toContain(
      "did not confirm linear interpolation",
    );
  });

  it("has no motion preview", async () => {
    render(<App host={pairHost([position])} />);
    enterPanel();
    await screen.findByText("Transform / Position");
    expect(screen.queryByRole("region", { name: "Motion preview" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Replay preview" })).toBeNull();
  });
});

describe("light and dark themes", () => {
  afterEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
  });

  it("switches to the dark theme from the header and remembers it", () => {
    render(<App host={createCepHost()} />);
    const toggle = screen.getByRole("button", { name: "Dark theme" });
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    expect(document.documentElement.dataset.theme).toBe("light");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem("z-motion-theme")).toBe("dark");
    fireEvent.click(toggle);
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem("z-motion-theme")).toBe("light");
  });

  it("opens in the theme chosen last time", () => {
    localStorage.setItem("z-motion-theme", "dark");
    render(<App host={createCepHost()} />);
    expect(
      screen
        .getByRole("button", { name: "Dark theme" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });
});
