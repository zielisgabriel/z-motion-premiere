import type { CurveTarget, HostPort } from "../../src/application/host-port";

export const curveTarget: CurveTarget = {
  id: "position-1",
  label: "Motion / Position",
  kind: "position",
  rangeToken: "unchanged-pair",
  startTicks: "2540160000000",
  endTicks: "2794176000000",
  frameTicks: "10160640000",
  startValue: [0.2, 0.5],
  endValue: [0.8, 0.5],
};

export function createTestHost(overrides: Partial<HostPort> = {}): HostPort {
  return {
    available: true,
    inspect: async () => ({
      hostVersion: "26.5.1",
      targets: [curveTarget],
      message: "",
    }),
    apply: async (target, plan) => ({
      keyframesWritten: plan.samples.length - 2,
      message: "Curve applied. Both endpoint values and times were preserved.",
      target: { ...target, rangeToken: "new-pair-token" },
    }),
    ...overrides,
  };
}
