# Changelog

Original builds were created on 2026-11-02. Git history and GitHub publication were completed on 2026-11-03. Earlier tags recover packaged runtime snapshots; they do not claim to restore missing TypeScript source history. See [release provenance](docs/release-history.md).

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
