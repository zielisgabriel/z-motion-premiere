import type {
  MotionBlurSnapshot,
  MotionBlurTarget,
} from "../application/host-port";
import { shutterPresets, validateShutterAngle } from "../domain/motion-blur";

export function MotionBlurControls({
  snapshot,
  target,
  angle,
  pending,
  available,
  onTargetChange,
  onAngleChange,
  onApply,
  onRefresh,
}: {
  snapshot?: MotionBlurSnapshot;
  target?: MotionBlurTarget;
  angle: number;
  pending: boolean;
  available: boolean;
  onTargetChange: (id: string) => void;
  onAngleChange: (angle: number) => void;
  onApply: () => void;
  onRefresh: () => void;
}) {
  let invalid = "";
  try {
    validateShutterAngle(angle);
  } catch (error) {
    invalid = (error as Error).message;
  }
  return (
    <section className="motion-blur-controls" aria-label="Motion blur">
      <div className="blur-heading">
        <h2>Motion blur</h2>
        <span>
          {target
            ? target.useCompositionShutterAngle
              ? "Current: composition"
              : `Current: ${target.shutterAngle}°`
            : "Transform effect"}
        </span>
      </div>
      <div className="blur-selection">
        <span>
          {snapshot?.clipName
            ? `Clip: ${snapshot.clipName}`
            : "Select a clip in the timeline"}
        </span>
        <button
          type="button"
          disabled={!available || pending}
          onClick={onRefresh}
        >
          Refresh clip
        </button>
      </div>
      {snapshot && snapshot.targets.length > 1 && (
        <label className="property-choice blur-choice">
          <span>Transform effect</span>
          <select
            aria-label="Transform effect"
            value={target?.id ?? ""}
            disabled={pending}
            onChange={(event) => onTargetChange(event.target.value)}
          >
            <option value="">Choose an effect</option>
            {snapshot.targets.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.label}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="blur-adjustment">
        <label>
          Shutter angle (°)
          <input
            type="number"
            min="0"
            max="360"
            step="1"
            value={Number.isNaN(angle) ? "" : angle}
            disabled={pending}
            onChange={(event) => onAngleChange(event.target.valueAsNumber)}
          />
        </label>
        <button
          className="blur-apply"
          type="button"
          disabled={!available || !target || pending || !!invalid}
          onClick={onApply}
        >
          Apply blur to clip
        </button>
      </div>
      <div
        className="blur-presets"
        role="group"
        aria-label="Shutter angle presets"
      >
        {shutterPresets.map((preset) => (
          <button
            type="button"
            key={preset}
            disabled={pending}
            aria-pressed={angle === preset}
            onClick={() => onAngleChange(preset)}
          >
            {preset === 0 ? "Off" : `${preset}°`}
          </button>
        ))}
      </div>
      {invalid && (
        <p className="feedback error" role="alert">
          {invalid}
        </p>
      )}
      <p className="target-hint">
        {!available
          ? "Open Z Motion in Premiere to apply motion blur."
          : target
            ? "Applies to this clip's Transform for its full duration. No keyframe selection needed."
            : snapshot?.targets.length
              ? "Choose the Transform effect to adjust."
              : snapshot?.message ||
                "Select a clip with the Transform effect. No keyframe selection needed."}
      </p>
    </section>
  );
}
