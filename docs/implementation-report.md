# Z Motion implementation report

## Current version: 1.1.2

Date: 2026-11-05. Fixed the user's selected-clip motion blur failure: the existing Transform in their saved project uses `AE.ADBE Geometry2`, which 1.1.1 did not recognize. Both Transform versions are now recognized. Blur has a separate clip context, independent of curve keys, cursor access, speed and direction. The panel identifies the selected clip and adds Refresh clip plus the explicit Apply blur to clip label. See the [detection fix](bug-fixes/transform-motion-blur-detection.md).

Validation: ESLint, all 86 automated tests, TypeScript and the production CEP build pass. All 12 browser flows pass, including clip identification/refresh, blur application with no curve pair, disabled curve application and unchanged animation commands. The 280/400/1100 px layouts pass; connected and narrow screenshots were inspected. The isolated installer lifecycle passes. Version 1.1.2 runtime packaging contains 13 files with integrity hashes.

The EXE also passed isolated installation, with all 13 installed payload hashes matching the production build. The saved project was inspected read-only. Native UI automation could not initialize because its runtime reported missing kernel assets; the agent did not independently verify live application or rendering. The user subsequently approved the version and requested GitHub publication. Publication status is tracked in the [publication report](git-and-release-report.md).

[Version 1.1.2](https://github.com/zielisgabriel/z-motion-premiere/releases/tag/v1.1.2) is published as Latest. [Remote CI](https://github.com/zielisgabriel/z-motion-premiere/actions/runs/42134387871) passed on Linux and Windows for the tagged source commit `36221b57e48ebabdae4ea6b214293693f8339011`, including Windows installer verification. Original EXE/ZIP artifacts were preserved and their uploaded hashes verified.

## Historical checkpoint: 1.1.1

Date: 2026-11-05. The user clarified that the requested feature is motion blur and requested restoration to the latest GitHub source. `origin/main` was fetched, the working tree was restored, and comparison with `bdfc512a99d3c12875cfabd9bb5e0854f751c25a` returned no differences before implementing this feature. The prior local movement-generation code and controls were removed.

The panel now includes an independent Motion blur section for an existing Transform effect. It offers a 0–360° shutter angle, Off/90°/180°/360° shortcuts and explicit effect selection when needed. Apply blur changes only the two static shutter controls; Apply animation retains its existing curve behavior. No current keyframe pair is required to set blur. Native Motion animation and movement within source footage are not converted. The timing marker does not render blur.

Native discovery recognizes the Transform match name and validates supported shutter layouts, values and animation state. The host rejects stale effect snapshots and animated shutter settings. It checks readback, attempts to restore previous settings after a failed write and reports partial rollback failures. See the [motion blur decision](decisions/transform-motion-blur.md) for the protocol, localization and rendering boundaries.

Validation: ESLint, TypeScript and the production CEP build pass. All 77 automated tests and all 12 browser flows pass. Browser checks cover 280/400/1100 px layouts, direct file loading, applying/off without a curve pair, multiple Transform selection and native errors, plus the original curve regressions. The isolated installer lifecycle passes. Browser evidence is in `artifacts/motion-blur-*.png`; the locally cached Chromium can be reused by setting `PLAYWRIGHT_BROWSERS_PATH` to `artifacts/playwright-browsers`.

The corrected local distribution is version 1.1.1, distinguishing it from the superseded local 1.1.0 movement installer. There is no new GitHub commit, tag, release or remote CI result. Live Premiere motion blur application and rendered playback remain unverified. The 1.0.2 report below is a historical checkpoint.

## Historical checkpoint: 1.0.2

Date: 2026-11-02. Current version: 1.0.2, curve-only first release with native keyframe compatibility and scalar readback precision fixes. Current workspace: `C:/Users/Gabriel/Desktop/z-motion-premiere`.

## Current user-approved objective

The panel now focuses exclusively on easing between existing keyframes. The user requested removal of Transform, Presets, the large Timeline selection area and clip animation recipes. It contains the graph, motion preview and a single Apply Animation action.

The user also explicitly accepted automatic discovery of the pair surrounding the playhead, with a small property selector only when multiple properties qualify. Premiere does not expose the highlighted Effect Controls keyframe selection through its public API. This distinction must remain explicit in future work.

## Implemented changes

- Removed the toolkit tabs, static transforms, entrance/exit recipes, frame-duration/amount/stagger controls and preset library/storage from active source.
- Replaced clip-boundary animation generation with interpolation of the existing endpoint values and times.
- Added exact tick-string/BigInt frame sampling for scalar and 2D values, with original endpoints retained and internal sequence frames filled from the cubic curve.
- Updated the preview to consume the same sample plan and duration as native application. Position, rotation, scale, opacity and generic numeric timing use a Z marker; this is not a video render.
- Added playhead-to-source-time conversion for trimmed forward clips and generic keyframed parameter discovery.
- Added snapshot revalidation, descriptor/trim guards, generated-value readback and retention of the original interval during reapplication. Existing generated keys are updated without requesting duplicate creation.
- Replaced protocol 1 with protocol 2, exposing only `inspect` and `apply-curve`. Old clip-wide animation and transform operations are rejected.
- Reduced the interface to a compact, scrollable instrument with a persistent apply button, using the original branding and DESIGN.md rules.
- Corrected handle dragging to use SVG screen coordinates and freeze graph bounds during a drag.
- Updated the production manifest/package to 1.0.0 and adapted browser tests and CI evidence filenames.
- Kept the installer, integrity checks, upgrade/uninstall lifecycle and Windows EXE build. The portable package now includes these handoff documents.

## Validation

| Check | Current result |
| --- | --- |
| TypeScript / production CEP build | Passed |
| ESLint | Passed |
| Domain, transport, React and Adobe fixture tests | 38 passed, including 22 host boundary cases | 
| Browser tests | 7 passed |
| Browser coverage | Direct file loading; 280/400/1100 px layout; handle dragging; preview/native sample equality; ambiguous target selection; host rejection |
| Installer lifecycle | Passed: install, upgrade, uninstall, repeat uninstall, neighbor preservation, corrupt payload rejection and path traversal rejection |
| Measured unit coverage | Previous 1.0.0 measurement: 85.59% lines, 83.82% branches; not remeasured for this host-only fix, whose JSX tests are separate |
| Live Premiere keyframe application | User confirmed Position works in 1.0.1; Scale readback failed there and native Scale validation of 1.0.2 remains pending |
| Current Windows EXE and ZIP | 1.0.2 generated; EXE sandbox install passed and installed host/UI SHA-256 hashes matched the production build |
| GitHub-hosted CI | Passed on Linux and Windows: [run 41578086137](https://github.com/zielisgabriel/z-motion-premiere/actions/runs/41578086137) |

Tests of the host use an explicit Adobe API fixture, not a live Premiere engine. Browser agreement tests capture actual Web Animations frames and compare their normalized progression with the sample values sent through the simulated CEP boundary. These do not certify native rendering.

## Files to read first

1. `docs/decisions/curve-only-v1.md`: accepted target-discovery workflow, sampling, preservation limits and session cache.
2. `src/domain/easing-curve.ts`: exact frame times and value interpolation.
3. `host/premiere-host.jsx`: host discovery, range-token verification and writes.
4. `src/app.tsx` and `src/presentation`: compact panel and preview.
5. `docs/history/toolkit-prototype-report.md`: earlier 0.1.0 implementation, tests and decisions.

## Earlier work preserved

The initial read-only Motion 4 audit, skill searches, design plan, installer design and CI work remain documented. The earlier prototype implemented clip-based entrances/exits, transforms and local presets; those are historical and are not current v1 features. Its report, plan and README were archived under `docs/history` before removal. The existing 0.1.0 release artifacts are also retained locally.

The initial toolchain used TypeScript 7 with an incompatible typescript-eslint version; it was aligned to TypeScript 6. A minimatch override addressed the dependency audit advisory. No new dependencies were needed for the curve-only revision. The original Motion 4 distribution was not modified or redistributed.

## Reproduction

Use `npm ci`, `npm run check`, `npm run test:coverage`, `npx playwright install chromium`, `npm run test:browser`, `npm run test:installer` and `npm run package:windows`. Rebuild before packaging. Read README.md for the user workflow and installation path.

## Continuation constraints

- Do not reintroduce a broad toolkit into v1 without a new user request.
- Do not claim highlighted keyframe selection is available through CEP/UXP.
- Do not apply to a refreshed pair that differs from the preview snapshot.
- Keep endpoint values/times unchanged. Note that linearizing endpoint interpolation can affect neighboring segment tangents; CEP cannot fully preserve that metadata.
- Native writes are not atomic. Report partial errors and direct the user to Premiere Undo when necessary.
- Remembered intervals are host-session state. Restarting Premiere clears them.
- Verify native scalar/2D parameter behavior in Premiere 26.x, including fractional frame rates and trimmed clips, before claiming live compatibility.
- Keep code/documentation in English, new source filenames in kebab-case and implementation explanations in these documents.

## Historical 1.0.0 native and relocation checkpoint

The 1.0.0 panel was installed at the user's Adobe CEP directory and visibly rendered inside Premiere Pro 2026. During initial inspection, Premiere showed Not Responding and the panel surfaced its request timeout. No Apply Animation action was invoked by the agent, and no native keyframe writes were verified. The source of that application hang is not established.

The first Adobe query is now deferred until the user enters or focuses the editor. Subsequent window-focus refreshes occur only after engagement. A regression test verifies zero Adobe inspection calls during panel startup. This removes a startup interaction; it is not proof that the native hang is resolved. All 24 automated and 7 browser tests passed after this change.

During the work, the user moved the project from D: to the Desktop. The new location was confirmed using the Codex project inventory and inspected before edits continued. Source, documents, history and existing release artifacts were present. No user edits were overwritten. A temporary continuity checkpoint and copy of the installed CEP payload were also saved under the chat's writable visualization directory.

The installed 1.0.0 copy predates the final deferred-query change. Premiere was still running at the final process check, so the production extension was not overwritten while loaded. At that checkpoint, the next step was to close Premiere and run the 1.0.0 setup EXE to install the regenerated payload. Native pair discovery and actual application should then be verified in a disposable project before treating runtime compatibility as confirmed.

Historical 1.0.0 artifacts: `release/z-motion-1.0.0-setup.exe`, `release/z-motion-1.0.0-windows.zip` and `release/sha256sums.txt`. The final installer includes the deferred-query payload and these current documents.

## Historical 1.0.1 error correction

The user subsequently reproduced a real Apply Animation failure in Premiere 26.5.1 using Transform / Position on a cursor image. The target loaded successfully; creation was rejected by the panel. The old host accepted only zero/true mutation results and supplied Time objects exclusively. A void result could therefore cause a false rejection before checking the created key. Adobe's sample also uses numeric seconds for mutation calls.

The corrected host prefers numeric seconds, verifies creation using getKeys and verifies written values with getValueAtKey. A verified Time-object fallback remains available. Newly introduced keys at an unintended time are removed without deleting pre-existing keys there. Reapplication remembers the working time representation, and endpoint/neighbor values and times are rechecked. Diagnostics now include the source time and native result. See [the detailed fix report](bug-fixes/transform-position-keyframes.md) for the reproduction, evidence and limits.

The original implementation failed the new void-return and seconds-only Position regressions. The final automated checks passed: npm run check (ESLint, 32 tests, TypeScript and the production CEP build), seven browser tests and the installer lifecycle suite. The expanded host tests cover the screenshot's 30 fps, 15-frame 2D Overshoot case, along with no-op writes, Time-only compatibility and failed native creation.

The panel footer, package/lock versions, CEP manifest and installation instructions are now 1.0.1. No dependencies were added. Existing CI continues to run the same checks on Linux and Windows; no remote CI run is claimed.

Premiere was running and responsive when the installed extension was inspected. Its manifest was still 1.0.0. The loaded extension and the user's project were not overwritten or saved. Close Premiere before installing the new setup; restore the original two-key range if the failed attempt added keys, then retest playback and application in the native editor. Native success is not established by the fixture or by readback alone.

Release targets: release/z-motion-1.0.1-setup.exe, release/z-motion-1.0.1-windows.zip and release/sha256sums.txt.

The Windows 1.0.1 EXE was executed in an isolated installation directory. Installation succeeded, the installed manifest reported 1.0.1, and both the installed host script and UI bundle matched the production build by SHA-256. Release verification evidence is saved in release/verification-1.0.1.json. This test did not alter the running Adobe extension, registry or project.

## Current 1.0.2 Scale readback correction

The user confirmed that Position is working in 1.0.1. They then reported a Scale failure at source time 3600.83333333333s with native result true. This failed after creation, during immediate scalar value verification. The component containing Scale and the requested/stored values were not supplied by the old error message.

The strict host comparison could reject finite scalar values rounded by storage. A new regression modeled 30 fps, one-hour source time, true native results and float32 Scale values; it failed against the old host and passed with the correction. This is a reproduced candidate cause, not a measurement of the native discrepancy in the user's instance.

Generated scalar readback now allows at most max(0.00001, abs(requested) * 0.0000001) absolute difference. The same bounded comparison is used immediately and during final generated-sample verification. Mathematical plan validation, original endpoint/neighbor preservation and 2D Position verification retain the previous strict comparison. Larger differences, clamps and successful-looking no-op writes still fail. Mismatch errors now report Requested and Stored values, source time and native result. No samples, time arguments or preview values were changed.

See [the Scale fix report](bug-fixes/scale-readback-precision.md). The README and v1 decision record the tolerance explicitly. Package/lock versions, CEP manifest, panel footer, install paths and implementation plan now point to 1.0.2. No dependencies or CI workflow changes were required.

Validation completed: npm run check passed ESLint, all 38 tests, TypeScript and production CEP packaging; all seven browser tests passed; installer lifecycle tests passed. The host suite contains 22 cases, including float32 and fixed-point scalar rounding, large values, Overshoot/reapplication, no-op writes returning true, a small wrong value exceeding tolerance and strict endpoint preservation. Native Scale playback remains pending; Position success is user-reported for their 1.0.1 scenario.

At the process check, Premiere was open and responsive with extension 1.0.1 installed. The loaded extension was not overwritten, no keys were written by the agent and the project was not saved. Close Premiere to install the new EXE. Restore the intended original pair if the previous failed attempt inserted intermediate keys, then validate Scale and reapplication. If failure remains, the complete new Requested/Stored error is the next diagnostic evidence.

Release targets: release/z-motion-1.0.2-setup.exe, release/z-motion-1.0.2-windows.zip, release/sha256sums.txt and release/verification-1.0.2.json.

The 1.0.2 setup EXE passed an isolated installation. Its installed manifest reported 1.0.2, and the host/UI hashes matched dist. The final release includes this handoff; release/verification-1.0.2.json records final artifact verification. The running Adobe extension and the user's project were left unchanged.

## Git/GitHub publication preparation: 2026-11-03

The user requested English Conventional Commits, a GitHub repository and releases for all four generated versions. Original binaries are preserved with version-specific SHA-256 files. Earlier tags recover their compiled packages honestly; current source is retained on main and v1.0.2. See [publication report](git-and-release-report.md), [release provenance](release-history.md) and [changelog](../changelog.md) for the final publication and CI status. The product version and native validation limits are unchanged.

## GitHub publication completed: 2026-11-03

The [private repository](https://github.com/zielisgabriel/z-motion-premiere) now contains English Conventional Commits, four annotated release tags, complete maintained 1.0.2 source and accurately labeled historical package snapshots. All four releases are published with original installers, ZIPs and checksums. GitHub asset sizes and SHA-256 digests matched all 12 originals. Version 0.1.0 is a prerelease; 1.0.2 is Latest. [CI](https://github.com/zielisgabriel/z-motion-premiere/actions/runs/41578086137) passed on Linux and Windows, including coverage, browser checks and Windows installer verification. See [the publication report](git-and-release-report.md) and [remote verification](releases/publication-verification.json). Native Scale validation remains pending and is not implied by publication.
