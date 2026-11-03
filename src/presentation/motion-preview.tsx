import { useEffect, useMemo, useRef } from "react";
import type {
  EasingPlan,
  NumericValue,
  ValueKind,
} from "../domain/easing-curve";

function displayValue(value: NumericValue): string {
  return typeof value === "number"
    ? Number(value.toFixed(3)).toString()
    : value.map((coordinate) => Number(coordinate.toFixed(3))).join(", ");
}

function previewFrames(plan: EasingPlan, kind: ValueKind): Keyframe[] {
  const first = plan.samples[0].value;
  const last = plan.samples[plan.samples.length - 1].value;
  return plan.samples.map((sample, index) => {
    let transform = `translateX(${(sample.progress - 0.5) * 140}px)`;
    let opacity = 1;
    if (
      Array.isArray(first) &&
      Array.isArray(last) &&
      Array.isArray(sample.value)
    ) {
      const span = Math.max(
        Math.abs(last[0] - first[0]),
        Math.abs(last[1] - first[1]),
        0.000001,
      );
      transform = `translate(${((sample.value[0] - (first[0] + last[0]) / 2) / span) * 140}px, ${((sample.value[1] - (first[1] + last[1]) / 2) / span) * 90}px)`;
    } else if (
      typeof sample.value === "number" &&
      typeof first === "number" &&
      typeof last === "number"
    ) {
      if (kind === "rotation") transform = `rotate(${sample.value}deg)`;
      if (kind === "scale")
        transform = `scale(${sample.value / Math.max(Math.abs(first), Math.abs(last), 1)})`;
      if (kind === "opacity") {
        transform = "none";
        opacity = sample.value / 100;
      }
    }
    return { offset: index / plan.frameCount, transform, opacity };
  });
}

export function MotionPreview({
  plan,
  kind,
}: {
  plan: EasingPlan | null;
  kind: ValueKind;
}) {
  const shape = useRef<HTMLDivElement>(null);
  const animation = useRef<Animation | null>(null);
  const frames = useMemo(
    () => (plan ? previewFrames(plan, kind) : []),
    [plan, kind],
  );

  useEffect(() => {
    if (
      !plan ||
      !shape.current?.animate ||
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const current = shape.current.animate(frames, {
      duration: plan.durationSeconds * 1000,
      easing: "linear",
      fill: "forwards",
    });
    animation.current = current;
    return () => animation.current?.cancel();
  }, [plan, frames]);

  function replay() {
    if (!plan || !shape.current?.animate) return;
    animation.current?.cancel();
    animation.current = shape.current.animate(frames, {
      duration: plan.durationSeconds * 1000,
      easing: "linear",
      fill: "forwards",
    });
  }

  return (
    <section className="motion-preview" aria-label="Motion preview">
      <div className="preview-topline">
        <span>Motion preview</span>
        <span>
          {plan
            ? `${Number(plan.durationSeconds.toFixed(3))} s / ${plan.frameCount} frames`
            : "Adjust the curve"}
        </span>
      </div>
      <div className="preview-stage">
        <div className="preview-guide" />
        <div ref={shape} className="preview-shape">
          Z
        </div>
      </div>
      <div className="preview-toolbar">
        <span>
          {plan
            ? `${displayValue(plan.samples[0].value)} → ${displayValue(plan.samples[plan.samples.length - 1].value)}`
            : "No valid range"}
        </span>
        <button aria-label="Replay preview" onClick={replay} disabled={!plan}>
          ▷ Replay
        </button>
      </div>
    </section>
  );
}
