export type Curve = [number, number, number, number];
export type NumericValue = number | [number, number];
export type ValueKind = "position" | "scale" | "rotation" | "opacity" | "value";

export interface KeyframeRange {
  startTicks: string;
  endTicks: string;
  frameTicks: string;
  startValue: NumericValue;
  endValue: NumericValue;
  limits?: [number, number];
}

export interface EasingSample {
  timeTicks: string;
  progress: number;
  value: NumericValue;
}

export interface EasingPlan {
  curve: Curve;
  durationSeconds: number;
  frameCount: number;
  samples: EasingSample[];
}

export const defaultCurve: Curve = [0.16, 1, 0.3, 1];

export const curvePresets: { name: string; curve: Curve }[] = [
  { name: "Linear", curve: [0, 0, 1, 1] },
  { name: "Ease in", curve: [0.42, 0, 1, 1] },
  { name: "Ease out", curve: [0, 0, 0.58, 1] },
  { name: "Ease both", curve: [0.42, 0, 0.58, 1] },
  { name: "Snappy", curve: [0.16, 1, 0.3, 1] },
  { name: "Overshoot", curve: [0.34, 1.56, 0.64, 1] },
];

export function isNumericValue(value: unknown): value is NumericValue {
  return typeof value === "number"
    ? Number.isFinite(value)
    : Array.isArray(value) &&
        value.length === 2 &&
        value.every(
          (item) => typeof item === "number" && Number.isFinite(item),
        );
}

export function validateCurve(value: unknown): Curve {
  if (!Array.isArray(value) || value.length !== 4)
    throw new Error("A curve needs four coordinates.");
  value.forEach((coordinate, index) => {
    const min = index % 2 === 0 ? 0 : -2;
    const max = index % 2 === 0 ? 1 : 3;
    if (
      typeof coordinate !== "number" ||
      !Number.isFinite(coordinate) ||
      coordinate < min ||
      coordinate > max
    )
      throw new Error(`Curve coordinates must stay between ${min} and ${max}.`);
  });
  return [...value] as Curve;
}

function cubic(t: number, first: number, second: number): number {
  const inverse = 1 - t;
  return (
    3 * inverse * inverse * t * first + 3 * inverse * t * t * second + t * t * t
  );
}

export function evaluateCurve(curve: Curve, progress: number): number {
  if (progress <= 0) return 0;
  if (progress >= 1) return 1;
  if (curve[0] === curve[1] && curve[2] === curve[3]) return progress;
  let low = 0;
  let high = 1;
  for (let iteration = 0; iteration < 36; iteration += 1) {
    const middle = (low + high) / 2;
    if (cubic(middle, curve[0], curve[2]) < progress) low = middle;
    else high = middle;
  }
  return cubic((low + high) / 2, curve[1], curve[3]);
}

function ticks(value: string): bigint {
  if (typeof value !== "string" || !/^-?(0|[1-9][0-9]{0,20})$/.test(value))
    throw new Error("Premiere returned an invalid keyframe time.");
  return BigInt(value);
}

function interpolate(
  first: NumericValue,
  last: NumericValue,
  progress: number,
): NumericValue {
  const blend = (start: number, end: number) =>
    Number((start + (end - start) * progress).toPrecision(14));
  if (typeof first === "number" && typeof last === "number")
    return blend(first, last);
  if (Array.isArray(first) && Array.isArray(last))
    return [blend(first[0], last[0]), blend(first[1], last[1])];
  throw new Error("The two keyframes must have the same numeric value type.");
}

export function createEasingPlan(
  range: KeyframeRange,
  input: Curve,
): EasingPlan {
  const curve = validateCurve(input);
  const start = ticks(range.startTicks);
  const end = ticks(range.endTicks);
  const frame = ticks(range.frameTicks);
  if (frame <= 0n || end <= start)
    throw new Error("Choose two different keyframes in chronological order.");
  if ((end - start) % frame !== 0n)
    throw new Error(
      "The two keyframes must align with the sequence frame rate.",
    );
  const frameCount = Number((end - start) / frame);
  if (frameCount < 2 || frameCount > 1800)
    throw new Error("Choose keyframes between 2 and 1800 frames apart.");
  if (!isNumericValue(range.startValue) || !isNumericValue(range.endValue))
    throw new Error(
      "Only numeric and two-dimensional keyframes are supported.",
    );
  const samples = Array.from({ length: frameCount + 1 }, (_, index) => {
    const progress = evaluateCurve(curve, index / frameCount);
    const value =
      index === 0
        ? range.startValue
        : index === frameCount
          ? range.endValue
          : interpolate(range.startValue, range.endValue, progress);
    const coordinates = typeof value === "number" ? [value] : value;
    if (
      range.limits &&
      coordinates.some(
        (coordinate) =>
          coordinate < range.limits![0] || coordinate > range.limits![1],
      )
    )
      throw new Error(
        "This curve exceeds the property's supported range. Reduce the curve overshoot.",
      );
    return {
      timeTicks: (start + BigInt(index) * frame).toString(),
      progress,
      value,
    };
  });
  return {
    curve,
    durationSeconds: Number(end - start) / 254016000000,
    frameCount,
    samples,
  };
}
