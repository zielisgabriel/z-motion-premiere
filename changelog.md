# Changelog

Original builds were created on 2026-11-02. Git history and GitHub publication were completed on 2026-11-03. Earlier tags recover packaged runtime snapshots; they do not claim to restore missing TypeScript source history. See [release provenance](docs/release-history.md).

## [1.2.1](https://github.com/zielisgabriel/z-motion-premiere/releases/tag/v1.2.1) — 2026-11-18

Choose which properties receive the curve. The button above **Apply animation** previews the checked properties and opens a dialog to uncheck any of them, for example a Twixtor speed curve that shares the playhead with Scale and Opacity. A new keyframe pair starts with every property checked; reapplying to the same pair keeps the choice. A property left out no longer blocks Apply.

Motion blur uses the same picker: when a clip has several Transform effects, the button above the shutter angle previews the checked ones and opens a dialog to uncheck any. **Apply blur to clip** sets the angle on every checked Transform, all checked by default, and names any that Premiere rejects.

The user approved this release. ESLint, TypeScript, 147 automated tests and 24 browser flows passed locally; the pickers were not verified in Premiere by the agent.

## [1.2.0](https://github.com/zielisgabriel/z-motion-premiere/releases/tag/v1.2.0) — 2026-11-18

Fixes **Apply animation** and **Apply blur to clip** ignoring a click that comes from Premiere: reloading the selection no longer disables the panel, and a write waits for a reload in flight. The reason Apply is unavailable, or the latest curve result, now sits right above the button. Motion blur results appear in the Motion blur section. The preview Z reaches the guide ticks and stays inside the stage; the 280×400 minimum panel no longer scrolls and short panels use a compact layout. See the [bug report](docs/bug-fixes/panel-apply-click-and-layout.md). Native Premiere application was not re-verified.

Adds **Add Transform to clip** in the Motion blur section: one click adds the Transform effect to every selected video clip (another one if a clip already has it) and selects it for motion blur. It uses Premiere’s undocumented QE DOM; see the [decision](docs/decisions/transform-motion-blur.md#adding-transform-2026-11-18).

**Apply animation** no longer asks which property to use: one click applies the curve to every property with a keyframe pair around the playhead (Position, Scale, Opacity…), listed above the button. The motion preview was removed. See the [amended curve decision](docs/decisions/curve-only-v1.md).

Fixes curves on the **Transform** effect: Premiere 26.5.1 returns `null` when the host sets linear interpolation on Transform keys, which was treated as a failure after every frame value had already been written and verified. Interpolation is now best effort (an unconfirmed refusal becomes a warning), and one failing property no longer stops the others.

Adds a **dark theme**. The sun/moon button in the header switches between the default light theme and a dark one built from the DESIGN.md palette (Pitch Black canvas, Vanilla type, Carmine accents, Rule Charcoal graph); the choice is remembered by the panel.

## [1.1.2](https://github.com/zielisgabriel/z-motion-premiere/releases/tag/v1.1.2) — 2026-11-05

Adds clip-wide Transform motion blur, shutter angle 0–360°, Off/90°/180°/360° shortcuts and an independent Apply blur to clip action. Fixes disabled controls for Premiere's current `AE.ADBE Geometry2` Transform effect, confirmed in the user's saved project. Blur uses the selected clip independently of curve discovery, playback speed, playhead position and movement keyframes. The panel displays the clip name and provides Refresh clip. Shutter writes are verified and movement keyframes are preserved.

The user approved this version and requested publication. ESLint, 86 automated tests, 12 browser tests, TypeScript, CEP packaging, installer lifecycle and isolated EXE installation passed locally. Native rendering was not independently verified by the agent. This is the first GitHub release containing motion blur; 1.1.1 was a local build.

## 1.1.1 — local build, 2026-11-05

Restored the latest GitHub source (`bdfc512`) and added independent motion blur controls for an existing Transform effect: shutter angle 0–360°, Off/90°/180°/360° shortcuts, effect selection and verified native writes. Applying blur preserves movement keyframes. Stale or animated shutter controls are rejected; failed writes attempt to restore the previous shutter settings. Native blur playback remains unverified. This local build supersedes the discarded 1.1.0 movement-generation installer and is not a published GitHub release.

## [1.0.2](https://github.com/zielisgabriel/z-motion-premiere/releases/tag/v1.0.2)

Accepts bounded storage rounding for generated scalar keyframes without loosening original endpoint, neighboring key, curve-plan or 2D Position checks. Readback errors include requested and stored values. Larger mismatches, clamping and no-op writes still fail.

38 automated tests, seven browser tests, installer lifecycle checks and isolated EXE installation passed at the product checkpoint. Position is user-confirmed in 1.0.1. Native Scale application and playback in 1.0.2 remain pending; fixture success does not certify Premiere rendering.

## [1.0.1](https://github.com/zielisgabriel/z-motion-premiere/releases/tag/v1.0.1)

Corrected premature rejection of native key creation and mutation time arguments. Creation is confirmed with getKeys and generated values are read back. Preserves original endpoint and neighboring key values and times.

Historical checkpoint: 32 automated tests, seven browser tests and installer checks passed. The user confirmed Position works in this version, then reported a Scale readback error. Scale precision handling is included in 1.0.2.

## [1.0.0](https://github.com/zielisgabriel/z-motion-premiere/releases/tag/v1.0.0)

Replaced the broad toolkit with an easing graph, a sample-based motion preview and one Apply Animation action. Finds the existing keyframe pair around the playhead and inserts intermediate frame keys while preserving endpoint values and times.

Historical checkpoint: 24 automated tests and seven browser tests passed. The user subsequently reported a native Transform / Position key creation failure. Use 1.0.2 for the latest fixes.

## [0.1.0](https://github.com/zielisgabriel/z-motion-premiere/releases/tag/v0.1.0)

Initial toolkit prototype with easing curves, entrance/exit recipes, static transforms and local presets.

This is an archived prototype. Its broader interface was superseded by the user-approved curve-only first release.

Historical checkpoint: 27 automated tests, five browser tests, isolated installer lifecycle and EXE installation passed. Native Premiere edits were not verified at that checkpoint.
