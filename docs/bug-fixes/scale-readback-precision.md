# Scale native value-readback precision

Date: 2026-11-02. Patch version: 1.0.2.

## User evidence

The user confirmed that Position works after installing 1.0.1. Scale application returned:

> Premiere did not preserve the generated value at 3600.83333333333s. Native result: true. Some intermediate keys may have changed. Use Premiere Undo before retrying.

This identifies the failure stage as value readback after key creation. The 1.0.1 message did not include requested or stored values, so the exact discrepancy in the user's Premiere instance was not captured. The component containing Scale was not specified. Avoid claiming that a native storage format was measured from this error alone.

## Reproduced defect

The old comparison required abs(actual - expected) <= max(0.0000001, abs(expected) * 0.00000001). It was shared by strict mathematical validation and native readback. This rejects otherwise valid scalar values rounded by lower-precision storage.

A 30 fps fixture with endpoints at 3600.8 and 3601.3 source seconds, Scale 0 to 200, numeric-second mutations and true native returns reproduced the rejection. Its first requested key is at the reported 3600.83333333333 source seconds. The first generated scalar rounds to 13.333333015441895 in float32 storage. The original 1.0.1 host failed this regression; the corrected host passed it.

Float32 and 16.16 fixed-point storage are compatibility models tested at the Adobe boundary, not claims about a measured internal Premiere representation. Rounding is the reproduced candidate explanation for the user's error. Native confirmation remains necessary.

## Change

- Separate generated scalar storage comparison from strict curve-plan validation and preservation checks.
- Accept generated finite scalar readback only when abs(actual - expected) <= max(0.00001, abs(expected) * 0.0000001). At Scale 100 this is 0.00001 percentage points; at Scale 10000 it is 0.001 percentage points.
- Apply that comparison both immediately after writing and during final generated-sample verification.
- Keep the previous strict comparison for original endpoints, neighboring keys, 2D Position values and mathematical plan validation.
- Retain readback verification regardless of a true/zero/void native result. A larger mismatch or no-op is still rejected.
- Include Requested and Stored values with source time and native result when readback fails. This permits diagnosis without inferring the discrepancy from a success flag.

No domain samples, preview frames, mutation time arguments, dependencies, endpoint values or endpoint times were changed. The accepted native scalar storage rounding is documented in the v1 decision and README.

## Regression checks

The host suite now has 22 passing tests. New cases cover one-hour source time with 30 fps scalar rounding, large Scale values, fixed-point rounding with Overshoot and reapplication, a 0.001-unit wrong value despite true native status, a no-op write despite true status and strict protection of an endpoint changed by only 0.000005. Existing 2D Position and native-failure cases remain in the suite.

The broader checks and final installer verification are recorded in docs/implementation-report.md and release/verification-1.0.2.json after release validation. Adobe fixtures and browser checks do not execute Premiere's renderer.

## Native continuation

With Premiere closed, install 1.0.2. Restore the intended original pair if the failed attempt left intermediate keys. Load Scale around the playhead, review the graph and preview, apply and verify actual playback. Reapply a second curve. If rejection remains, preserve the complete new error including Requested and Stored values; that evidence can distinguish storage rounding from clamping, time mismatch or another native failure.

The user's project is never saved automatically. No live writes were performed by the agent while preparing this patch.
