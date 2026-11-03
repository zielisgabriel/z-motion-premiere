# Z Motion

An original motion toolkit for Adobe Premiere Pro 2026 on Windows. Built with React, TypeScript and Vite, packaged as a local CEP 12 panel.

## Install

1. Close Premiere Pro.
2. Run `release/z-motion-0.1.0-setup.exe` and choose **Install Z Motion**.
3. Open Premiere Pro 2026, open a project and sequence, then choose **Window > Extensions > Z Motion**. Some workspaces label this menu **Extensions (Legacy)**.
4. Select video clips in the timeline and click **Refresh** in Z Motion.

The installer includes the compiled panel, host script, logo and Argentum Sans fonts. Node.js, npm, After Effects and a separate font installation are not required on the editing machine. Adobe Premiere Pro 26.x with CEP 12 must already be installed through your Adobe account. Windows PowerShell and .NET Framework are supplied with supported Windows installations.

The EXE is a local, unsigned build, not an Adobe Marketplace package. Its installation screen explains the required per-user `HKCU\Software\Adobe\CSXS.12\PlayerDebugMode=1` setting. This enables unsigned CEP extensions for that Windows user. No machine-wide execution policy is changed. Previous settings are recorded in the installation metadata.

The ZIP is an alternative: extract it fully and run `install-z-motion.cmd`. A custom Premiere location can be supplied to the PowerShell installer:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\install-z-motion.ps1 -EnableUnsigned -PremierePath 'D:\Adobe\Adobe Premiere Pro 2026'
```

Installation target: `%APPDATA%\Adobe\CEP\extensions\com.zielis.z-motion`. Run `uninstall-z-motion.cmd` in that folder to uninstall. The uninstaller preserves other extensions and local preset data. The shared Adobe developer setting is retained by default; run the PowerShell uninstaller with `-RestoreDeveloperSetting` if you explicitly want to restore its pre-install value and do not need it for other local extensions.

## Use

- **Curves:** drag either Bezier handle, use the arrow keys on a focused handle, enter coordinates or choose a curve preset.
- **Movement:** fade, four slide directions, zoom or rotation. Choose entrance or exit, frame duration, amount and optional stagger. For exits, slide labels describe the edge the clip moves toward.
- **Apply animation:** writes frame-aligned, editable linear keyframes on the native Motion or Opacity property. The curve is baked into the samples rather than stored as After Effects temporal influence handles.
- **Transform:** set position, uniform scale, rotation or opacity on selected clips. Position uses percentages of the sequence frame; it does not relocate the clip's anchor point.
- **Presets:** save named recipes locally, load the starter recipes and import/export versioned Z Motion JSON files. Replacement consent is never saved in a preset.

An entrance begins at the clip's in point. An exit finishes on its last visible frame. Duration is the number of sampled frames, including both endpoints. Stagger offsets the animation inside each selected clip; it does not move clips on the timeline. Clips are ordered by timeline start, then stable clip ID.

The host validates the whole selection before mutation. Keyframe collisions are rejected unless **Replace keys in this range** is enabled. Existing key objects outside that range are retained; adding new keys can affect interpolation between neighboring keys. Static transforms refuse animated properties. Premiere's CEP API does not provide an atomic batch transaction: if Adobe rejects a write, the panel reports partial progress and directs you to Premiere Undo. An operation is not guaranteed to be a single Undo step. The panel never saves your project automatically.

## Current boundaries

- Targets Premiere 26.x / CEP 12. Other host versions are not declared supported.
- Animations require forward clips at 100% speed. Retimed/reversed clips are rejected.
- Supports standard video clips with native Motion/Opacity parameters. Uniform Scale must be enabled for scale operations. Audio selections are ignored.
- Up to 50 selected clips, 2–300 duration frames and 0–120 stagger frames per operation.
- Preview mode in a browser cannot edit Premiere. It never fabricates a successful timeline edit.
- AE expressions, parenting, rigging, physics, `.ffx` imports, shape generation and a text animation engine are outside this release's approved scope.
- Host contract tests use an Adobe API fixture. They do not replace validation in the installed Premiere application. See the [implementation report](docs/implementation-report.md) for the exact validation status.

## Develop and verify

Use Node.js 24 LTS or a supported version >=22.12.

```sh
npm ci
npm run dev
npm run check
npm run test:coverage
npx playwright install chromium
npm run test:browser
```

Windows packaging and installation tests:

```sh
npm run build
npm run test:installer
npm run package:windows
```

The Windows package command uses the .NET Framework C# compiler already present on Windows. It produces the EXE, portable ZIP and `sha256sums.txt` under `release`. SHA-256 inventories detect payload corruption; they are not publisher signatures.

The EXE also accepts `/sandbox <absolute-directory>` for automated installation tests without registry changes or an Adobe prerequisite. Do not use that mode for a real installation.

`npm run build` type-checks the project, builds a Chromium 99 IIFE bundle with relative assets and creates the CEP package in `dist`. No Node integration, disabled web security flag, remote server, runtime network access or debug port is enabled by the extension. Use `npm run dev` for the browser preview; use a packaged install to test Premiere. Restart the panel after rebuilding and reinstalling.

## Architecture

| Directory | Responsibility |
| --- | --- |
| `src/domain` | Curve math, recipe validation, frame sampling |
| `src/application` | Host port and editing use cases |
| `src/infrastructure` | CEP transport and versioned local preset storage |
| `src/presentation` | React editing controls |
| `host` | ES3-compatible JSON codec and Premiere adapter |
| `cep` | Adobe extension manifest |
| `installer` | Windows install/uninstall scripts and setup UI |
| `scripts` | Packaging and isolated installer verification |
| `tests` | Adobe contract fixtures and real-browser flows |
| `docs` | Audit, design decisions, validation and handoff |

New source filenames use kebab-case. Standard tool filenames such as `README.md`, `DESIGN.md` and `CSXS/manifest.xml` retain their required conventions. Supplied upstream font files retain their original names; bundled copies use kebab-case. Code contains no explanatory comments; decisions are documented here and in `docs`.

## Continuous integration

`.github/workflows/ci.yml` runs lint, tests, coverage, production builds and browser tests on Linux and Windows. Windows also validates installation and produces installer artifacts. It runs on pushes, pull requests and manual dispatch with read-only repository permissions. No credentials, Adobe license or publishing secrets are required. The workflow becomes active after these files are pushed to a GitHub repository.

## Provenance

The provided Motion 4.3.0 distribution was used as a read-only architectural reference. No Motion source code, binaries, presets or artwork are redistributed. Z Motion is an independent implementation, unaffiliated with Mt. Mograph or Adobe. The supplied Z Motion logo is used as requested. Argentum Sans is bundled under the SIL Open Font License; React, React DOM and Scheduler notices are included in `dist/licenses`.

Read the [project audit](docs/project-audit.md), [implementation plan](docs/implementation-plan.md) and [implementation report](docs/implementation-report.md) before continuing this project.
