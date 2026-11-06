# Decision: curve-only version 1

Status: accepted by the user on 2026-11-02. Supersedes the earlier toolkit prototype scope.

Amendment, 2026-11-05: the user requested [Transform motion blur controls](transform-motion-blur.md). The existing curve workflow remains unchanged. The new independent blur action adjusts shutter settings and does not generate movement; the two-operation protocol description below is historical.

## Product boundary

Version 1 edits easing between existing keyframes. The panel contains the curve editor, timing preview, a compact property choice when necessary, and one Apply Animation action. Transform and Presets navigation, the timeline selection summary, movement recipes, duration/amount/stagger inputs and preset storage are removed from the active application.

The source values and source times of the two endpoints determine the animation. The plugin does not create a new entrance or exit at clip boundaries. It samples the chosen cubic curve at each sequence frame and interpolates the original scalar or 2D values. The preview consumes that same sample plan.

## Target identification

Premiere's public scripting interfaces do not expose Effect Controls keyframe selection state. Do not infer that highlighted diamonds are readable, and do not implement imaginary methods such as `getSelectedKeyframes`.

The user explicitly accepted this workflow:

1. Select one video clip and position the playhead between the intended endpoint keys.
2. Resolve eligible animated properties on that clip. Automatically load the only eligible property; show a compact selector when multiple properties are eligible.
3. Draw the curve, review the preview and apply.

The first context query is deferred until the user enters or focuses the editor. Later window-focus refreshes occur only after that engagement. No Adobe query is sent on panel mount. The host converts sequence playhead time to clip source time using the clip's timeline start and source in-point. Retimed/reversed clips are rejected in this version.

## Sampling and preservation

The domain uses decimal tick strings and BigInt to avoid losing precision on long timelines. It accepts frame-aligned endpoint pairs 2–1800 frames apart. Both endpoint samples preserve their original times and values. Only internal samples are written. Endpoint interpolation is set to linear alongside the generated keys to represent the baked curve. Neighboring key values/times are retained; changing endpoint interpolation can affect interpolation into neighboring segments. CEP does not expose enough easing metadata to guarantee preservation of their tangents.

Generated values are checked at sampled sequence frames. Since 1.0.2, scalar storage readback allows an absolute difference of at most max(0.00001, abs(requested) * 0.0000001); the curve plan, original endpoints, neighbors and 2D Position values retain the stricter validation. This bounded tolerance covers modeled scalar rounding and does not replace actual playback validation. Subframe rendering, motion blur and an effect's internal spatial interpolation are not represented by the timing preview. The preview animates a Z marker using the loaded numeric/2D parameter values; it is not a rendered video monitor.

## Reapplication and consistency

After application, the host remembers the original endpoint interval for that property in its ExtendScript session. Generated internal keys do not become the new endpoints when the user adjusts the curve again. The remembered interval is used only while the playhead remains within it and both endpoint keys still exist. This cache is session state, not project metadata and not a preset. Restarting Premiere clears it.

A range token contains project/sequence/clip identity, component/parameter descriptor, source trim, frame timebase and the keys/values inside the interval. The host rereads this token immediately before writing. A stale preview causes a refusal rather than silently applying to a new interval.

The host validates all samples before mutation and verifies generated values by reading them back. Known opacity bounds are checked before writing; an Adobe rejection or clamp is reported as a failure. CEP writes are not atomic. A partial native failure requires Premiere Undo and can require multiple undo steps.

## Protocol and future work

The CEP protocol is now version 2 with only `inspect` and `apply-curve` operations. Old clip animation and transform commands are rejected. A future adapter with a real keyframe-selection API can replace range discovery through the host port while retaining the domain sampler and the focused UI.

For future extensions, consult the archived toolkit report and plan in `docs/history`. Reintroducing transforms, preset libraries, text or rigging requires a new scope decision; it is not part of v1.

## Sources

- [Adobe ComponentParam API](https://developer.adobe.com/premiere-pro/uxp/ppro-reference/classes/componentparam/)
- [Adobe Keyframe API](https://developer.adobe.com/premiere-pro/uxp/ppro-reference/classes/keyframe/)
- [Developer request for selection/easing API access](https://forums.creativeclouddeveloper.com/t/feature-request-read-write-keyframe-easing-and-selection-properties/11858)
- [Adobe's Premiere sample panel](https://github.com/Adobe-CEP/Samples/tree/master/PProPanel)
