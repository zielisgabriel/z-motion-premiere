# Z Motion

Z Motion is an easing curve editor for existing Adobe Premiere Pro 2026 keyframes, with independent motion blur controls for a clip's Transform effect.

[Version 1.1.2](https://github.com/zielisgabriel/z-motion-premiere/releases/tag/v1.1.2) adds **Motion blur** controls for an existing **Transform** effect and recognizes both Premiere Transform versions. It applies the shutter setting to the entire selected clip without requiring a keyframe pair or playhead placement.

## Motion blur

1. Select a clip with the **Transform** effect. No keyframe selection or playhead placement is required.
2. In Z Motion, scroll to **Motion blur** and check the displayed clip name. **Refresh clip** reloads the timeline selection. Choose the Transform instance if the clip has more than one.
3. Set **Shutter angle** (180° is the initial suggestion) and click **Apply blur to clip**. Choose **Off** and apply to disable it.

This disables the composition shutter option and sets the effect's manual shutter angle for the entire clip. It preserves movement keyframes and works independently of **Apply animation**, including on retimed or reversed clips. Visible blur requires movement in Transform's Position, Scale or Rotation; a stationary section stays sharp. The Z marker previews timing only; inspect blur in Premiere playback. Native Motion animation and motion already present in recorded footage do not receive this Transform blur. Animated shutter settings are preserved by refusing the operation. See the [motion blur decision](docs/decisions/transform-motion-blur.md) and [1.1.2 detection fix](docs/bug-fixes/transform-motion-blur-detection.md).

## Curve workflow

1. Select one video clip that already has animated properties in Effect Controls.
2. Place the playhead between the two keyframes you want to smooth.
3. Move the pointer into Z Motion or focus a graph control. The eligible pair loads automatically. If more than one property is animated at that time, choose the property in the small selector.
4. Adjust the curve using its handles, arrow keys, coordinates or curve shortcuts. Review the preview.
5. Click **Apply Animation**. The plugin preserves both endpoint values and times and writes the intermediate sequence-frame values.

Premiere's public API does not expose which keyframes are highlighted in Effect Controls. The playhead-based workflow above was explicitly approved for v1. Do not treat the highlighted diamonds as a selection that the extension can read. See the [design decision](docs/decisions/curve-only-v1.md).

The first Adobe query waits until you enter the editor, so opening the panel does not query a project during Premiere startup.

The preview animates the Z marker using the same numeric samples that are sent to Premiere. Its duration comes from the existing keyframes. It illustrates the parameter's timing and relative movement; it is not a rendered video preview. Native values are checked at sampled frames, allowing only bounded storage rounding for generated scalar values. Subframe rendering and motion blur are outside that guarantee.

## Install on Windows

1. Save your project and close Premiere Pro.
2. Download [z-motion-1.1.2-setup.exe](https://github.com/zielisgabriel/z-motion-premiere/releases/download/v1.1.2/z-motion-1.1.2-setup.exe), run it and choose **Install Z Motion**.
3. Open Premiere Pro 2026, then **Window > Extensions > Z Motion**. Some workspaces label this menu **Extensions (Legacy)**.

The installer includes the compiled panel, host script, original Z icon, Argentum Sans fonts and documentation. No Node.js, npm, After Effects or separate font installation is required on the editing machine. Premiere Pro 26.x with CEP 12 must already be installed through your Adobe account. Windows PowerShell and .NET Framework are used by setup.

This is an unsigned build. Setup explains the per-user Adobe setting `HKCU\Software\Adobe\CSXS.12\PlayerDebugMode=1`, required for unsigned CEP panels, and records its previous value. No machine-wide execution policy is changed. Publisher signing and Adobe Marketplace distribution are separate work.

Alternatively, download [z-motion-1.1.2-windows.zip](https://github.com/zielisgabriel/z-motion-premiere/releases/download/v1.1.2/z-motion-1.1.2-windows.zip), extract it completely and run `install-z-motion.cmd`. [SHA-256 checksums](https://github.com/zielisgabriel/z-motion-premiere/releases/download/v1.1.2/z-motion-1.1.2-sha256sums.txt) are available for both packages. To use a nonstandard Premiere location:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\install-z-motion.ps1 -EnableUnsigned -PremierePath 'D:\Adobe\Adobe Premiere Pro 2026'
```

The destination is `%APPDATA%\Adobe\CEP\extensions\com.zielis.z-motion`. The installed folder contains `uninstall-z-motion.cmd`. Uninstallation preserves other extensions and legacy local preset data. The shared Adobe developer setting is retained by default; the PowerShell uninstaller accepts `-RestoreDeveloperSetting` when explicitly requested.

## Version 1.0.2

The user confirmed Position works in 1.0.1 and reported a Scale value-readback error. This patch accepts bounded storage rounding for generated scalar values while retaining strict endpoint, snapshot and 2D Position checks. Larger mismatches, clamps and no-op writes still fail. Errors include both the requested and stored values.

See the [Scale precision report](docs/bug-fixes/scale-readback-precision.md) and the [earlier Position fix](docs/bug-fixes/transform-position-keyframes.md). Restore the original endpoint pair if a failed attempt added intermediate keys. Scale application and playback in 1.0.2 still require a native retest.

## Supported curve ranges

- One selected video clip, forward playback at 100% speed.
- Existing numeric or two-dimensional keyframes on a readable, keyframe-capable component parameter.
- Frame-aligned endpoint keys 2–1800 sequence frames apart.
- Both original endpoint values and times remain fixed. Their interpolation is made linear together with the internal samples to represent the baked curve.
- Reapplying in the same Premiere scripting session retains the original pair while the playhead stays inside it. Generated keys are updated without treating them as new endpoints. Restarting Premiere clears this remembered interval.
- Keys outside the chosen interval retain their values and times. Changing endpoint interpolation can affect interpolation into neighboring segments; CEP does not expose enough tangent metadata to preserve that exactly.
- Opacity bounds are checked before applying. If another property rejects or clamps a sample, the host reports failure rather than claiming it reproduced the preview.

The host revalidates the keyframe snapshot before writing. Changed keyframes, trim, property layout or clip selection cause a refusal. CEP edits are not atomic: a native failure can leave partial changes and require multiple Premiere Undo steps. Projects are never saved automatically.

Browser preview mode edits the graph and previews timing. **Apply Animation** is disabled outside Premiere and when there is no unambiguous valid pair.

## Develop and test

Use Node.js 24 LTS, then:

```sh
npm ci
npm run dev
npm run check
npm run test:coverage
npx playwright install chromium
npm run test:browser
```

Windows installation verification and packaging:

```sh
npm run test:installer
npm run package:windows
```

Build before packaging. The package command produces the EXE, portable ZIP and SHA-256 checksums under `release` using the Windows .NET Framework C# compiler. The EXE accepts `/sandbox <absolute-directory>` for isolated tests without registry changes or Adobe prerequisites. Integrity inventories detect file corruption; they are not publisher signatures.

The build targets Chromium 99, emits an IIFE with local relative assets and packages the CEP 12 manifest. It does not enable CEP Node integration, disable web security, start a runtime server or open a debug port.

## Architecture and continuation

| Location | Responsibility |
| --- | --- |
| `src/domain/easing-curve.ts` | Curve validation, Bezier inversion, precise frame times and value sampling |
| `src/application` | Host port and curve use cases |
| `src/infrastructure/cep-host.ts` | Version 2 CEP request/response transport |
| `src/presentation` | Graph interaction and sample-based motion preview |
| `host` | ES3 JSON codec, pair discovery, snapshot validation and native writes |
| `installer`, `scripts` | Installation, packaging and isolated verification |
| `tests` | Adobe API fixture and real-browser user flows |

The GitHub Actions workflow checks Linux and Windows, produces browser evidence and builds Windows installer artifacts. It runs for source/configuration changes pushed to main, pull requests and manual dispatch. Documentation-only main pushes and tag pushes skip redundant builds. Actual remote run outcomes are recorded in the publication report.

Read the [current implementation report](docs/implementation-report.md), [v1 decision](docs/decisions/curve-only-v1.md), [initial audit](docs/project-audit.md) and [archived toolkit prototype report](docs/history/toolkit-prototype-report.md) before continuing. Transform tools, movement recipes and the preset library were removed from the active product at the user's request. The archived reports retain the earlier work and rationale for future development.

The [2026-11-05 motion blur amendment](docs/decisions/transform-motion-blur.md) adds only Transform shutter controls. Movement-generation recipes, static transforms and the preset library remain outside the active product.

New source files use kebab-case, code and documentation are in English, and explanatory decisions live in documentation rather than code comments. Standard tool filenames retain their required spelling.

## Provenance

Z Motion is an independent implementation. The supplied Motion 4.3.0 distribution was inspected read-only; none of its code, binaries, presets or artwork is redistributed. The supplied Z Motion icon is used as requested. Argentum Sans is bundled under the SIL Open Font License, and runtime dependency notices are included in `dist/licenses`.

## Repository and releases

[GitHub repository](https://github.com/zielisgabriel/z-motion-premiere), [releases](https://github.com/zielisgabriel/z-motion-premiere/releases), [changelog](changelog.md), [release provenance](docs/release-history.md) and [publication report](docs/git-and-release-report.md). The repository was initially created as private and was already public when 1.1.2 publication was requested. Commits use Conventional Commits in English. The historical tags preserve packaged snapshots, while main and versions from v1.0.2 onward contain maintained source.
