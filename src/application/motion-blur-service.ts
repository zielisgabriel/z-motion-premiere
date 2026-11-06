import { validateShutterAngle } from "../domain/motion-blur";
import type { HostPort, MotionBlurTarget } from "./host-port";

export function createMotionBlurService(host: HostPort) {
  return {
    apply: (target: MotionBlurTarget, shutterAngle: number) =>
      host.applyMotionBlur(target, validateShutterAngle(shutterAngle)),
  };
}
