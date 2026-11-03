import { afterEach, describe, expect, it, vi } from "vitest";
import { createCepHost } from "./cep-host";
import { createEasingPlan } from "../domain/easing-curve";
import { curveTarget } from "../../tests/fixtures/curve-target";

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
