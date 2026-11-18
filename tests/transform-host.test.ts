import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { describe, expect, it } from "vitest";

const secondTicks = 254016000000;

interface Parameter {
  displayName: string;
  areKeyframesSupported: () => boolean;
  isTimeVarying: () => boolean;
  getValue: () => unknown;
  setValue: (value: unknown) => unknown;
}

interface Component {
  displayName: string;
  matchName: string;
  properties: Parameter[] & { numItems: number };
}

/** A Premiere collection: indexable, with a live numItems count. */
function collection<T>(items: T[]): T[] & { numItems: number } {
  return Object.defineProperty(items, "numItems", {
    get: () => items.length,
  }) as T[] & { numItems: number };
}

/** Premiere's TrackCollection: indexable, counted by numTracks only. */
function trackCollection<T>(items: T[]): T[] & { numTracks: number } {
  return Object.defineProperty(items, "numTracks", {
    get: () => items.length,
  }) as T[] & { numTracks: number };
}

function parameter(displayName: string, initial: unknown): Parameter {
  let value = initial;
  return {
    displayName,
    areKeyframesSupported: () => true,
    isTimeVarying: () => false,
    getValue: () => value,
    setValue: (next) => {
      value = next;
      return undefined;
    },
  };
}

function transform(language: "en" | "pt"): Component {
  const pt = language === "pt";
  return {
    displayName: pt ? "Transformar" : "Transform",
    matchName: "AE.ADBE Geometry2",
    properties: collection([
      parameter(pt ? "Ponto de ancoragem" : "Anchor Point", [0.5, 0.5]),
      parameter("Position", [0.5, 0.5]),
      parameter("", true),
      parameter("Scale", 100),
      parameter("Scale Width", 100),
      parameter("Skew", 0),
      parameter("Skew Axis", 0),
      parameter("Rotation", 0),
      parameter("Opacity", 100),
      parameter(
        pt
          ? "Usar ângulo do obturador da composição"
          : "Use Composition's Shutter Angle",
        true,
      ),
      parameter(pt ? "Ângulo do obturador" : "Shutter Angle", 0),
      parameter("Sampling", 0),
    ]),
  };
}

function intrinsic(name: string, matchName: string): Component {
  return {
    displayName: name,
    matchName,
    properties: collection([parameter("Position", [0.5, 0.5])]),
  };
}

interface ClipSpec {
  name: string;
  track: number;
  start: number;
  selected?: boolean;
  hasTransform?: boolean;
  /** How QE names the item; Premiere may add a " [V]" suffix. */
  qeName?: string;
  /** The QE track does not list this clip. */
  missingInQe?: boolean;
}

/**
 * Simulates Premiere's standard DOM plus the QE DOM used to add effects.
 * QE tracks list empty gaps as items, like Premiere does.
 */
