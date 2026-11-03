# Current implementation plan: curve-only v1

The user replaced the broad toolkit scope with a first version dedicated to easing between existing keyframes. The earlier plan is preserved in `history/toolkit-prototype-plan.md`.

## Product

Keep the supplied Z icon, Argentum Sans and DESIGN.md palette. Remove tab navigation, transform tools, preset management, clip counts, timeline summary, movement recipes and user-defined animation durations. The graph, its curve controls, a sample-based motion preview and one Apply Animation action form the complete panel. A small property selector is shown only for ambiguous animated properties.

## Data flow

Premiere pair discovery → endpoint snapshot → domain Bezier sampler → shared preview/native sample data → host snapshot revalidation → internal keyframe writes → readback verification.

The user approved locating the pair around the playhead because Premiere does not expose highlighted keyframe selection. Preserve endpoint values/times and retain the original range for reapplication during the host session. Never switch to a different pair silently after the preview.

## Verification

Test curve/value math and exact tick times, the ES3 host boundary, protocol validation, reduced UI flows, rendered handle dragging, preview/apply agreement, responsive panel sizes, direct file loading and installation lifecycle. Preserve the distinction between Adobe API fixtures and actual Premiere execution.

## Handoff

Rebuild the CEP package and Windows installers with version 1.0.2. Update `implementation-report.md` with exact test outcomes, installed version and remaining native validation. Keep the original audit and archive the earlier prototype report so future contributors can recover the scope history.
