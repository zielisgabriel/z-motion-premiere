# Z Motion implementation plan

## Architecture

The domain owns cubic Bezier sampling, input validation, recipes and frame-relative animation plans. The application layer coordinates a host port and preset storage. Infrastructure implements CEP messaging and local storage. Presentation owns React controls, the curve editor and explicit browser preview. A small ES3-compatible host script owns Premiere API access, selection validation, source-time conversion and mutation checks. No React or Adobe globals enter the domain.

CEP requests carry a protocol version, an allowlisted operation and JSON data encoded as a string argument. No arbitrary executable code is accepted from presets. Host requests have timeouts and malformed response handling. Mutation preflight runs against every selected clip before any write. A failed Adobe write must never be reported as success.

## Design review against DESIGN.md

Use vanilla `#FFF7D3` for the panel, pitch black `#0A0A0A` for structure and the curve viewport, graphite `#222222` for secondary detail, carmine `#AB1509` for active controls and tape paper `#E8DFC0` for supporting fields. Use bundled Argentum Sans: Black headings, SemiBold labels and Regular body text. Corners stay square and focus indicators remain visible.

This is a dockable editing instrument. A compact Z Motion identity and host status lead directly into a curve monitor, animation controls and a selection-aware apply action. Avoid a website hero, unrelated marketing statistics or decorative navigation. Wide panels use two work columns; narrow panels stack with a minimum width of 280 px. The curve editor is the visual focal point. Keyboard-editable numeric handles accompany pointer dragging. Respect reduced motion.

```text
Z icon / Z MOTION                  Host status / Refresh
Curves | Transform | Presets
Curve monitor + preview           Recipe + frame duration
Curve handles + curve presets     Direction + range policy
Selection summary                 Apply animation
Result / actionable error
```

## Delivery and verification

1. Record the initial audit before product implementation.
2. Use red/green slices at the approved boundaries: frame plans, host requests, user flows and installation lifecycle.
3. Compile a relative-path CEP distribution for Chromium 99, with the original logo and selected bundled fonts.
4. Produce a portable Windows installer bundle with an install launcher, PowerShell installer, uninstaller and integrity inventory. If an EXE compiler is available, also produce a self-contained setup executable.
5. Verify lint, type checking, unit/integration tests, browser flows, production packaging and isolated Windows installation. Record real Adobe validation separately.
6. Add GitHub Actions for repeatable validation and downloadable installer artifacts. Do not claim a workflow has run on GitHub without a repository and run evidence.
7. Update the English handoff report with commands, outcomes, limitations and next steps.
