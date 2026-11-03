import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import {
  curvePresets,
  evaluateCurve,
  type Curve,
} from "../domain/easing-curve";

export function CurveEditor({
  curve,
  onChange,
}: {
  curve: Curve;
  onChange: (curve: Curve) => void;
}) {
  const drag = useRef<{ index: number; min: number; max: number } | null>(null);
  const [dragBounds, setDragBounds] = useState<{
    min: number;
    max: number;
  } | null>(null);
  const min =
    dragBounds?.min ?? Math.min(-0.08, curve[1] - 0.12, curve[3] - 0.12);
  const max =
    dragBounds?.max ?? Math.max(1.08, curve[1] + 0.12, curve[3] + 0.12);
  const x = (value: number) => 36 + value * 328;
  const y = (value: number) => 226 - ((value - min) / (max - min)) * 204;
  const line = Array.from(
    { length: 81 },
    (_, index) =>
      `${index === 0 ? "M" : "L"}${x(index / 80)},${y(evaluateCurve(curve, index / 80))}`,
  ).join(" ");

  function update(index: number, value: number) {
    const next: Curve = [...curve];
    next[index] = Number(
      Math.min(
        index % 2 === 0 ? 1 : 3,
        Math.max(index % 2 === 0 ? 0 : -2, value),
      ).toFixed(3),
    );
    if (Number.isFinite(next[index])) onChange(next);
  }

  function move(event: PointerEvent<SVGCircleElement>) {
    if (!drag.current) return;
    const svg = event.currentTarget.ownerSVGElement!;
    const matrix = svg.getScreenCTM();
    if (!matrix) return;
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const local = point.matrixTransform(matrix.inverse());
    const next: Curve = [...curve];
    const px = local.x;
    const py = local.y;
    next[drag.current.index] = Math.max(0, Math.min(1, (px - 36) / 328));
    next[drag.current.index + 1] = Math.max(
      -2,
      Math.min(
        3,
        drag.current.min +
          ((226 - py) / 204) * (drag.current.max - drag.current.min),
      ),
    );
    onChange(next.map((coordinate) => Number(coordinate.toFixed(3))) as Curve);
  }

  function keyboard(event: KeyboardEvent<SVGCircleElement>, index: number) {
    const directions: Record<string, [number, number]> = {
      ArrowLeft: [index, -0.01],
      ArrowRight: [index, 0.01],
      ArrowUp: [index + 1, 0.01],
      ArrowDown: [index + 1, -0.01],
    };
    const adjustment = directions[event.key];
    if (adjustment) {
      event.preventDefault();
      update(adjustment[0], curve[adjustment[0]] + adjustment[1]);
    }
  }

  return (
    <>
      <div className="curve-monitor">
        <div className="monitor-header">
          <span>Cubic Bezier</span>
          <span>Value / time</span>
        </div>
        <svg
          viewBox="0 0 400 260"
          className="curve-svg"
          aria-label="Editable easing curve"
        >
          {[0, 0.25, 0.5, 0.75, 1].map((value) => (
            <g key={value}>
              <line
                className="graph-grid"
                x1={x(value)}
                x2={x(value)}
                y1="22"
                y2="226"
              />
              <line
                className="graph-grid"
                x1="36"
                x2="364"
                y1={y(value)}
                y2={y(value)}
              />
            </g>
          ))}
          <line
            className="graph-diagonal"
            x1={x(0)}
            y1={y(0)}
            x2={x(1)}
            y2={y(1)}
          />
          <path className="graph-curve" d={line} />
          <line
            className="graph-handle-line"
            x1={x(0)}
            y1={y(0)}
            x2={x(curve[0])}
            y2={y(curve[1])}
          />
          <line
            className="graph-handle-line"
            x1={x(1)}
            y1={y(1)}
            x2={x(curve[2])}
            y2={y(curve[3])}
          />
          {[0, 2].map((index) => (
            <circle
              key={index}
              className="graph-handle"
              cx={x(curve[index])}
              cy={y(curve[index + 1])}
              r="7"
              tabIndex={0}
              role="button"
              aria-label={`${index === 0 ? "First" : "Second"} curve handle; use arrow keys to adjust`}
              onPointerDown={(event) => {
                drag.current = { index, min, max };
                setDragBounds({ min, max });
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerMove={move}
              onPointerUp={() => {
                drag.current = null;
                setDragBounds(null);
              }}
              onPointerCancel={() => {
                drag.current = null;
                setDragBounds(null);
              }}
              onKeyDown={(event) => keyboard(event, index)}
            />
          ))}
          <rect
            x={x(0) - 3}
            y={y(0) - 3}
            width="6"
            height="6"
            className="graph-endpoint"
          />
          <rect
            x={x(1) - 3}
            y={y(1) - 3}
            width="6"
            height="6"
            className="graph-endpoint"
          />
          <text x="36" y="249">
            0
          </text>
          <text x="348" y="249">
            100%
          </text>
        </svg>
        <div className="curve-readout">
          {curve.map((value) => value.toFixed(2)).join(" / ")}
        </div>
      </div>
      <div className="curve-presets" aria-label="Curve presets">
        {curvePresets.map((preset) => (
          <button
            key={preset.name}
            aria-pressed={preset.curve.every(
              (value, index) => value === curve[index],
            )}
            onClick={() => onChange([...preset.curve])}
          >
            {preset.name}
          </button>
        ))}
      </div>
      <div className="coordinate-inputs">
        {["X1", "Y1", "X2", "Y2"].map((label, index) => (
          <label key={label}>
            <span>{label}</span>
            <input
              aria-label={`Curve ${label}`}
              type="number"
              step="0.01"
              min={index % 2 === 0 ? 0 : -2}
              max={index % 2 === 0 ? 1 : 3}
              value={curve[index]}
              onChange={(event) =>
                update(index, event.currentTarget.valueAsNumber)
              }
            />
          </label>
        ))}
      </div>
    </>
  );
}
