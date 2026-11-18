import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createCurveService } from "./application/curve-service";
import { createMotionBlurService } from "./application/motion-blur-service";
import type {
  CurveTarget,
  HostPort,
  HostSnapshot,
  MotionBlurTarget,
} from "./application/host-port";
import { defaultCurve, type Curve } from "./domain/easing-curve";
import { CurveEditor } from "./presentation/curve-editor";
import { MotionBlurControls } from "./presentation/motion-blur-controls";
import { ThemeToggle } from "./presentation/theme-toggle";
import {
  applyTheme,
  panelStorage,
  readTheme,
  saveTheme,
  type Theme,
} from "./presentation/theme";
import brandIcon from "../public/images/icon.png";

/** Identifies the set of properties the user saw, to detect a changed set. */
function propertySet(targets: CurveTarget[]) {
  return targets.length
    ? {
        id: targets
          .map((target) => target.id)
          .sort()
          .join("|"),
      }
    : undefined;
}

interface Feedback {
  channel: "curve" | "blur";
  tone: "status" | "error";
  text: string;
}

export default function App({ host }: { host: HostPort }) {
  const service = useMemo(() => createCurveService(host), [host]);
  const blurService = useMemo(() => createMotionBlurService(host), [host]);
  const [blurTarget, setBlurTarget] = useState<MotionBlurTarget>();
  const blurTargetRef = useRef<MotionBlurTarget | undefined>(undefined);
  const selectionRef = useRef<string | undefined>(undefined);
  const addedTransformId = useRef<string | undefined>(undefined);
  const [shutterAngle, setShutterAngle] = useState(180);
  const [curve, setCurve] = useState<Curve>(defaultCurve);
  const [theme, setTheme] = useState<Theme>(() => readTheme(panelStorage()));
  const [snapshot, setSnapshot] = useState<HostSnapshot | null>(null);
  // Premiere does not expose keyframe selection, so the curve applies to
  // every property with a keyframe pair around the playhead.
  const [targets, setTargets] = useState<CurveTarget[]>([]);
  // Reloading the Premiere selection is silent: only writes to Premiere
  // disable the controls, so a click that focuses the panel is never lost.
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [inspectError, setInspectError] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const targetsRef = useRef<CurveTarget[]>([]);
  const writing = useRef(false);
  const inspection = useRef<Promise<void> | null>(null);
  const mounted = useRef(true);
  const engaged = useRef(false);

  const refresh = useCallback((): Promise<void> => {
    if (!host.available || writing.current) return Promise.resolve();
    if (inspection.current) return inspection.current;
    setLoading(true);
    const run = inspect().finally(() => {
      inspection.current = null;
      if (mounted.current) setLoading(false);
    });
    inspection.current = run;
    return run;

    async function inspect() {
      try {
        await reload();
      } catch (failure) {
        if (mounted.current) {
          targetsRef.current = [];
          setTargets([]);
          blurTargetRef.current = undefined;
          setBlurTarget(undefined);
          setInspectError((failure as Error).message);
        }
      }
    }

    async function reload() {
      const next = await service.inspect(targetsRef.current[0]);
      if (!mounted.current) return;
      targetsRef.current = next.targets;
      setTargets(next.targets);
      setSnapshot(next);
      selectionRef.current = next.motionBlur?.selectionToken;
      const blurTargets = next.motionBlur?.targets ?? [];
      // A Transform the panel just added wins over the previous choice.
      const wantedBlur = addedTransformId.current ?? blurTargetRef.current?.id;
      addedTransformId.current = undefined;
      const selectedBlur =
        blurTargets.find((candidate) => candidate.id === wantedBlur) ??
        (blurTargets.length === 1 ? blurTargets[0] : undefined);
      if (selectedBlur?.stateToken !== blurTargetRef.current?.stateToken)
        setShutterAngle(selectedBlur?.shutterAngle || 180);
      blurTargetRef.current = selectedBlur;
      setBlurTarget(selectedBlur);
      setInspectError("");
    }
  }, [host.available, service]);

  /**
   * Runs one Premiere write at a time. A reload already in flight finishes
   * first, and the write only proceeds if the item the user saw is still the
   * one Premiere reports. Its result is reported in the section that
   * started it.
   */
  async function write<T extends { id: string }>(
    channel: Feedback["channel"],
    seen: T | undefined,
    current: () => T | undefined,
    work: (latest: T) => Promise<string | undefined>,
  ) {
    if (!seen || writing.current) return;
    writing.current = true;
    setApplying(true);
    setFeedback(null);
    try {
      await inspection.current;
      if (!mounted.current) return;
      const latest = current();
      if (!latest || latest.id !== seen.id)
        throw new Error(
          "The Premiere selection changed before applying. Review it and apply again.",
        );
      const text = await work(latest);
      if (mounted.current && text)
        setFeedback({ channel, tone: "status", text });
    } catch (failure) {
      if (mounted.current)
        setFeedback({
          channel,
          tone: "error",
          text: (failure as Error).message,
        });
    } finally {
      writing.current = false;
      if (mounted.current) setApplying(false);
    }
  }

  useEffect(() => applyTheme(document.documentElement, theme), [theme]);

  function toggleTheme() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    saveTheme(panelStorage(), next);
    setTheme(next);
  }

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

  // Every property must accept the curve before anything is written.
  const curveProblem = useMemo(() => {
    for (const target of targets) {
      try {
        service.prepare(target, curve);
      } catch (failure) {
        return `${target.label}: ${(failure as Error).message}`;
      }
    }
    return "";
  }, [service, targets, curve]);

  async function apply() {
    if (curveProblem) return;
    await write(
      "curve",
      propertySet(targets),
      () => propertySet(targetsRef.current),
      async () => {
        const latest = targetsRef.current;
        const applied: CurveTarget[] = [];
        const failures: string[] = [];
        const warnings: string[] = [];
        let written = 0;
        // Properties are independent: one failure does not stop the others.
        for (const target of latest) {
          try {
            const result = await service.apply(target, curve);
            applied.push(result.target);
            written += result.keyframesWritten;
            if (result.warning)
              warnings.push(
                latest.length === 1
                  ? result.warning
                  : `${target.label}: ${result.warning}`,
              );
          } catch (failure) {
            failures.push(`${target.label}: ${(failure as Error).message}`);
          }
        }
        if (mounted.current) {
          const next = latest.map(
            (target) => applied.find((item) => item.id === target.id) ?? target,
          );
          targetsRef.current = next;
          setTargets(next);
        }
        const notes = warnings.length ? ` ${warnings.join(" ")}` : "";
        if (failures.length)
          throw new Error(
            failures.join(" ") +
              (applied.length
                ? ` Applied to ${applied.map((item) => item.label).join(", ")}.`
                : "") +
              notes,
          );
        return (
          (latest.length === 1
            ? `${written} intermediate keyframes updated. Endpoints preserved.`
            : `Curve applied to ${latest.length} properties: ${written} intermediate keyframes updated. Endpoints preserved.`) +
          notes
        );
      },
    );
  }

  function chooseBlurTarget(id: string) {
    const chosen = snapshot?.motionBlur?.targets.find(
      (candidate) => candidate.id === id,
    );
    blurTargetRef.current = chosen;
    setBlurTarget(chosen);
    setShutterAngle(chosen?.shutterAngle || 180);
    clearStatus();
  }

  async function addTransform() {
    const token = snapshot?.motionBlur?.selectionToken;
    const current = () =>
      selectionRef.current ? { id: selectionRef.current } : undefined;
    let added = false;
    await write(
      "blur",
      token ? { id: token } : undefined,
      current,
      async (latest) => {
        const result = await blurService.addTransform(latest.id);
        addedTransformId.current = result.transformId;
        added = true;
        return result.message;
      },
    );
    // Load the new effect so motion blur can be applied right away.
    if (added && mounted.current) await refresh();
  }

  async function applyBlur() {
    const angle = shutterAngle;
    await write(
      "blur",
      blurTarget,
      () => blurTargetRef.current,
      async (latest) => {
        const result = await blurService.apply(latest, angle);
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
        return result.message;
      },
    );
  }

  function clearStatus() {
    setFeedback((current) => (current?.tone === "status" ? null : current));
  }

  function changeCurve(next: Curve) {
    setCurve(next);
    clearStatus();
  }

  // Shown beside the Apply button so a small panel always explains why it is
  // disabled, even when the editor above is scrolled.
  const labels = targets.map((target) => target.label).join(", ");
  const hint = targets.length
    ? `Applies to: ${labels}`
    : !host.available
      ? "Open Z Motion in Premiere to load an existing keyframe pair."
      : snapshot?.message ||
        (loading
          ? "Loading keyframes from Premiere…"
          : "Place the playhead between two keyframes in Effect Controls.");

  const curveFeedback = feedback?.channel === "curve" ? feedback : undefined;
  const curveError =
    inspectError ||
    (curveFeedback?.tone === "error" ? curveFeedback.text : "") ||
    curveProblem;
  const curveStatus =
    curveFeedback?.tone === "status" ? curveFeedback.text : "";

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
            aria-hidden="true"
            className={`status-dot ${snapshot && !inspectError ? "connected" : ""}`}
          />
          {host.available
            ? snapshot
              ? `Premiere ${snapshot.hostVersion}`
              : loading
                ? "Connecting…"
                : "Premiere"
            : "Preview mode"}
        </span>
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
      </header>
      <main aria-label="Curve editor">
        <section className="curve-section" aria-label="Easing curve">
          <div className="target-line">
            <h2>Curves</h2>
            <span className="target-name" title={labels || undefined}>
              {targets.length === 0
                ? "No keyframes loaded"
                : targets.length === 1
                  ? targets[0].label
                  : `${targets.length} animated properties`}
            </span>
          </div>
          <CurveEditor curve={curve} onChange={changeCurve} />
          <MotionBlurControls
            snapshot={snapshot?.motionBlur}
            target={blurTarget}
            angle={shutterAngle}
            pending={applying}
            available={host.available}
            onTargetChange={chooseBlurTarget}
            onAngleChange={(next) => {
              setShutterAngle(next);
              clearStatus();
            }}
            feedback={feedback?.channel === "blur" ? feedback : undefined}
            onApply={() => void applyBlur()}
            onAddTransform={() => void addTransform()}
            onRefresh={enter}
          />
        </section>
      </main>
      <div className="apply-section">
        {/* One line of text above the button: the latest result or, when there
            is none, the hint. It also describes the button for screen readers. */}
        {curveError ? (
          <p className="feedback error" role="alert" id="apply-hint">
            {curveError}
          </p>
        ) : curveStatus ? (
          <p className="feedback" role="status" id="apply-hint">
            {curveStatus}
          </p>
        ) : (
          <p className="apply-hint" id="apply-hint">
            {hint}
          </p>
        )}
        <button
          className="primary-button"
          disabled={
            !host.available || !targets.length || !!curveProblem || applying
          }
          onClick={() => void apply()}
          aria-label="Apply animation"
          aria-describedby="apply-hint"
        >
          {applying ? "Working in Premiere…" : "Apply animation"}
          <span aria-hidden="true">↗</span>
        </button>
        <div className="footer-line">
          <span>Z Motion / 1.2.0</span>
          <span>Two keys. Your curve.</span>
        </div>
      </div>
    </div>
  );
}
