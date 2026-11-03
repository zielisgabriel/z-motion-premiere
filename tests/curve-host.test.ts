import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { describe, expect, it } from "vitest";
import {
  createEasingPlan,
  type Curve,
  type NumericValue,
} from "../src/domain/easing-curve";

class AdobeTime {
  ticks = "0";
  get seconds() {
    return Number(this.ticks) / 254016000000;
  }
  set seconds(value: number) {
    this.ticks = String(Math.round(value * 254016000000));
  }
}

function fixture(
  options: {
    value?: [NumericValue, NumericValue];
    secondProperty?: boolean;
    speed?: number;
    cursor?: number;
    failWrite?: boolean;
    clamp?: boolean;
    voidReturns?: boolean;
    trueReturns?: boolean;
    scalarStorage?: "float32" | "fixed16";
    startTicks?: string;
    secondsOnly?: boolean;
    refuseAdd?: boolean;
    timeOnly?: boolean;
    misplacedAdd?: boolean;
    throwAfterAdd?: boolean;
    frameTicks?: string;
    endTicks?: string;
  } = {},
) {
  const frames = new Map<string, NumericValue>([
    [options.startTicks ?? "2540160000000", options.value?.[0] ?? 20],
    [options.endTicks ?? "2580802560000", options.value?.[1] ?? 100],
  ]);
  const writes: { timeTicks: string; value: NumericValue }[] = [];
  const removed: string[] = [];
  const interpolation: string[] = [];
  function keyTicks(input: AdobeTime | number): string | undefined {
    if (options.secondsOnly && typeof input !== "number") return undefined;
    if (options.timeOnly && typeof input === "number") return undefined;
    if (typeof input !== "number") return input.ticks;
    const converted = new AdobeTime();
    converted.seconds = input;
    return converted.ticks;
  }
  const nativeResult = () =>
    options.trueReturns ? true : options.voidReturns ? undefined : 0;
  const parameter = {
    displayName: "Scale",
    areKeyframesSupported: () => true,
    isTimeVarying: () => true,
    getKeys: () =>
      [...frames.keys()]
        .sort((a, b) => Number(a) - Number(b))
        .map((ticks) => Object.assign(new AdobeTime(), { ticks })),
    getValueAtKey: (time: AdobeTime) => frames.get(time.ticks),
    addKey: (time: AdobeTime | number) => {
      const requested = keyTicks(time);
      const ticks = options.misplacedAdd ? "0" : requested;
      if (!ticks) return 1;
      if (options.refuseAdd) return nativeResult();
      if (frames.has(ticks)) return 1;
      frames.set(ticks, options.value?.[0] ?? 20);
      if (options.throwAfterAdd)
        throw new Error("Unknown error after native creation");
      return nativeResult();
    },
    removeKey: (time: AdobeTime | number) => {
      const ticks = keyTicks(time);
      if (!ticks) return 1;
      removed.push(ticks);
      frames.delete(ticks);
      return nativeResult();
    },
    setValueAtKey: (time: AdobeTime | number, value: NumericValue) => {
      const ticks = keyTicks(time);
      if (!ticks || options.failWrite) return 1;
      const stored =
        typeof value !== "number"
          ? value
          : options.scalarStorage === "float32"
            ? Math.fround(value)
            : options.scalarStorage === "fixed16"
              ? Math.round(value * 65536) / 65536
              : value;
      const next =
        options.clamp && typeof value === "number"
          ? Math.min(50, value)
          : stored;
      frames.set(ticks, next);
      writes.push({ timeTicks: ticks, value: next });
      return nativeResult();
    },
    setInterpolationTypeAtKey: (time: AdobeTime | number) => {
      const ticks = keyTicks(time);
      if (!ticks) return 1;
      interpolation.push(ticks);
      return nativeResult();
    },
  };
  const properties = options.secondProperty
    ? [parameter, { ...parameter, displayName: "Rotation" }]
    : [parameter];
  const clip = {
    nodeId: "clip-1",
    name: "Test shot",
    mediaType: "Video",
    start: { seconds: 30 },
    end: { seconds: 40 },
    inPoint: {
      seconds: Number(options.startTicks ?? "2540160000000") / 254016000000,
    },
    getSpeed: () => options.speed ?? 1,
    isSpeedReversed: () => false,
    components: Object.assign(
      [
        {
          displayName: "Test effect",
          matchName: "test-effect",
          properties: Object.assign(properties, {
            numItems: properties.length,
          }),
        },
      ],
      { numItems: 1 },
    ),
  };
  const selection = [clip];
  let cursor = options.cursor ?? 30.08;
  const sequence = {
    sequenceID: "sequence-1",
    timebase: options.frameTicks ?? "10160640000",
    getSelection: () => selection,
    getPlayerPosition: () => ({ seconds: cursor }),
  };
  const context = createContext({
    app: {
      version: "26.5.1",
      project: { documentID: "project-1", activeSequence: sequence },
    },
    Time: AdobeTime,
  });
  runInContext(
    readFileSync("host/json-codec.jsx", "utf8") +
      "\n" +
      readFileSync("host/premiere-host.jsx", "utf8"),
    context,
  );
  function dispatch(operation: string, payload: unknown = {}) {
    context.input = JSON.stringify({ protocol: 2, operation, payload });
    return JSON.parse(runInContext("ZMotion.dispatch(input)", context));
  }
  function apply(curve: Curve = [0, 0, 1, 1]) {
    const target = dispatch("inspect").data.targets[0];
    return dispatch("apply-curve", {
      target,
      plan: createEasingPlan(target, curve),
    });
  }
  return {
    dispatch,
    apply,
    writes,
    removed,
    interpolation,
    frames,
    parameter,
    selection,
    clip,
    context,
    setCursor: (next: number) => {
      cursor = next;
    },
  };
}