function premiere({
  language = "en",
  clips = [{ name: "mouse-arrow.png", track: 0, start: 30, selected: true }],
  audioSelected = false,
  effectResult = "transform",
}: {
  language?: "en" | "pt" | "ja";
  clips?: ClipSpec[];
  audioSelected?: boolean;
  effectResult?: "transform" | "nothing" | "other";
} = {}) {
  const effectsAdded: string[] = [];
  const timeline = clips.map((spec) => ({
    nodeId: `${spec.name}@${spec.track}:${spec.start}`,
    name: spec.name,
    mediaType: "Video",
    start: { seconds: spec.start, ticks: String(spec.start * secondTicks) },
    end: { seconds: spec.start + 5 },
    inPoint: { seconds: 0 },
    getSpeed: () => 1,
    isSpeedReversed: () => false,
    components: collection<Component>([
      intrinsic("Motion", "AE.ADBE Motion"),
      intrinsic("Opacity", "AE.ADBE Opacity"),
      ...(spec.hasTransform ? [transform("en")] : []),
    ]),
    spec,
  }));
  let selection: object[] = timeline.filter((clip) => clip.spec.selected);
  if (audioSelected)
    selection = [...selection, { mediaType: "Audio", nodeId: "audio-1" }];
  const trackCount = Math.max(...clips.map((clip) => clip.track)) + 1;
  const sequence = {
    sequenceID: "sequence-1",
    timebase: "10160640000",
    getSelection: () => selection,
    getPlayerPosition: () => ({ seconds: 31 }),
    // A TrackCollection counts with numTracks, unlike other collections.
    videoTracks: trackCollection(
      Array.from({ length: trackCount }, (_, track) => ({
        clips: collection(timeline.filter((clip) => clip.spec.track === track)),
      })),
    ),
  };
  const localized: Record<string, string> = {
    en: "Transform",
    pt: "Transformar",
  };
  const qeTracks = Array.from({ length: trackCount }, (_, track) => {
    const items: object[] = [
      { type: "Empty", name: "", start: { ticks: "0" } },
    ];
    for (const clip of timeline.filter((item) => item.spec.track === track)) {
      if (clip.spec.missingInQe) continue;
      items.push({
        type: "Clip",
        name: clip.spec.qeName ?? clip.name,
        start: { ticks: clip.start.ticks },
        addVideoEffect(effect: { name: string }) {
          effectsAdded.push(`${clip.nodeId} <- ${effect.name}`);
          if (effectResult === "transform")
            clip.components.push(transform(language === "pt" ? "pt" : "en"));
          if (effectResult === "other")
            clip.components.push(intrinsic("Crop", "AE.ADBE AECrop"));
        },
      });
      items.push({ type: "Empty", name: "", start: { ticks: "1" } });
    }
    return {
      numItems: items.length,
      getItemAt: (index: number) => items[index],
    };
  });
  const qe = {
    project: {
      getActiveSequence: () => ({
        getVideoTrackAt: (index: number) => qeTracks[index],
      }),
      getVideoEffectByName: (name: string) =>
        name === localized[language] ? { name } : null,
    },
  };
  const state = createContext({
    app: {
      version: "26.5.1",
      project: { documentID: "project-1", activeSequence: sequence },
      enableQE() {
        state.qe = qe;
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
  const blur = () => dispatch("inspect").data.motionBlur;
  const add = (selectionToken = blur().selectionToken) =>
    dispatch("add-transform", { selectionToken });
  const transforms = (index: number) =>
    timeline[index].components.filter((component) =>
      /Geometry2?$/.test(component.matchName),
    ).length;
  return {
    timeline,
    effectsAdded,
    dispatch,
    blur,
    add,
    transforms,
    select(names: string[]) {
      selection = timeline.filter((clip) => names.includes(clip.name));
    },
  };
}

describe("adding Transform to the selected clips", () => {
  it("reports how many video clips are selected, ignoring audio", () => {
    const one = premiere({ audioSelected: true });
    expect(one.blur()).toMatchObject({ selectedClips: 1 });
    expect(typeof one.blur().selectionToken).toBe("string");
    const two = premiere({
      clips: [
        { name: "a.mov", track: 0, start: 0, selected: true },
        { name: "b.mov", track: 1, start: 0, selected: true },
      ],
    });
    expect(two.blur()).toMatchObject({ selectedClips: 2 });
  });

  it("adds Transform to the selected clip and returns it ready for motion blur", () => {
    const host = premiere();
    expect(host.blur().targets).toHaveLength(0);
    const result = host.add();
    expect(result).toMatchObject({ ok: true, data: { added: 1 } });
    expect(result.data.message).toContain("Transform added to mouse-arrow.png");
    expect(host.transforms(0)).toBe(1);
    const targets = host.blur().targets;
    expect(targets).toHaveLength(1);
    expect(result.data.transformId).toBe(targets[0].id);
  });

  it("adds one more Transform to every selected clip, even one that already has it", () => {
    const host = premiere({
      clips: [
        {
          name: "a.mov",
          track: 0,
          start: 0,
          selected: true,
          hasTransform: true,
        },
        { name: "b.mov", track: 1, start: 0, selected: true },
        { name: "c.mov", track: 1, start: 10 },
      ],
    });
    const result = host.add();
    expect(result).toMatchObject({
      ok: true,
      data: { added: 2, message: "Transform added to 2 clips." },
    });
    expect(result.data.transformId).toBeUndefined();
    expect([
      host.transforms(0),
      host.transforms(1),
      host.transforms(2),
    ]).toEqual([2, 1, 0]);
  });

  it("finds the clip by track, start and name, skipping empty gaps", () => {
    const host = premiere({
      clips: [
        { name: "take.mov", track: 0, start: 0 },
        { name: "take.mov", track: 0, start: 20, selected: true },
        { name: "take.mov", track: 1, start: 0 },
      ],
    });
    expect(host.add().ok).toBe(true);
    expect(host.effectsAdded).toEqual(["take.mov@0:20 <- Transform"]);
  });

  it("uses Premiere's Portuguese effect name", () => {
    const host = premiere({ language: "pt" });
    expect(host.add()).toMatchObject({ ok: true, data: { added: 1 } });
    expect(host.effectsAdded).toEqual(["mouse-arrow.png@0:30 <- Transformar"]);
    expect(host.blur().targets).toHaveLength(1);
  });

  it("refuses a selection that changed after the panel loaded it", () => {
    const host = premiere({
      clips: [
        { name: "a.mov", track: 0, start: 0, selected: true },
        { name: "b.mov", track: 0, start: 10 },
      ],
    });
    const token = host.blur().selectionToken;
    host.select(["b.mov"]);
    const result = host.add(token);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("selection changed");
    expect(host.effectsAdded).toEqual([]);
  });

  it("explains when this Premiere language has no known Transform name", () => {
    const host = premiere({ language: "ja" });
    const result = host.add();
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Effects panel");
    expect(host.effectsAdded).toEqual([]);
  });

  it("reports a native no-op and an unexpected effect instead of claiming success", () => {
    const silent = premiere({ effectResult: "nothing" });
    expect(silent.add()).toMatchObject({
      ok: false,
      error: expect.stringContaining("did not add Transform"),
    });
    const wrong = premiere({ effectResult: "other" });
    expect(wrong.add()).toMatchObject({
      ok: false,
      error: expect.stringContaining("Undo"),
    });
  });

  it("reports which clips failed when only some received Transform", () => {
    const host = premiere({
      clips: [
        { name: "a.mov", track: 0, start: 0, selected: true },
        {
          name: "b.mov",
          track: 1,
          start: 0,
          selected: true,
          missingInQe: true,
        },
      ],
    });
    const result = host.add();
    expect(result).toMatchObject({ ok: true, data: { added: 1 } });
    expect(result.data.message).toContain("1 of 2 clips");
    expect(result.data.message).toContain("b.mov");
  });

  it("finds a clip whose QE name carries the timeline [V] suffix", () => {
    const host = premiere({
      clips: [
        {
          name: "IMG_3253.MOV",
          qeName: "IMG_3253.MOV [V]",
          track: 0,
          start: 4,
          selected: true,
        },
      ],
    });
    expect(host.add()).toMatchObject({ ok: true, data: { added: 1 } });
    expect(host.effectsAdded).toEqual(["IMG_3253.MOV@0:4 <- Transform"]);
  });

  it("requires a selected video clip", () => {
    const host = premiere({ clips: [{ name: "a.mov", track: 0, start: 0 }] });
    expect(host.blur()).toMatchObject({ selectedClips: 0 });
    expect(host.add("anything")).toMatchObject({
      ok: false,
      error: expect.stringContaining("Select at least one video clip"),
    });
  });
});
