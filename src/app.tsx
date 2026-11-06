import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createCurveService } from "./application/curve-service";
import { createMotionBlurService } from "./application/motion-blur-service";
import type {
  CurveTarget,
  HostPort,
  HostSnapshot,
  MotionBlurTarget,
} from "./application/host-port";
import {
  defaultCurve,
  type Curve,
  type KeyframeRange,
} from "./domain/easing-curve";
import { CurveEditor } from "./presentation/curve-editor";
import { MotionPreview } from "./presentation/motion-preview";
import { MotionBlurControls } from "./presentation/motion-blur-controls";
import brandIcon from "../public/images/icon.png";

const previewRange: KeyframeRange = {
  startTicks: "0",
  endTicks: "254016000000",
  frameTicks: "8467200000",
  startValue: 0,
  endValue: 1,
};

export default function App({ host }: { host: HostPort }) {
  const service = useMemo(() => createCurveService(host), [host]);
  const blurService = useMemo(() => createMotionBlurService(host), [host]);
  const [blurTarget, setBlurTarget] = useState<MotionBlurTarget>();
  const blurTargetRef = useRef<MotionBlurTarget | undefined>(undefined);
  const [shutterAngle, setShutterAngle] = useState(180);
  const [curve, setCurve] = useState<Curve>(defaultCurve);
  const [snapshot, setSnapshot] = useState<HostSnapshot | null>(null);
  const [target, setTarget] = useState<CurveTarget>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const targetRef = useRef<CurveTarget | undefined>(undefined);
  const running = useRef(false);
  const mounted = useRef(true);
  const engaged = useRef(false);

  const refresh = useCallback(async () => {
    if (!host.available || running.current) return;
    running.current = true;
    setPending(true);
    try {
      const next = await service.inspect(targetRef.current);
      if (!mounted.current) return;
      const previous = next.targets.find(
        (candidate) => candidate.id === targetRef.current?.id,
      );
      const chosen =
        previous ?? (next.targets.length === 1 ? next.targets[0] : undefined);
      targetRef.current = chosen;
      setTarget(chosen);
      setSnapshot(next);
      const blurTargets = next.motionBlur?.targets ?? [];
      const selectedBlur =
        blurTargets.find(
          (candidate) => candidate.id === blurTargetRef.current?.id,
        ) ?? (blurTargets.length === 1 ? blurTargets[0] : undefined);
      if (selectedBlur?.stateToken !== blurTargetRef.current?.stateToken)
        setShutterAngle(selectedBlur?.shutterAngle || 180);
      blurTargetRef.current = selectedBlur;
      setBlurTarget(selectedBlur);
      setError("");
    } catch (failure) {
      if (mounted.current) {
        targetRef.current = undefined;
        setTarget(undefined);
        blurTargetRef.current = undefined;
        setBlurTarget(undefined);
        setError((failure as Error).message);
      }
    } finally {
      running.current = false;
      if (mounted.current) setPending(false);
    }
  }, [host.available, service]);

  const enter = useCallback(() => {
    engaged.current = true;
    void refresh();
  }, [refresh]);

  useEffect(() => {
    mounted.current = true;
    let timer: number | undefined;
    const focus = () => {
      if (!engaged.current) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void refresh();
      }, 100);
    };
    window.addEventListener("focus", focus);
    return () => {
      mounted.current = false;
      window.clearTimeout(timer);
      window.removeEventListener("focus", focus);
    };
  }, [refresh]);

  const prepared = useMemo(() => {
    try {
      return {
        plan: service.prepare(
          target ?? {
            ...previewRange,
            id: "preview",
            label: "Timing preview",
            kind: "value",
            rangeToken: "",
          },
          curve,
        ),
        error: "",
      };
    } catch (failure) {
      return { plan: null, error: (failure as Error).message };
    }
  }, [service, target, curve]);

  async function apply() {
    if (!target || !prepared.plan || running.current) return;
    running.current = true;
    setPending(true);
    setMessage("");
    setError("");
    try {
      const result = await service.apply(target, curve);
      targetRef.current = result.target;
      setTarget(result.target);
      setMessage(
        `${result.keyframesWritten} intermediate keyframes updated. Endpoints preserved.`,
      );
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      running.current = false;
      setPending(false);
    }
  }

  function chooseTarget(id: string) {
    const chosen = snapshot?.targets.find((candidate) => candidate.id === id);
    targetRef.current = chosen;
    setTarget(chosen);
    setMessage("");
  }

  function chooseBlurTarget(id: string) {
    const chosen = snapshot?.motionBlur?.targets.find(
      (candidate) => candidate.id === id,
    );
    blurTargetRef.current = chosen;
    setBlurTarget(chosen);
    setShutterAngle(chosen?.shutterAngle || 180);
    setMessage("");
  }

  async function applyBlur() {
    if (!blurTarget || running.current) return;
    running.current = true;
    setPending(true);
    setMessage("");
    setError("");
    try {
      const result = await blurService.apply(blurTarget, shutterAngle);
      if (!mounted.current) return;
      blurTargetRef.current = result.target;
      setBlurTarget(result.target);
      setSnapshot((current) =>
        current?.motionBlur
          ? {
              ...current,
              motionBlur: {
                ...current.motionBlur,
                targets: current.motionBlur.targets.map((item) =>
                  item.id === result.target.id ? result.target : item,
                ),
              },
            }
          : current,
      );
      setMessage(result.message);
    } catch (failure) {
      if (mounted.current) setError((failure as Error).message);
    } finally {
      running.current = false;
      if (mounted.current) setPending(false);
    }
  }

  function changeCurve(next: Curve) {
    setCurve(next);
    setMessage("");
  }

  const hint = target
    ? "Endpoints stay fixed. The curve changes the motion between them."
    : host.available
      ? snapshot?.message ||
        "Place the playhead between two keyframes in Effect Controls."
      : "Open Z Motion in Premiere to load an existing keyframe pair.";

  return (
    <div
      className="workspace"
      onPointerEnter={enter}
      onFocusCapture={(event) => {
        if (
          !(event.relatedTarget instanceof Node) ||
          !event.currentTarget.contains(event.relatedTarget)
        )
          enter();
      }}
    >
      <header className="brand-bar">
        <div className="brand">
          <img src={brandIcon} alt="" width="32" height="32" />
          <div>
            <h1>Z Motion</h1>
            <p>Curve editor</p>
          </div>
        </div>
        <span className="connection">
          <span
            className={`status-dot ${target || blurTarget ? "connected" : ""}`}
          />
          {host.available
            ? snapshot
              ? `Premiere ${snapshot.hostVersion}`
              : pending
                ? "Connecting"
                : "Premiere"
            : "Preview mode"}
        </span>
      </header>
      <main aria-label="Curve editor">
        <section className="curve-section" aria-label="Easing curve">
          <div className="target-line">
            {snapshot && snapshot.targets.length > 1 ? (
              <label className="property-choice">
                <span>Animated property</span>
                <select
                  aria-label="Animated property"
                  value={target?.id ?? ""}
                  onChange={(event) => chooseTarget(event.target.value)}
                  disabled={pending}
                >
                  <option value="">Choose a property</option>
                  {snapshot.targets.map((candidate) => (
                    <option value={candidate.id} key={candidate.id}>
                      {candidate.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <>
                <h2>Curves</h2>
                <span className="target-name">
                  {target?.label ?? "Timing preview"}
                </span>
              </>
            )}
          </div>
          <CurveEditor curve={curve} onChange={changeCurve} />
          <MotionPreview plan={prepared.plan} kind={target?.kind ?? "value"} />
          <p className="target-hint">{target ? hint : `Curves: ${hint}`}</p>
          <MotionBlurControls
            snapshot={snapshot?.motionBlur}
            target={blurTarget}
            angle={shutterAngle}
            pending={pending}
            available={host.available}
            onTargetChange={chooseBlurTarget}
            onAngleChange={(next) => {
              setShutterAngle(next);
              setMessage("");
            }}
            onApply={() => void applyBlur()}
            onRefresh={enter}
          />
        </section>
      </main>
      <div className="apply-section">
        {(error || prepared.error) && (
          <p className="feedback error" role="alert">
            {error || prepared.error}
          </p>
        )}
        {message && !error && (
          <p className="feedback" role="status">
            {message}
          </p>
        )}
        <button
          className="primary-button"
          disabled={!host.available || !target || !prepared.plan || pending}
          onClick={() => void apply()}
          aria-label="Apply animation"
        >
          {pending ? "Working in Premiere…" : "Apply animation"}
          <span aria-hidden="true">↗</span>
        </button>
        <div className="footer-line">
          <span>Z Motion / 1.1.2</span>
          <span>Two keys. Your curve.</span>
        </div>
      </div>
    </div>
  );
}
