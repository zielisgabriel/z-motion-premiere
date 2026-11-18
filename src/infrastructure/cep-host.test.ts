import { afterEach, describe, expect, it, vi } from "vitest";
import { createCepHost } from "./cep-host";
import { createEasingPlan } from "../domain/easing-curve";
import {
  curveTarget,
  motionBlurTarget,
} from "../../tests/fixtures/curve-target";

afterEach(() => vi.useRealTimers());

describe("curve-only CEP communication", () => {
  it("cannot write to Premiere from the browser preview", async () => {
    const host = createCepHost();
    expect(host.available).toBe(false);
    await expect(host.inspect()).rejects.toThrow(
      "Open Z Motion inside Premiere",
    );
  });

  it("sends the exact endpoint snapshot and sampled values in an encoded argument", async () => {
    let request = "";
    const target = { ...curveTarget, id: '";app.quit();//\n\u2028' };
    const plan = createEasingPlan(target, [0, 0, 1, 1]);
    const host = createCepHost({
      evalScript: (script, callback) => {
        request = script;
        callback(
          JSON.stringify({
            protocol: 2,
            ok: true,
            data: { keyframesWritten: 24, message: "Applied.", target },
          }),
        );
      },
    });
    await host.apply(target, plan);
    expect(request).not.toContain(target.id);
    const encoded = JSON.parse(
      request.slice(request.indexOf("decodeURIComponent(") + 19, -2),
    );
    expect(JSON.parse(decodeURIComponent(encoded))).toEqual({
      protocol: 2,
      operation: "apply-curve",
      payload: { target, plan },
    });
  });

  it("rejects old protocol versions and invalid host target data", async () => {
    await expect(
      createCepHost({
        evalScript: (_, callback) => callback('{"protocol":1,"ok":true}'),
      }).inspect(),
    ).rejects.toThrow("incompatible");
    await expect(
      createCepHost({
        evalScript: (_, callback) =>
          callback(
            JSON.stringify({
              protocol: 2,
              ok: true,
              data: {
                hostVersion: "26.5",
                message: "",
                targets: [{ ...curveTarget, startValue: "invalid" }],
              },
            }),
          ),
      }).inspect(),
    ).rejects.toThrow("invalid keyframe");
    await expect(
      createCepHost({
        evalScript: (_, callback) => callback("EvalScript error."),
      }).inspect(),
    ).rejects.toThrow("host script");
  });

  it("prevents retries after a timeout because a write may still be running", async () => {
    vi.useFakeTimers();
    const host = createCepHost({ evalScript: () => undefined }, 50);
    const result = expect(host.inspect()).rejects.toThrow(
      "may still be running",
    );
    await vi.advanceTimersByTimeAsync(51);
    await result;
    await expect(host.inspect()).rejects.toThrow("Reopen");
  });
});

describe("motion blur CEP communication", () => {
  it("encodes the effect snapshot and angle in a dedicated operation without a keyframe plan", async () => {
    let request = "";
    const host = createCepHost({
      evalScript: (script, callback) => {
        request = script;
        callback(
          JSON.stringify({
            protocol: 2,
            ok: true,
            data: {
              target: {
                ...motionBlurTarget,
                shutterAngle: 180,
                useCompositionShutterAngle: false,
              },
              message: "Applied.",
            },
          }),
        );
      },
    });
    await host.applyMotionBlur(motionBlurTarget, 180);
    const encoded = JSON.parse(
      request.slice(request.indexOf("decodeURIComponent(") + 19, -2),
    );
    expect(JSON.parse(decodeURIComponent(encoded))).toEqual({
      protocol: 2,
      operation: "apply-motion-blur",
      payload: { target: motionBlurTarget, shutterAngle: 180 },
    });
  });

  it.each([
    { shutterAngle: 361 },
    { useCompositionShutterAngle: 1 },
    { stateToken: null },
  ])("rejects malformed blur snapshots %j", async (invalid) => {
    const host = createCepHost({
      evalScript: (_, callback) =>
        callback(
          JSON.stringify({
            protocol: 2,
            ok: true,
            data: {
              hostVersion: "26.5",
              message: "",
              targets: [],
              motionBlur: {
                targets: [{ ...motionBlurTarget, ...invalid }],
                message: "",
              },
            },
          }),
        ),
    });
    await expect(host.inspect()).rejects.toThrow("invalid motion blur");
  });

  it("rejects a malformed mutation result and does not claim applied blur", async () => {
    const host = createCepHost({
      evalScript: (_, callback) =>
        callback(
          JSON.stringify({
            protocol: 2,
            ok: true,
            data: {
              target: { ...motionBlurTarget, shutterAngle: -1 },
              message: "Applied.",
            },
          }),
        ),
    });
    await expect(host.applyMotionBlur(motionBlurTarget, 180)).rejects.toThrow(
      "invalid motion blur result",
    );
  });
});

