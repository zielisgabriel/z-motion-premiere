import { describe, expect, it } from "vitest";
import {
  createEasingPlan,
  evaluateCurve,
  type KeyframeRange,
} from "./easing-curve";

const range: KeyframeRange = {
  startTicks: "2540160000000",
  endTicks: "2580802560000",
  frameTicks: "10160640000",
  startValue: 20,
  endValue: 100,
};

describe("easing between existing keyframes", () => {
  it("preserves both endpoint values and times while filling the sequence frames", () => {
    const plan = createEasingPlan(range, [0, 0, 1, 1]);
    expect(plan.samples).toEqual([
      { timeTicks: "2540160000000", progress: 0, value: 20 },
      { timeTicks: "2550320640000", progress: 0.25, value: 40 },
      { timeTicks: "2560481280000", progress: 0.5, value: 60 },
      { timeTicks: "2570641920000", progress: 0.75, value: 80 },
      { timeTicks: "2580802560000", progress: 1, value: 100 },
    ]);
    expect(plan.durationSeconds).toBe(0.16);
  });

  it("interpolates both dimensions from the original position endpoints", () => {
    const plan = createEasingPlan(
      { ...range, startValue: [0.2, 0.8], endValue: [0.8, 0.2] },
      [0, 0, 1, 1],
    );
    expect(plan.samples[2].value).toEqual([0.5, 0.5]);
  });

  it("uses Bezier time inversion and keeps deliberate overshoot", () => {
    expect(evaluateCurve([0.42, 0, 1, 1], 0.5)).toBeCloseTo(0.31536, 4);
    const plan = createEasingPlan(range, [0.34, 1.56, 0.64, 1]);
    expect(plan.samples[3].value).toBeGreaterThan(100);
  });

  it("keeps exact ticks beyond JavaScript's safe integer range", () => {
    const plan = createEasingPlan(
      {
        ...range,
        startTicks: "9007199254740993",
        endTicks: "9007239897300993",
      },
      [0, 0, 1, 1],
    );
    expect(plan.samples[1].timeTicks).toBe("9007209415380993");
    expect(plan.samples[4].timeTicks).toBe("9007239897300993");
  });

  it("rejects subframe, reversed, excessively long and unsupported ranges", () => {
    expect(() =>
      createEasingPlan({ ...range, endTicks: "2580802560001" }, [0, 0, 1, 1]),
    ).toThrow("frame");
    expect(() =>
      createEasingPlan({ ...range, endTicks: range.startTicks }, [0, 0, 1, 1]),
    ).toThrow();
    expect(() =>
      createEasingPlan(
        { ...range, endTicks: "9007239897300993" },
        [0, 0, 1, 1],
      ),
    ).toThrow();
    expect(() =>
      createEasingPlan({ ...range, endValue: [1, 2] }, [0, 0, 1, 1]),
    ).toThrow();
  });

  it("rejects a curve that the target property would clamp instead of showing a false preview", () => {
    expect(() =>
      createEasingPlan({ ...range, limits: [0, 100] }, [0.34, 1.56, 0.64, 1]),
    ).toThrow("range");
  });

  it("rejects malformed curve coordinates", () => {
    expect(() => createEasingPlan(range, [-0.1, 0, 1, 1])).toThrow();
    expect(() => createEasingPlan(range, [0, NaN, 1, 1])).toThrow();
  });
});
