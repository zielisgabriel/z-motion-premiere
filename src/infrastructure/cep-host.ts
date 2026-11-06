import type {
  CurveTarget,
  HostPort,
  HostResult,
  HostSnapshot,
  MotionBlurTarget,
  MotionBlurResult,
} from "../application/host-port";
import { isNumericValue } from "../domain/easing-curve";

export interface CepRuntime {
  evalScript(script: string, callback: (result: string) => void): void;
}

declare global {
  interface Window {
    __adobe_cep__?: CepRuntime;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object";
}

function unpack(raw: string): unknown {
  if (raw === "EvalScript error." || raw === "undefined")
    throw new Error(
      "Premiere could not load the Z Motion host script. Reopen the panel or reinstall Z Motion.",
    );
  let response: unknown;
  try {
    response = JSON.parse(raw);
  } catch {
    throw new Error(
      "Premiere returned an unreadable response. Reopen the panel.",
    );
  }
  if (
    !isRecord(response) ||
    response.protocol !== 2 ||
    typeof response.ok !== "boolean"
  )
    throw new Error(
      "Premiere returned an incompatible response. Reinstall the current Z Motion version.",
    );
  if (!response.ok)
    throw new Error(
      typeof response.error === "string"
        ? response.error
        : "Premiere rejected this operation.",
    );
  return response.data;
}

function isTarget(value: unknown): value is CurveTarget {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.label !== "string" ||
    typeof value.rangeToken !== "string"
  )
    return false;
  if (
    !["position", "scale", "rotation", "opacity", "value"].includes(
      String(value.kind),
    )
  )
    return false;
  if (
    ![value.startTicks, value.endTicks, value.frameTicks].every(
      (ticks) =>
        typeof ticks === "string" && /^-?(0|[1-9][0-9]{0,20})$/.test(ticks),
    )
  )
    return false;
  if (
    !isNumericValue(value.startValue) ||
    !isNumericValue(value.endValue) ||
    typeof value.startValue !== typeof value.endValue
  )
    return false;
  if (
    value.limits !== undefined &&
    (!Array.isArray(value.limits) ||
      value.limits.length !== 2 ||
      !value.limits.every(
        (bound) => typeof bound === "number" && Number.isFinite(bound),
      ) ||
      value.limits[0] > value.limits[1])
  )
    return false;
  return true;
}

function snapshot(value: unknown): HostSnapshot {
  if (
    !isRecord(value) ||
    typeof value.hostVersion !== "string" ||
    typeof value.message !== "string" ||
    !Array.isArray(value.targets) ||
    !value.targets.every(isTarget)
  )
    throw new Error("Premiere returned an invalid keyframe response.");
  if (
    value.motionBlur !== undefined &&
    (!isRecord(value.motionBlur) ||
      typeof value.motionBlur.message !== "string" ||
      (value.motionBlur.clipName !== undefined &&
        typeof value.motionBlur.clipName !== "string") ||
      !Array.isArray(value.motionBlur.targets) ||
      !value.motionBlur.targets.every(isMotionBlurTarget))
  )
    throw new Error("Premiere returned an invalid motion blur response.");
  return value as unknown as HostSnapshot;
}

function isMotionBlurTarget(value: unknown): value is MotionBlurTarget {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.label === "string" &&
    typeof value.stateToken === "string" &&
    typeof value.shutterAngle === "number" &&
    Number.isFinite(value.shutterAngle) &&
    value.shutterAngle >= 0 &&
    value.shutterAngle <= 360 &&
    typeof value.useCompositionShutterAngle === "boolean"
  );
}

function motionBlurResult(value: unknown): MotionBlurResult {
  if (
    !isRecord(value) ||
    typeof value.message !== "string" ||
    !isMotionBlurTarget(value.target)
  )
    throw new Error("Premiere returned an invalid motion blur result.");
  return value as unknown as MotionBlurResult;
}

function result(value: unknown): HostResult {
  if (
    !isRecord(value) ||
    !Number.isInteger(value.keyframesWritten) ||
    Number(value.keyframesWritten) < 0 ||
    typeof value.message !== "string" ||
    !isTarget(value.target)
  )
    throw new Error("Premiere returned an invalid curve result.");
  return value as unknown as HostResult;
}

export function createCepHost(
  runtime?: CepRuntime,
  timeoutMs = 30000,
): HostPort {
  let inFlight = false;
  let timedOut = false;
  async function request(
    operation: string,
    payload: unknown = {},
  ): Promise<unknown> {
    if (!runtime)
      throw new Error(
        "Open Z Motion inside Premiere to adjust existing keyframes.",
      );
    if (timedOut)
      throw new Error(
        "Reopen Z Motion before sending another request. The previous operation may still be running.",
      );
    if (inFlight)
      throw new Error("Wait for Premiere to finish the current operation.");
    inFlight = true;
    const argument = JSON.stringify(
      encodeURIComponent(JSON.stringify({ protocol: 2, operation, payload })),
    );
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        timedOut = true;
        reject(
          new Error(
            "Premiere did not respond in time. The operation may still be running. Reopen Z Motion before retrying.",
          ),
        );
      }, timeoutMs);
      try {
        runtime.evalScript(
          `ZMotion.dispatch(decodeURIComponent(${argument}))`,
          (raw) => {
            clearTimeout(timer);
            inFlight = false;
            if (timedOut) return;
            try {
              resolve(unpack(raw));
            } catch (error) {
              reject(error);
            }
          },
        );
      } catch (error) {
        clearTimeout(timer);
        inFlight = false;
        reject(error);
      }
    });
  }
  return {
    available: !!runtime,
    inspect: async (preferred) =>
      snapshot(await request("inspect", preferred ? { preferred } : {})),
    apply: async (target, plan) =>
      result(await request("apply-curve", { target, plan })),
    applyMotionBlur: async (target, shutterAngle) =>
      motionBlurResult(
        await request("apply-motion-blur", { target, shutterAngle }),
      ),
  };
}
