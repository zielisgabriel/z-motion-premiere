import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { describe, expect, it } from "vitest";

function fixture({
  language = "en",
  unnamed = false,
  multiple = false,
  matchName = "AE.ADBE Geometry2",
  cursor = 30.5,
  speed = 1,
  reversed = false,
} = {}) {
  const writes: { property: string; value: unknown }[] = [];
  function parameter(displayName: string, initial: unknown) {
    let value = initial;
    return {
      displayName,
      areKeyframesSupported: () => true,
      isTimeVarying: () => false,
      getValue: () => value,
      setValue: (next: unknown): unknown => {
        value = next;
        writes.push({ property: displayName, value: next });
        return undefined;
      },
    };
  }
  function transform() {
    const positionKeys = new Map([
      ["2540160000000", [0.2, 0.5]],
      ["2794176000000", [0.8, 0.5]],
    ]);
    const position = {
      ...parameter("Position", [0.2, 0.5]),
      isTimeVarying: () => true,
      getKeys: () =>
        [...positionKeys.keys()].map((ticks) => ({
          ticks,
          seconds: Number(ticks) / 254016000000,
        })),
      getValueAtKey: (time: { ticks: string }) => positionKeys.get(time.ticks),
    };
    const composition = parameter(
      unnamed
        ? ""
        : language === "pt"
          ? "Usar ângulo do obturador da composição"
          : "Use Composition's Shutter Angle",
      true,
    );
    const angle = parameter(
      language === "pt" ? "Ângulo do obturador" : "Shutter Angle",
      0,
    );
    const properties = [
      parameter("Anchor Point", [0.5, 0.5]),
      position,
      parameter("", true),
      parameter("Scale", 100),
      parameter("Scale Width", 100),
      parameter("Skew", 0),
      parameter("Skew Axis", 0),
      parameter("Rotation", 0),
      parameter("Opacity", 100),
      composition,
      angle,
      parameter("Sampling", 0),
    ];
    const component = {
      displayName: language === "pt" ? "Transformar" : "Transform",
      matchName,
      properties: Object.assign(properties, { numItems: properties.length }),
    };
    return { component, angle, composition, positionKeys };
  }
  const first = transform();
  const effects = multiple ? [first, transform()] : [first];
  const components = Object.assign(
    effects.map((effect) => effect.component),
    { numItems: effects.length },
  );
  const clip = {
    nodeId: "clip-1",
    name: "mouse-arrow.png",
    mediaType: "Video",
    start: { seconds: 30 },
    end: { seconds: 40 },
    inPoint: { seconds: 10 },
    getSpeed: () => speed,
    isSpeedReversed: () => reversed,
    components,
  };
  const selection = [clip];
  const sequence = {
    sequenceID: "sequence-1",
    timebase: "10160640000",
    getSelection: () => selection,
    getPlayerPosition: () => ({ seconds: cursor }),
  };
  const state = createContext({
    app: {
      version: "26.5.1",
      project: {
        documentID: "project-1",
        activeSequence: sequence,
      },
    },
  });
  runInContext(
    readFileSync("host/json-codec.jsx", "utf8") +
      "\n" +
      readFileSync("host/premiere-host.jsx", "utf8"),
    state,
  );
  function dispatch(operation: string, payload: unknown = {}) {
    state.input = JSON.stringify({ protocol: 2, operation, payload });
    return JSON.parse(runInContext("ZMotion.dispatch(input)", state));
  }
  const inspect = () => dispatch("inspect").data.motionBlur;
  const apply = (shutterAngle: number) =>
    dispatch("apply-motion-blur", {
      target: inspect().targets[0],
      shutterAngle,
    });
  return {
    ...first,
    effects,
    components,
    clip,
    sequence,
    selection,
    writes,
    dispatch,
    inspect,
    apply,
  };
}