describe("adding Transform over CEP", () => {
  function respond(data: unknown) {
    let request = "";
    const host = createCepHost({
      evalScript: (script, callback) => {
        request = script;
        callback(JSON.stringify({ protocol: 2, ok: true, data }));
      },
    });
    const sent = () =>
      JSON.parse(
        decodeURIComponent(
          JSON.parse(
            request.slice(request.indexOf("decodeURIComponent(") + 19, -2),
          ),
        ),
      );
    return { host, sent };
  }

  it("sends only the selection token the panel saw", async () => {
    const { host, sent } = respond({
      added: 1,
      message: "Transform added to a.mov.",
      transformId: "transform-9",
    });
    await expect(host.addTransform('["project",["clip-1"]]')).resolves.toEqual({
      added: 1,
      message: "Transform added to a.mov.",
      transformId: "transform-9",
    });
    expect(sent()).toEqual({
      protocol: 2,
      operation: "add-transform",
      payload: { selectionToken: '["project",["clip-1"]]' },
    });
  });

  it.each([
    { added: 0, message: "Nothing." },
    { added: 1.5, message: "Half." },
    { added: 1 },
    { added: 1, message: "Added.", transformId: 3 },
  ])("rejects a malformed result %j", async (data) => {
    await expect(respond(data).host.addTransform("token")).rejects.toThrow(
      "invalid Transform result",
    );
  });

  it("accepts the selection count and token in the blur snapshot, and rejects bad ones", async () => {
    const snapshot = (motionBlur: object) =>
      respond({
        hostVersion: "26.5.1",
        message: "",
        targets: [],
        motionBlur,
      }).host.inspect();
    await expect(
      snapshot({
        targets: [],
        message: "",
        selectedClips: 3,
        selectionToken: "t",
      }),
    ).resolves.toMatchObject({
      motionBlur: { selectedClips: 3, selectionToken: "t" },
    });
    await expect(
      snapshot({
        targets: [],
        message: "",
        selectedClips: -1,
        selectionToken: "t",
      }),
    ).rejects.toThrow("invalid motion blur");
    await expect(
      snapshot({
        targets: [],
        message: "",
        selectedClips: 1,
        selectionToken: 7,
      }),
    ).rejects.toThrow("invalid motion blur");
  });
});

describe("curve result warnings over CEP", () => {
  function curveHost(data: object) {
    return createCepHost({
      evalScript: (_, callback) =>
        callback(JSON.stringify({ protocol: 2, ok: true, data })),
    });
  }
  const plan = createEasingPlan(curveTarget, [0, 0, 1, 1]);

  it("passes a host warning through with the applied curve", async () => {
    const result = await curveHost({
      keyframesWritten: 24,
      message: "Applied.",
      target: curveTarget,
      warning: "Premiere did not confirm linear interpolation on 2 of 26 keys.",
    }).apply(curveTarget, plan);
    expect(result.warning).toContain("did not confirm linear interpolation");
  });

  it("rejects a warning that is not text", async () => {
    await expect(
      curveHost({
        keyframesWritten: 24,
        message: "Applied.",
        target: curveTarget,
        warning: 3,
      }).apply(curveTarget, plan),
    ).rejects.toThrow("invalid curve result");
  });
});
