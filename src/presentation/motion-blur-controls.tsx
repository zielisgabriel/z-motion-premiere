import type {
  MotionBlurSnapshot,
  MotionBlurTarget,
} from "../application/host-port";
import { shutterPresets, validateShutterAngle } from "../domain/motion-blur";
import { ChecklistPicker } from "./checklist-picker";

function shutterSetting(effect: MotionBlurTarget) {
  return effect.useCompositionShutterAngle
    ? "composition"
    : `${effect.shutterAngle}°`;
}

export function MotionBlurControls({
  snapshot,
  targets,
  excluded,
  angle,
  pending,
  available,
  feedback,
  onChoose,
  onAngleChange,
  onApply,
  onAddTransform,
  onRefresh,
}: {
  snapshot?: MotionBlurSnapshot;
  /** Every Transform effect on the selected clip. */
  targets: MotionBlurTarget[];
  /** Transform effects the user unchecked. */
  excluded: ReadonlySet<string>;
  angle: number;
  pending: boolean;
  available: boolean;
  feedback?: { tone: "status" | "error"; text: string };
  onChoose: (excluded: Set<string>) => void;
  onAngleChange: (angle: number) => void;
  onApply: () => void;
  onAddTransform: () => void;
  onRefresh: () => void;
}) {
  const selectedClips = snapshot?.selectedClips ?? 0;
  const chosen = targets.filter((effect) => !excluded.has(effect.id));
  const settings = new Set(chosen.map(shutterSetting));
  const current = !targets.length
    ? "Transform effect"
    : !chosen.length
      ? "No Transform chosen"
      : settings.size === 1
        ? `Current: ${[...settings][0]}`
        : "Current: mixed";
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
        <span>{current}</span>
      </div>
      <div className="blur-selection">
        {snapshot?.clipName ? (
          <span className="clip-name" title={snapshot.clipName}>
            Clip: {snapshot.clipName}
          </span>
        ) : selectedClips > 1 ? (
          <span>{selectedClips} clips selected</span>
        ) : (
          <span>Select a clip in the timeline</span>
        )}
        <button
          type="button"
          disabled={!available || pending}
          onClick={onRefresh}
        >
          Refresh clip
        </button>
      </div>
      <button
        type="button"
        className="add-transform"
        disabled={!available || pending || !selectedClips}
        onClick={onAddTransform}
      >
        <span aria-hidden="true">+</span>
        {selectedClips > 1
          ? `Add Transform to ${selectedClips} clips`
          : "Add Transform to clip"}
      </button>
      {targets.length > 1 && (
        <ChecklistPicker
          items={targets}
          excluded={excluded}
          disabled={pending}
          title="Transform effects to blur"
          note="Transform effects on the selected clip."
          verb="Blurs"
          empty="Choose at least one Transform effect."
          detail={shutterSetting}
          onChange={onChoose}
        />
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
          disabled={!available || !chosen.length || pending || !!invalid}
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
      {feedback &&
        (feedback.tone === "error" ? (
          <p className="feedback error" role="alert">
            {feedback.text}
          </p>
        ) : (
          <p className="feedback" role="status">
            {feedback.text}
          </p>
        ))}
      <p className="target-hint">
        {!available
          ? "Open Z Motion in Premiere to apply motion blur."
          : chosen.length
            ? "Applies to this clip's Transform for its full duration. No keyframe selection needed."
            : targets.length
              ? "Choose at least one Transform effect."
              : snapshot?.message ||
                "Select a clip with the Transform effect. No keyframe selection needed."}
      </p>
    </section>
  );
}