describe("Transform motion blur native contract", () => {
  it.each([{ language: "en" }, { language: "pt" }, { unnamed: true }])(
    "discovers %j controls read-only and sets blur without touching the movement keys",
    (options) => {
      const host = fixture(options);
      const before = [...host.positionKeys.entries()];
      expect(host.inspect().targets).toHaveLength(1);
      expect(host.writes).toEqual([]);
      expect(host.apply(180)).toMatchObject({
        ok: true,
        data: {
          target: { shutterAngle: 180, useCompositionShutterAngle: false },
        },
      });
      expect(host.writes).toHaveLength(2);
      expect(host.angle.getValue()).toBe(180);
      expect(host.composition.getValue()).toBe(false);
      expect([...host.positionKeys.entries()]).toEqual(before);
    },
  );

  it("handles numeric checkbox values and returns a fresh snapshot for adjustment and Off", () => {
    const host = fixture();
    host.composition.setValue(1);
    const result = host.apply(270);
    expect(result.ok).toBe(true);
    expect(host.composition.getValue()).toBe(0);
    expect(
      host.dispatch("apply-motion-blur", {
        target: result.data.target,
        shutterAngle: 0,
      }),
    ).toMatchObject({
      ok: true,
      data: {
        target: { shutterAngle: 0, useCompositionShutterAngle: false },
        message: expect.stringContaining("disabled"),
      },
    });
  });

  it.each([-1, 361, null, "180"])(
    "rejects invalid angle %j without writes",
    (shutterAngle) => {
      const host = fixture();
      expect(
        host.dispatch("apply-motion-blur", {
          target: host.inspect().targets[0],
          shutterAngle,
        }).ok,
      ).toBe(false);
      expect(host.writes).toEqual([]);
    },
  );

  it.each(["clip", "trim", "angle", "composition", "layout", "animated"])(
    "rejects stale %s before writing",
    (change) => {
      const host = fixture();
      const target = host.inspect().targets[0];
      if (change === "clip") host.clip.nodeId = "another-clip";
      if (change === "trim") host.clip.end.seconds = 39;
      if (change === "angle") host.angle.setValue(90);
      if (change === "composition") host.composition.setValue(false);
      if (change === "layout")
        host.component.properties[8].displayName = "changed";
      if (change === "animated") host.angle.isTimeVarying = () => true;
      host.writes.length = 0;
      expect(
        host.dispatch("apply-motion-blur", { target, shutterAngle: 180 }),
      ).toMatchObject({ ok: false, error: expect.stringContaining("changed") });
      expect(host.writes).toEqual([]);
    },
  );

  it("refuses animated shutter controls, unknown layouts and non-Transform effects", () => {
    const animated = fixture();
    animated.angle.isTimeVarying = () => true;
    expect(animated.inspect()).toMatchObject({
      targets: [],
      message: expect.stringContaining("keyframes"),
    });
    const unknown = fixture();
    unknown.angle.displayName = "Unrecognized property";
    expect(unknown.inspect()).toMatchObject({
      targets: [],
      message: expect.stringContaining("not supported"),
    });
    const unknownVersion = fixture({ matchName: "AE.ADBE Geometry3" });
    expect(unknownVersion.inspect()).toMatchObject({
      targets: [],
      message: expect.stringContaining("effect version is not supported"),
    });
    expect(unknownVersion.writes).toEqual([]);
    const motion = fixture();
    motion.component.matchName = "AE.ADBE Motion";
    motion.component.displayName = "Motion";
    expect(motion.inspect()).toMatchObject({
      targets: [],
      message: expect.stringContaining("Add the Transform"),
    });
  });

  it("requires explicit effect identity when multiple Transform instances are present", () => {
    const host = fixture({ multiple: true });
    const targets = host.inspect().targets;
    expect(targets).toHaveLength(2);
    expect(targets[0].id).not.toBe(targets[1].id);
    expect(
      host.dispatch("apply-motion-blur", {
        target: targets[1],
        shutterAngle: 360,
      }).ok,
    ).toBe(true);
    expect(host.effects[0].angle.getValue()).toBe(0);
    expect(host.effects[1].angle.getValue()).toBe(360);
  });

  it("restores the prior toggle and angle when a native write is a no-op or clamps", () => {
    for (const behavior of ["no-op", "clamp"]) {
      const host = fixture();
      const write = host.angle.setValue;
      host.angle.setValue = (value) =>
        behavior === "no-op" ? true : write(Math.min(Number(value), 90));
      expect(host.apply(180)).toMatchObject({
        ok: false,
        error: expect.stringContaining(
          "Previous shutter settings were restored",
        ),
      });
      expect(host.angle.getValue()).toBe(0);
      expect(host.composition.getValue()).toBe(true);
    }
  });

  it("reports a partial change if native rollback also fails", () => {
    const host = fixture();
    const write = host.composition.setValue;
    host.composition.setValue = (value) =>
      value === false ? write(value) : undefined;
    host.angle.setValue = () => undefined;
    expect(host.apply(180)).toMatchObject({
      ok: false,
      error: expect.stringContaining("Use Premiere Undo"),
    });
    expect(host.composition.getValue()).toBe(false);
  });

  it("accepts a thrown native return only when readback confirms the requested value", () => {
    const host = fixture();
    const write = host.angle.setValue;
    host.angle.setValue = (value) => {
      write(value);
      throw new Error("Native error after write");
    };
    expect(host.apply(180).ok).toBe(true);
  });

  it("works without a current keyframe pair, and rejects no clip or multiple selected clips", () => {
    const host = fixture();
    host.positionKeys.clear();
    expect(host.dispatch("inspect").data.targets).toEqual([]);
    expect(host.apply(180).ok).toBe(true);
    host.selection.push(host.clip);
    expect(host.inspect().targets).toEqual([]);
    host.selection.length = 0;
    expect(host.inspect().targets).toEqual([]);
  });
});

