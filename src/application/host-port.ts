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
  motionBlur?: MotionBlurSnapshot;
}

export interface MotionBlurTarget {
  id: string;
  label: string;
  stateToken: string;
  shutterAngle: number;
  useCompositionShutterAngle: boolean;
}

export interface MotionBlurSnapshot {
  targets: MotionBlurTarget[];
  message: string;
  clipName?: string;
  /** Video clips selected in the timeline; Add Transform works on all of them. */
  selectedClips?: number;
  /** Identifies that selection so Premiere can refuse a changed one. */
  selectionToken?: string;
}

export interface TransformResult {
  added: number;
  message: string;
  /** The new Transform, when a single clip received one. */
  transformId?: string;
}

export interface MotionBlurResult {
  target: MotionBlurTarget;
  message: string;
}

export interface HostResult {
  keyframesWritten: number;
  message: string;
  target: CurveTarget;
  /** Something Premiere did not confirm, although every frame value was verified. */
  warning?: string;
}

export interface HostPort {
  readonly available: boolean;
  inspect(preferred?: RangeReference): Promise<HostSnapshot>;
  apply(target: CurveTarget, plan: EasingPlan): Promise<HostResult>;
  applyMotionBlur(
    target: MotionBlurTarget,
    shutterAngle: number,
  ): Promise<MotionBlurResult>;
  addTransform(selectionToken: string): Promise<TransformResult>;
}
