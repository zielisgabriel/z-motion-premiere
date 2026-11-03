# Transform Position keyframe write failure

Date: 2026-11-02. Patch version: 1.0.1.

## Reported behavior

The user tested the 1.0.0 panel in Premiere Pro 26.5.1 with an animated cursor image and two Position keys on the Transform effect. Pair discovery succeeded and the panel showed Transform / Position. Applying the Overshoot curve returned: "Premiere rejected intermediate key creation."

The screenshot showed a 0.5-second, 15-frame interval and curve coordinates [0.34, 1.56, 0.64, 1]. This was an application failure after discovery, rather than a missing selection or a graph interaction problem.

## Cause identified in the extension

The host treated only numeric zero or boolean true as a successful mutation result. A native method returning no value therefore caused immediate failure, before the extension checked whether the key existed. Mutation calls also passed Time objects exclusively, although Adobe's sample uses numeric seconds for key creation and value writes.

These are independently reproducible extension defects. They explain the observed rejection path under the tested API behaviors; the screenshot alone does not establish which return value the installed Premiere engine produced.

## Correction

- Prefer numeric seconds for native mutations and retain a verified Time-object fallback for hosts that require it.
- Discover the actual created key using getKeys, then read its stored value after writing. A successful-looking return from a no-op is rejected.
- Treat addKey exceptions as inconclusive until the key list is checked, since a native operation can commit before raising an exception.
- Remove a key introduced at an unintended time by the current creation attempt. Preserve keys that were already there.
- Reuse the verified time representation during the host session and when applying another curve to the remembered interval.
- Recheck all sampled values and original endpoint/neighbor values and times. Include the failed source time and native result in diagnostic errors.

Interpolation has no public getter in this integration, so its status still uses the supported void/zero/true return conventions. The extension does not claim to verify that metadata independently.

## Regression evidence

The original host failed the void-return and seconds-only Position cases before the correction. The expanded host suite has 16 passing boundary tests, including native rejection/clamping, stale snapshots, trimmed clip source times, repeat application, void and numeric results, Time-only hosts, misplaced-key cleanup, exceptions after creation and 30 fps 2D Position with Overshoot.

The 30 fps fixture writes 14 intermediate keys, retains both original endpoints and contains an overshoot value beyond the destination. Fixture readback does not certify that Premiere's renderer displays those values. The updated installer and real application must be distinguished from the automated Adobe API fixture.

## Native retest

Restore the original two-key interval if the previous failed attempt added keys. Install 1.0.1 with Premiere closed. Reopen the project, place the playhead between the original endpoints, load Transform / Position, inspect the preview and apply. Check the intermediate keys and actual playback, and reapply a different curve to the same remembered interval.

No automatic project save or native keyframe write was performed while preparing this patch. Live application and rendered playback remain pending a retest in Premiere.

## Primary API references

- [Adobe CEP sample Premiere type declarations](https://github.com/Adobe-CEP/Samples/blob/master/TypeScript/typings/PremierePro.11.1.2.d.ts): older declarations model ComponentParam mutations as void.
- [Adobe PProPanel sample](https://github.com/Adobe-CEP/Samples/blob/master/PProPanel/jsx/PPRO/Premiere.jsx): key creation/value examples use numeric seconds, and the linear interpolation constant is zero.

These references document the compatibility decisions; they are not a certification of all Premiere 26.x behavior.
