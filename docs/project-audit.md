# Z Motion project audit

Current scope amendment: the user subsequently selected a curve-only v1. The original audit below is historical. See `decisions/curve-only-v1.md` and `implementation-report.md` for the current product and accepted playhead-based keyframe workflow.

Audit date: 2026-11-02. Target: Windows, Adobe Premiere Pro 2026.

## Evidence and boundaries

The supplied Motion 4.3.0 distribution was inspected read-only. Its manifest, dependency metadata, loader, filenames and visible bundle identifiers were used to understand the architecture. No Motion source, binaries, presets, fonts or artwork are incorporated into Z Motion. The obfuscated bundle is not source code for a maintainable port. The compiled JSXBIN was not decoded or executed.

The original manifest lists both AEFT and PPRO but always loads `aeft.jsxbin`. Its HTML loads a 7.49 MB obfuscated `cep.js` bundle, activates CEP Node globals and loads a stylesheet. The manifest enables Node, mixed context and disabled web security. Its `effects` directory contains AE `.ffx` presets for dynamics, falloff, wiggle, orbit, spin, burst, excite and other tools. These files are not Premiere effects. Host declarations alone do not prove that those tools work in Premiere.

The initial Z Motion workspace is the React/Vite starter: a counter, framework artwork, default CSS, no host bridge, no extension manifest, no tests, no installer and no CI. The supplied Z icon and Argentum Sans fonts are present. There is no Git repository in this directory, so no remote or GitHub execution can be inferred.

The local Premiere executable reports 26.5.1.1; CEPHtmlEngine reports 12.0.1. Premiere was not running at audit time.

## Grilling: decisions challenged before implementation

| Question | Finding | Decision |
| --- | --- | --- |
| Can the AE engine be renamed into a Premiere plugin? | No. Composition layers, expressions and `.ffx` presets are host-specific. | Reimplement behavior through Premiere's documented host API. |
| Does a browser preview prove host integration? | No. It cannot read a Premiere sequence or write keyframes. | Separate explicit preview mode from the CEP adapter; report host validation separately. |
| Is CEP already removed from Premiere 2026? | No. Installed CEP 12 is present; Adobe's September 2026 transition announcement keeps CEP until December 2029. | Use CEP 12 for the current React/Vite panel, with a replaceable host port. |
| Can arbitrary AE velocity handles be transferred exactly? | The documented Premiere scripting API does not expose equivalent AE temporal influence handles. | Bake curves into editable, frame-aligned linear keyframes; disclose this representation. |
| Is overwriting existing animation safe by default? | It would erase user work. | Reject collisions unless the user explicitly enables replacement in the affected range. |
| Can timeline time be used directly as effect time? | Trimmed clips have source offsets; retiming complicates conversion. | Convert clip-relative frame times using the source in-point; reject retimed/reversed clips initially. |
| Can an installer require Node on an editing workstation? | The panel can ship with its runtime assets. | Bundle compiled JS/CSS/fonts. Use Premiere's CEP and built-in Windows PowerShell. |
| What is the first usable release? | User approved curves, entrance/exit animation, local presets and transforms. | Deliver that scope; do not present AE rigging, physics or text engines as implemented. |
| Where should tests observe behavior? | User approved keyframe generation, host communication, UI flows and sandbox installation/uninstallation. | Test public boundaries and keep host simulations distinct from Adobe execution. |

## Functional translation

| Motion family | Z Motion implementation direction | Boundary |
| --- | --- | --- |
| Easing and curve controls | Cubic Bezier controls, reusable curve presets, sampled keyframes | Baked curves, not AE influence handles |
| Entrance and exit animation | Fade, slide, zoom and rotation recipes on selected video clips | Native Motion/Opacity parameters |
| Preset workflow | Validated, versioned local recipes with import/export | Original Z Motion JSON format, not `.ffx` |
| Transform utilities | Position, scale, rotation and opacity adjustments | Refuse animated parameters for static edits |
| Rigging, parenting, expressions, dynamics, falloff | Deferred | Require a separate Premiere-native design or MOGRTs |
| AE shape and text layer generation | Deferred | Not claimed as Premiere functionality |

## Skills

Applied local skills: find-skills, frontend-design, tdd, and the critical-question workflow requested through grill-me. The installed grill-me file only delegates to the upstream grilling skill. Project facts were researched directly. The user confirmed the implementation scope and test boundaries before tests were written.

`npx --yes skills find premiere`, `vitest`, and `github actions` were executed. The first sandbox attempt failed with DNS restrictions; the approved retry succeeded. Selected references: `antfu/skills@vitest` (45.5K installs, repository 6.0K stars) and `wshobson/agents@github-actions-templates` (17.8K installs, repository 42.0K stars), as reported by skills.sh at audit time. The Premiere search results did not establish a more authoritative extension-development reference than Adobe's own documentation. No unrelated installed document, database, hosting or image-generation skills are needed for this local Adobe panel.

## Primary sources

- [Adobe CEP transition announcement](https://blog.developer.adobe.com/en/publish/2026/09/investing-in-the-future-of-creative-cloud-extensibility-uxp-comes-to-our-flagship-applications)
- [Adobe CEP resources](https://github.com/Adobe-CEP/CEP-Resources)
- [Adobe Premiere sample panel](https://github.com/Adobe-CEP/Samples/tree/master/PProPanel)
- [Premiere UXP API](https://developer.adobe.com/premiere-pro/uxp/)
- [Vitest skill](https://skills.sh/antfu/skills/vitest)
- [GitHub Actions templates skill](https://skills.sh/wshobson/agents/github-actions-templates)

## Remaining validation risks

Host property layouts and source-time behavior must be checked in the actual Premiere version, including a localized UI, trimmed media, existing animation and multiple selected clips. Contract tests do not certify Adobe behavior. Unsigned local CEP distribution needs the current user's CEP developer setting; the installer must disclose and preserve its previous state. Code signing and Adobe Marketplace publication are separate distribution work.
