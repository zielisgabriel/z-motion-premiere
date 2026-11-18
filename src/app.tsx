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
  type NumericValue,
} from "./domain/easing-curve";
import { CurveEditor } from "./presentation/curve-editor";
import { MotionBlurControls } from "./presentation/motion-blur-controls";
import { ThemeToggle } from "./presentation/theme-toggle";
import { ChecklistPicker } from "./presentation/checklist-picker";
import {
  applyTheme,
  panelStorage,
  readTheme,
  saveTheme,
  type Theme,
} from "./presentation/theme";
import brandIcon from "../public/images/icon.png";

/** Identifies the loaded keyframe pairs; a new pair resets the choice. */
function pairKey(targets: CurveTarget[]) {
  return targets
    .map((target) => `${target.id}@${target.startTicks}-${target.endTicks}`)
    .sort()
    .join("|");
}

function displayValue(value: NumericValue): string {
  return typeof value === "number"
    ? Number(value.toFixed(3)).toString()
    : value.map((coordinate) => Number(coordinate.toFixed(3))).join(", ");
}

/** Identifies the set of items the user saw, to detect a changed set. */
function propertySet(items: { id: string }[]) {
  return items.length
    ? {
        id: items
          .map((item) => item.id)
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
  // Every Transform effect on the clip is offered for motion blur, all
  // checked when the set of effects changes.
  const [blurTargets, setBlurTargets] = useState<MotionBlurTarget[]>([]);
  const blurTargetsRef = useRef<MotionBlurTarget[]>([]);
  const [blurExcluded, setBlurExcluded] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const blurExcludedRef = useRef<ReadonlySet<string>>(new Set());
  const blurKeyRef = useRef("");
  const selectionRef = useRef<string | undefined>(undefined);
  const [shutterAngle, setShutterAngle] = useState(180);
  const [curve, setCurve] = useState<Curve>(defaultCurve);
  const [theme, setTheme] = useState<Theme>(() => readTheme(panelStorage()));
  const [snapshot, setSnapshot] = useState<HostSnapshot | null>(null);
  // Premiere does not expose keyframe selection: every property with a
  // keyframe pair around the playhead is offered, all checked for a new pair,
  // and the user can leave some out.
  const [targets, setTargets] = useState<CurveTarget[]>([]);
  const [excluded, setExcluded] = useState<ReadonlySet<string>>(new Set());
  const excludedRef = useRef<ReadonlySet<string>>(new Set());
  const pairKeyRef = useRef("");
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
          blurTargetsRef.current = [];
          setBlurTargets([]);
          setInspectError((failure as Error).message);
        }
      }
    }

    async function reload() {
      const next = await service.inspect(targetsRef.current[0]);
      if (!mounted.current) return;
      targetsRef.current = next.targets;
      setTargets(next.targets);
      const key = pairKey(next.targets);
      if (key !== pairKeyRef.current) {
        // A new pair starts with every property checked.
        pairKeyRef.current = key;
        excludedRef.current = new Set();
        setExcluded(new Set());
      }
      setSnapshot(next);
      selectionRef.current = next.motionBlur?.selectionToken;
      const effects = next.motionBlur?.targets ?? [];
      blurTargetsRef.current = effects;
      setBlurTargets(effects);
      const blurKey = effects
        .map((effect) => effect.id)
        .sort()
        .join("|");
      if (blurKey !== blurKeyRef.current) {
        // A different set of Transform effects starts with all checked.
        blurKeyRef.current = blurKey;
        blurExcludedRef.current = new Set();
        setBlurExcluded(new Set());
        setShutterAngle(effects[0]?.shutterAngle || 180);
      }
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

  const chosenTargets = useMemo(
    () => targets.filter((target) => !excluded.has(target.id)),
    [targets, excluded],
  );
  const chosenNow = () =>
    targetsRef.current.filter((target) => !excludedRef.current.has(target.id));

  function chooseProperties(next: ReadonlySet<string>) {
    excludedRef.current = next;
    setExcluded(next);
    clearStatus();
  }

  // Every chosen property must accept the curve before anything is written.
  const curveProblem = useMemo(() => {
    for (const target of chosenTargets) {
      try {
        service.prepare(target, curve);
      } catch (failure) {
        return `${target.label}: ${(failure as Error).message}`;
      }
    }
    return "";
  }, [service, chosenTargets, curve]);

  async function apply() {
    if (curveProblem) return;
    await write(
      "curve",
      propertySet(chosenTargets),
      () => propertySet(chosenNow()),
      async () => {
        const latest = chosenNow();
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
          const next = targetsRef.current.map(
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

  const chosenBlur = useMemo(
    () => blurTargets.filter((effect) => !blurExcluded.has(effect.id)),
    [blurTargets, blurExcluded],
  );
  const chosenBlurNow = () =>
    blurTargetsRef.current.filter(
      (effect) => !blurExcludedRef.current.has(effect.id),
    );

  function chooseBlur(next: ReadonlySet<string>) {
    blurExcludedRef.current = next;
    setBlurExcluded(next);
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
      propertySet(chosenBlur),
      () => propertySet(chosenBlurNow()),
      async () => {
        const latest = chosenBlurNow();
        const updated: MotionBlurTarget[] = [];
        const failures: string[] = [];
        let message = "";
        // Each Transform is independent: one failure does not stop the rest.
        for (const effect of latest) {
          try {
            const result = await blurService.apply(effect, angle);
            updated.push(result.target);
            message = result.message;
          } catch (failure) {
            failures.push(`${effect.label}: ${(failure as Error).message}`);
          }
        }
        if (mounted.current && updated.length) {
          const next = blurTargetsRef.current.map(
            (item) => updated.find((effect) => effect.id === item.id) ?? item,
          );
          blurTargetsRef.current = next;
          setBlurTargets(next);
          setSnapshot((current) =>
            current?.motionBlur
              ? {
                  ...current,
                  motionBlur: { ...current.motionBlur, targets: next },
                }
              : current,
          );
        }
        if (failures.length)
          throw new Error(
            failures.join(" ") +
              (updated.length
                ? ` Applied to ${updated.map((effect) => effect.label).join(", ")}.`
                : ""),
          );
        if (latest.length === 1) return message;
        return angle === 0
          ? `Motion blur disabled for ${latest.length} Transform effects.`
          : `Motion blur applied at ${angle} degrees to ${latest.length} Transform effects. Check playback in Premiere.`;
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
  const hint = !host.available
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
            targets={blurTargets}
            excluded={blurExcluded}
            angle={shutterAngle}
            pending={applying}
            available={host.available}
            onChoose={chooseBlur}
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
        {/* Above the button: the latest result, then the chosen properties
            (or why nothing can be applied). The first of them describes the
            button for screen readers. */}
        {curveError ? (
          <p className="feedback error" role="alert" id="apply-feedback">
            {curveError}
          </p>
        ) : curveStatus ? (
          <p className="feedback" role="status" id="apply-feedback">
            {curveStatus}
          </p>
        ) : null}
        {targets.length ? (
          <ChecklistPicker
            items={targets}
            excluded={excluded}
            disabled={applying}
            title="Properties to animate"
            note="Keyframe pairs around the playhead."
            verb="Animates"
            empty="Choose at least one property to animate."
            detail={(target) =>
              `${displayValue(target.startValue)} → ${displayValue(target.endValue)}`
            }
            summaryId="apply-targets"
            onChange={chooseProperties}
          />
        ) : (
          <p className="apply-hint" id="apply-hint">
            {hint}
          </p>
        )}
        <button
          className="primary-button"
          disabled={
            !host.available ||
            !chosenTargets.length ||
            !!curveProblem ||
            applying
          }
          onClick={() => void apply()}
          aria-label="Apply animation"
          aria-describedby={
            curveError || curveStatus
              ? "apply-feedback"
              : targets.length
                ? "apply-targets"
                : "apply-hint"
          }
        >
          {applying ? "Working in Premiere…" : "Apply animation"}
          <span aria-hidden="true">↗</span>
        </button>
        <div className="footer-line">
          <span>Z Motion / 1.2.1</span>
          <span>Two keys. Your curve.</span>
        </div>
      </div>
    </div>
  );
}
