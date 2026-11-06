import { describe, expect, it } from "vitest";
import { validateShutterAngle } from "./motion-blur";

describe("shutter angle limits", () => {
  it.each([0, 90, 180, 270.5, 360])("accepts %s degrees", (value) => {
    expect(validateShutterAngle(value)).toBe(value);
  });
  it.each([NaN, Infinity, -1, 361])("rejects %s degrees", (value) => {
    expect(() => validateShutterAngle(value)).toThrow("0° and 360°");
  });
});
