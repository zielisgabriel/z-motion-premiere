import { createEasingPlan, type Curve } from "../domain/easing-curve";
import type { CurveTarget, HostPort, RangeReference } from "./host-port";

export function createCurveService(host: HostPort) {
  return {
    inspect: (preferred?: RangeReference) => host.inspect(preferred),
    prepare: (target: CurveTarget, curve: Curve) =>
      createEasingPlan(target, curve),
    apply: (target: CurveTarget, curve: Curve) =>
      host.apply(target, createEasingPlan(target, curve)),
  };
}
