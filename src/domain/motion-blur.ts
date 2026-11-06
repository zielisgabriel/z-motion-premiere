export const shutterPresets = [0, 90, 180, 360] as const;

export function validateShutterAngle(value: number): number {
  if (!Number.isFinite(value) || value < 0 || value > 360)
    throw new Error("Set the shutter angle between 0° and 360°.");
  return value;
}
