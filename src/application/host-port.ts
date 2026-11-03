import type {
  EasingPlan,
  KeyframeRange,
  ValueKind,
} from "../domain/easing-curve";

export interface CurveTarget extends KeyframeRange {
  id: string;
  label: string;
  kind: ValueKind;
  rangeToken: string;
}

export interface RangeReference {
  id: string;
  startTicks: string;
  endTicks: string;
}

export interface HostSnapshot {
  hostVersion: string;
  targets: CurveTarget[];
  message: string;
}

export interface HostResult {
  keyframesWritten: number;
  message: string;
  target: CurveTarget;
}

export interface HostPort {
  readonly available: boolean;
  inspect(preferred?: RangeReference): Promise<HostSnapshot>;
  apply(target: CurveTarget, plan: EasingPlan): Promise<HostResult>;
}