describe("clip-level blur regression", () => {
  it.each([
    "AE.ADBE Geometry2",
    "ADBE Geometry2",
    "AE.ADBE Geometry",
    "ADBE Geometry",
  ])(
    "recognizes %s on a selected clip after its movement keyframes",
    (matchName) => {
      const host = fixture({ matchName, unnamed: true, cursor: 31.27 });
      const snapshot = host.dispatch("inspect").data;
      expect(snapshot.targets).toEqual([]);
      expect(snapshot.motionBlur.targets).toHaveLength(1);
      const originalKeys = [...host.positionKeys];
      expect(host.apply(360)).toMatchObject({
        ok: true,
        data: {
          target: { shutterAngle: 360, useCompositionShutterAngle: false },
        },
      });
      expect([...host.positionKeys]).toEqual(originalKeys);
    },
  );

  it.each([{ speed: 2 }, { reversed: true }])(
    "configures the clip even when Curves does not support its playback: %j",
    (options) => {
      const host = fixture(options);
      const snapshot = host.dispatch("inspect").data;
      expect(snapshot.targets).toEqual([]);
      expect(snapshot.motionBlur.targets).toHaveLength(1);
      expect(host.apply(180).ok).toBe(true);
    },
  );

  it("inspects and applies blur when the playhead cannot be read", () => {
    const host = fixture();
    host.sequence.getPlayerPosition = () => {
      throw new Error("Playhead unavailable");
    };
    const snapshot = host.dispatch("inspect");
    expect(snapshot.ok).toBe(true);
    expect(snapshot.data.motionBlur.targets).toHaveLength(1);
    expect(snapshot.data.motionBlur.clipName).toBe("mouse-arrow.png");
    expect(host.apply(180).ok).toBe(true);
  });

  it("does not require the playhead or movement keyframes during blur application", () => {
    const host = fixture({ matchName: "AE.ADBE Geometry2" });
    const target = host.inspect().targets[0];
    host.sequence.getPlayerPosition = () => {
      throw new Error("Must not read the playhead");
    };
    host.positionKeys.clear();
    expect(
      host.dispatch("apply-motion-blur", { target, shutterAngle: 180 }).ok,
    ).toBe(true);
    expect(host.positionKeys.size).toBe(0);
  });
});