describe("existing-keyframe Premiere contract", () => {
  it("accepts float32 Scale readback at a one-hour source time while preserving the original keys", () => {
    const host = fixture({
      scalarStorage: "float32",
      secondsOnly: true,
      trueReturns: true,
      startTicks: "914660812800000",
      endTicks: "914787820800000",
      frameTicks: "8467200000",
      value: [0, 200],
    });
    expect(host.apply()).toMatchObject({
      ok: true,
      data: { keyframesWritten: 14 },
    });
    expect(host.frames.get("914669280000000")).toBe(13.333333015441895);
    expect(host.frames.get("914660812800000")).toBe(0);
    expect(host.frames.get("914787820800000")).toBe(200);
    expect(host.frames.size).toBe(16);
  });

  it("accepts float32 readback for large Scale values without losing endpoint values", () => {
    const host = fixture({
      scalarStorage: "float32",
      trueReturns: true,
      frameTicks: "8467200000",
      endTicks: "2667168000000",
      value: [0, 10000],
    });
    expect(host.apply()).toMatchObject({
      ok: true,
      data: { keyframesWritten: 14 },
    });
    expect(host.frames.get("2548627200000")).toBe(666.6666870117188);
    expect(host.frames.get("2540160000000")).toBe(0);
    expect(host.frames.get("2667168000000")).toBe(10000);
  });

  it("accepts fixed-point scalar readback with overshoot and curve reapplication", () => {
    const host = fixture({ scalarStorage: "fixed16", trueReturns: true });
    expect(host.apply([0.34, 1.56, 0.64, 1]).ok).toBe(true);
    expect(host.frames.get("2570641920000")).toBeGreaterThan(100);
    expect(host.apply([0.42, 0, 1, 1]).ok).toBe(true);
    expect(host.frames.get("2560481280000")).toBeCloseTo(45.22854, 4);
    expect(host.frames.get("2540160000000")).toBe(20);
    expect(host.frames.get("2580802560000")).toBe(100);
    expect(host.frames.size).toBe(5);
  });

  it("rejects a scalar value mismatch even when Premiere returns true and includes both values", () => {
    const host = fixture({ trueReturns: true });
    const write = host.parameter.setValueAtKey;
    host.parameter.setValueAtKey = (time, value) =>
      write(time, typeof value === "number" ? value + 0.001 : value);
    expect(host.apply()).toMatchObject({
      ok: false,
      error: expect.stringContaining(
        "Requested: 40. Stored: 40.001. Native result: true.",
      ),
    });
  });

  it("rejects a no-op scalar write that reports native success", () => {
    const host = fixture({ trueReturns: true });
    host.parameter.setValueAtKey = () => true;
    expect(host.apply()).toMatchObject({
      ok: false,
      error: expect.stringContaining("Requested: 40. Stored: 20."),
    });
  });

  it("does not relax endpoint preservation when scalar readback tolerates storage rounding", () => {
    const host = fixture({ value: [0, 200], scalarStorage: "float32" });
    host.parameter.setInterpolationTypeAtKey = () => {
      host.frames.set("2540160000000", 0.000005);
      return true;
    };
    expect(host.apply()).toMatchObject({
      ok: false,
      error: expect.stringContaining(
        "Premiere changed an endpoint or a neighboring keyframe.",
      ),
    });
  });

  it("accepts native void returns only after verifying the key and its value", () => {
    const host = fixture({ voidReturns: true });
    expect(host.apply()).toMatchObject({
      ok: true,
      data: { keyframesWritten: 3 },
    });
    expect(host.frames.get("2560481280000")).toBe(60);
  });

  it("writes Transform Position through seconds-based native mutation calls", () => {
    const host = fixture({
      secondsOnly: true,
      voidReturns: true,
      value: [
        [0.5, 0.5],
        [5.295, 0.5],
      ],
    });
    expect(host.apply()).toMatchObject({
      ok: true,
      data: { keyframesWritten: 3 },
    });
    expect(host.frames.get("2560481280000")).toEqual([2.8975, 0.5]);
    expect(host.frames.get("2540160000000")).toEqual([0.5, 0.5]);
    expect(host.frames.get("2580802560000")).toEqual([5.295, 0.5]);
  });

  it.each([true, false])(
    "rejects no-op creation even when the native result looks successful (void: %s)",
    (voidReturns) => {
      const host = fixture({ voidReturns, refuseAdd: true });
      expect(host.apply().ok).toBe(false);
      expect(host.frames.size).toBe(2);
      expect(host.writes).toEqual([]);
    },
  );

  it("keeps Time-object-only hosts working when reapplying a curve", () => {
    const host = fixture({ timeOnly: true, voidReturns: true });
    expect(host.apply().ok).toBe(true);
    expect(host.apply([0.42, 0, 1, 1]).ok).toBe(true);
    expect(host.frames.size).toBe(5);
    expect(host.frames.get("2560481280000")).toBeCloseTo(45.22854, 4);
  });

  it("does not retain keys created at the wrong time or delete a pre-existing key there", () => {
    const host = fixture({ misplacedAdd: true, voidReturns: true });
    expect(host.apply().ok).toBe(false);
    expect(host.frames.size).toBe(2);
    expect(host.frames.has("0")).toBe(false);
    host.frames.set("0", -50);
    expect(host.apply().ok).toBe(false);
    expect(host.frames.get("0")).toBe(-50);
    expect(host.frames.size).toBe(3);
  });

  it("verifies native creation even when addKey throws after committing it", () => {
    const host = fixture({ throwAfterAdd: true });
    expect(host.apply()).toMatchObject({
      ok: true,
      data: { keyframesWritten: 3 },
    });
    expect(host.frames.get("2560481280000")).toBe(60);
  });

  it("fills a 30 fps Transform Position range with overshoot while preserving its endpoints", () => {
    const host = fixture({
      secondsOnly: true,
      voidReturns: true,
      frameTicks: "8467200000",
      endTicks: "2667168000000",
      value: [
        [0.5, 0.5],
        [5.295, 0.5],
      ],
    });
    expect(host.apply([0.34, 1.56, 0.64, 1])).toMatchObject({
      ok: true,
      data: { keyframesWritten: 14 },
    });
    expect(
      (host.frames.get("2624832000000") as [number, number])[0],
    ).toBeGreaterThan(5.295);
    expect(host.frames.get("2540160000000")).toEqual([0.5, 0.5]);
    expect(host.frames.get("2667168000000")).toEqual([5.295, 0.5]);
    expect(host.frames.size).toBe(16);
  });

  it("finds the pair surrounding the source-time playhead on a trimmed clip", () => {
    const host = fixture();
    const snapshot = host.dispatch("inspect").data;
    expect(snapshot.targets).toHaveLength(1);
    expect(snapshot.targets[0]).toMatchObject({
      label: "Test effect / Scale",
      startTicks: "2540160000000",
      endTicks: "2580802560000",
      startValue: 20,
      endValue: 100,
    });
  });

  it("only writes intermediate frames and preserves the original endpoint values and times", () => {
    const host = fixture();
    expect(host.apply()).toMatchObject({
      ok: true,
      data: { keyframesWritten: 3 },
    });
    expect(host.writes).toEqual([
      { timeTicks: "2550320640000", value: 40 },
      { timeTicks: "2560481280000", value: 60 },
      { timeTicks: "2570641920000", value: 80 },
    ]);
    expect(host.frames.get("2540160000000")).toBe(20);
    expect(host.frames.get("2580802560000")).toBe(100);
    expect(host.removed).toEqual([]);
  });

  it("keeps the original pair when reapplying after generated keys have been inserted", () => {
    const host = fixture();
    host.apply();
    expect(host.dispatch("inspect").data.targets[0].endTicks).toBe(
      "2580802560000",
    );
    expect(host.apply([0.42, 0, 1, 1]).ok).toBe(true);
    expect(host.frames.size).toBe(5);
    expect(host.frames.get("2560481280000")).toBeCloseTo(45.22854, 4);
  });

  it("does not guess a property when more than one has an eligible pair", () => {
    expect(
      fixture({ secondProperty: true }).dispatch("inspect").data.targets,
    ).toHaveLength(2);
  });

  it("refuses a stale preview, retimed clips and a playhead outside the interval", () => {
    const host = fixture();
    const target = host.dispatch("inspect").data.targets[0];
    const plan = createEasingPlan(target, [0, 0, 1, 1]);
    host.frames.set("2580802560000", 120);
    expect(host.dispatch("apply-curve", { target, plan }).error).toContain(
      "changed",
    );
    expect(host.writes).toEqual([]);
    expect(fixture({ speed: 2 }).dispatch("inspect").data.targets).toEqual([]);
    expect(fixture({ cursor: 32 }).dispatch("inspect").data.targets).toEqual(
      [],
    );
  });

  it("preserves neighboring keyframes outside the chosen pair", () => {
    const host = fixture();
    host.frames.set("2514758400000", -10);
    host.frames.set("2606204160000", 150);
    expect(host.apply().ok).toBe(true);
    expect(host.frames.get("2514758400000")).toBe(-10);
    expect(host.frames.get("2606204160000")).toBe(150);
  });

  it("does not claim success if Adobe rejects or clamps a generated value", () => {
    expect(fixture({ failWrite: true }).apply()).toMatchObject({ ok: false });
    expect(fixture({ clamp: true }).apply().error).toContain("Undo");
  });

  it("rejects obsolete clip-animation commands and malformed JSON", () => {
    const host = fixture();
    expect(host.dispatch("animate").ok).toBe(false);
    host.context.input = '{"protocol":2,"payload":(app.version="changed")}';
    expect(
      JSON.parse(runInContext("ZMotion.dispatch(input)", host.context)).ok,
    ).toBe(false);
    expect(host.dispatch("inspect").data.hostVersion).toBe("26.5.1");
  });
});
