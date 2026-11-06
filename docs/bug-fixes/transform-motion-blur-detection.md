# Transform motion blur detection

Date: 2026-11-05. Fix: 1.1.2.

## Reproduction and evidence

The user's Premiere 26.5.1 screenshot shows a selected `mouse-arrow.png` clip with an existing Transform effect, animated Position, Use Composition's Shutter Angle enabled and Shutter Angle at zero. The playhead is after the movement keys. Z Motion 1.1.1 incorrectly says to add Transform and disables Apply blur.

A read-only inspection of the saved Premiere project confirmed the effect's match name is `AE.ADBE Geometry2`, with 12 parameters. Version 1.1.1 accepted only `AE.ADBE Geometry` / `ADBE Geometry`, rejecting the effect before its shutter controls were inspected. [A firsthand report on Adobe's community](https://community.adobe.com/questions-729/about-two-transform-effects-1389931) also identifies both Transform match names through `clip.components`.

## Correction

Detection now accepts Geometry and Geometry2, with or without the AE prefix, while retaining parameter-name, value, animation-state and known-layout validation. An unsupported effect named Transform produces a version diagnostic instead of incorrectly claiming the effect is absent.

Blur discovery and application use a selected-clip context separate from curve discovery. They do not require a keyframe pair, a readable playhead, forward playback or 100% speed. A failure to inspect curves leaves supported blur settings available. The mutation changes only the two static shutter controls on the selected Transform and still verifies readback and attempts rollback on failure.

The panel displays the clip name, provides Refresh clip and labels the action Apply blur to clip. Curve-only guidance is explicitly prefixed with Curves. The blur setting affects the entire Transform instance; it creates no movement keys and does not convert native Motion animation. Visible blur still requires movement within Transform.

## Validation boundary

Before the fix, regression tests reproduced the missing Geometry2 target and coupling to curve playback/playhead requirements. After the fix, the host tests cover both Transform versions, a cursor after the movement pair, unchanged movement keys, retimed and reversed clips, and an unavailable playhead. React and browser checks cover clip identification, refresh and applying/off with no curve target.

The supplied project was read, never modified or saved. Live Premiere automation could not initialize (`failed to write kernel assets: The system cannot find the path specified. (os error 3)`). The agent therefore did not independently verify native application or rendered playback. The user subsequently approved 1.1.2 and requested GitHub publication. Fixture success and static project evidence do not certify Premiere rendering.
