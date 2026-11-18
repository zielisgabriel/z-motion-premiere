# Transform motion blur

Date: 2026-11-05. The user clarified that the requested feature is motion blur and requested restoration to the latest GitHub code first. After fetching `origin/main`, the working tree was restored and verified identical to `bdfc512a99d3c12875cfabd9bb5e0854f751c25a`. The new feature is based on that curve editor. Movement generation is absent.

## Interaction

A compact Motion blur section accompanies the existing graph and timing preview. It follows the existing paper/ink/carmine palette, Argentum Sans, square controls and scrolling tool area. There are no new tabs. The section contains the selected clip name, Refresh clip, a shutter-angle input (0–360°), Off/90°/180°/360° shortcuts and an explicit Apply blur to clip action. The initial suggestion is 180° when the current manual angle is zero; merely loading or editing the controls never changes Premiere.

Apply blur is independent of Apply animation. It configures a selected clip's existing Transform effect, without creating or rewriting movement keyframes or applying the visible curve. An active keyframe pair is not required. Multiple supported Transform instances require an explicit effect choice. The current shutter setting is displayed, including whether it uses the composition setting. Applying Off sets a manual angle of zero. Settings affect the entire chosen Transform instance, not just the curve interval.

Blur comes from movement animated within Transform, such as its Position, Scale or Rotation. Native Motion keyframes and motion photographed inside source footage are outside this feature. Originally, when Transform was absent the panel directed the user to add it in Premiere and avoided undocumented QE calls. On 2026-11-18 the user asked for a one-click **Add Transform** button instead (see [Adding Transform](#adding-transform-2026-11-18) below). The panel still does not migrate animation or simulate a blur with CSS. The Z marker continues to preview numeric timing, not Premiere's rendered blur.

## Host contract

The protocol 2 inspection adds `motionBlur` targets and a `clipName`. The independent `apply-motion-blur` operation receives the chosen effect snapshot and desired angle. Native effect discovery uses `ADBE Geometry` and `ADBE Geometry2`, with or without the `AE.` prefix. Version 1.1.1 omitted Geometry2, which caused the user's selected Transform to be rejected; see the [detection fix](../bug-fixes/transform-motion-blur-detection.md). Parameter labels recognize English and Portuguese. The unnamed composition checkbox is accepted only in the known 11/12-parameter layout at index 9, adjacent to the identified Shutter Angle at index 10. Unknown layouts/languages are refused rather than guessed.

Both shutter parameters must be non-animated. Existing keyframed shutter controls are rejected without disabling their animation. A state token covers project/sequence/clip identity, clip trim, component count/order, all parameter labels, resolved shutter indices and both original values. These are reread immediately before mutation; the host rejects stale selection, layout or shutter settings. Blur uses a separate single-clip context without reading the playhead or movement keyframes. Curve inspection failures cannot disable valid blur controls. Forward playback at 100% speed is a restriction of the curve operation only; setting static shutter controls also supports retimed or reversed clips.

Application disables Use Composition's Shutter Angle, sets the manual angle and reads both values back. Readback, rather than a return code alone, detects clamps and no-op writes. Exceptions after a committed write are accepted only if readback agrees. If either write fails, the host attempts to restore both original values and verifies that rollback. Failed rollback reports partial changes and requests Premiere Undo. No project save is performed.

Curve sampling and native keyframe writes remain unchanged. New fields are additive so a legacy inspection can still load curves, but motion blur requires the matching new host script. Version 1.1.2 fixes selected-clip detection in the 1.1.1 motion blur build; the earlier local 1.1.0 movement build was discarded. After reviewing 1.1.2, the user requested its publication on GitHub.

## References and native validation

- [Adobe CEP sample](https://github.com/Adobe-CEP/Samples/blob/master/PProPanel/jsx/PPRO/Premiere.jsx) demonstrates ComponentParam reading and writing.
- [Two Transform versions reported through Premiere's component API](https://community.adobe.com/questions-729/about-two-transform-effects-1389931) records `AE.ADBE Geometry` and `AE.ADBE Geometry2`. The latter was also observed in the user's saved project.
- [Direct Transform parameter inventory](https://premiereonscript.com/wp-content/uploads/2018/03/Premiere-v12-Effect-Documentation.pdf) records `AE.ADBE Geometry` and the legacy Shutter Angle slot. It is an older observed layout, so current controls are also checked by name, type and animation state.
- [Transform shutter-angle behavior reported in Adobe's community](https://community.adobe.com/questions-729/transform-effect-bug-shutter-angle-broken-when-gpu-rendering-is-enabled-1412204) documents the actual controls and reports rendering problems. Native rendering is not certified by setting readback.

Tests exercise a simulated Adobe API and browser transport. Live Premiere application and rendered motion blur still require native verification, including GPU rendering and source images of differing sizes. The user-confirmed Position curve fix from 1.0.1 does not establish motion blur rendering compatibility.

## Adding Transform (2026-11-18)

The user asked for a button that adds Transform to the selected clip, replacing Effects → search → drag. They chose: the button is always available, even when the clip already has Transform (each click adds one more); it acts on every selected video clip; it only adds the effect and does not apply blur.

Premiere's supported ExtendScript API has no call to add an effect, so `add-transform` uses the undocumented QE DOM (`app.enableQE()`, `qe.project.getVideoEffectByName`, `QETrackItem.addVideoEffect`). Adobe staff describe QE as unsupported, and it may break in a Premiere update ([adding effects with QE](https://community.adobe.com/questions-729/how-to-add-effects-to-clips-in-premiere-with-cep-extendscript-1351311), [no match-name path in ExtendScript](https://community.adobe.com/t5/premiere-pro-discussions/apply-effect-without-replying-on-app-language/m-p/15424648)). QE looks effects up by their localized name; the host tries Transform, Transformar, Transformer, Transformieren and Trasforma, and otherwise asks the user to use the Effects panel.

Safeguards: the inspection reports the selected video clip count and a selection token (project, sequence and sorted clip node IDs); a changed selection is refused. Each clip is located on its video track through the standard DOM, then matched in QE by start ticks and name, skipping empty gaps; ambiguity is refused. Success is confirmed through the standard DOM: the clip must gain exactly one `ADBE Geometry`/`Geometry2` component. A different added effect reports Premiere Undo; a no-op reports failure. With several clips, the result names any clip that did not receive Transform. For a single clip the new Transform is returned so the panel selects it for motion blur.

Tests cover this against a simulated standard and QE DOM, the CEP bridge, the React panel and the browser panel. Live Premiere behaviour of QE `addVideoEffect` in 26.x has not been verified by the agent.
