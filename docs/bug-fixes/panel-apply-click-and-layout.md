# Blocked Apply click and panel layout

Date: 2026-11-18. Fix: 1.2.0.

## Reproduction and evidence

The user reported that, after choosing two keyframes, **Apply animation** sometimes stayed blocked and the curve could not be applied. They always use a small panel.

Reproduced in the browser with a simulated `__adobe_cep__` host:

- The panel reloads the Premiere selection when the pointer or focus enters it. That reload set a shared `pending` flag which disabled every control and relabelled the button **Working in Premiere…**. A click coming from Premiere focuses the panel first, so the reload disabled the button between `mousedown` and `click`: the click was swallowed. Each new click started a new reload, so the button could never be clicked unless focus was already inside the panel (for example after clicking a preset). **Apply blur to clip** had the same defect.
- The reason a disabled Apply button was disabled lived under the motion preview, scrolled out of view in a small panel.
- At the manifest minimum (280×400) `.workspace` had `min-height: 420px`, so the page scrolled 20px and the footer was cut off.
- The preview Z travelled ±70px while the guide spans 74% of the stage (±133px at 400px), so it never reached the guide ticks. Vertical Position moves of ±45px overflowed the 94px stage.
- Smaller inconsistencies: **Motion blur** was not uppercase like **Curves**; the Curves heading disappeared when the property selector appeared; the status dot stayed grey while connected; hovering the active preset hid its red state; long clip names wrapped mid-word; motion blur results appeared under Apply animation instead of in the blur section.

## Correction

- Reloading is silent: it no longer disables controls or changes the Apply label. Only Premiere writes do. A write waits for a reload already in flight and proceeds only if Premiere still reports the item the user saw; otherwise it explains that the selection changed.
- The line above Apply shows the latest curve result or, when there is none, why Apply is unavailable (choose a property, place the playhead, open in Premiere). It is the button's accessible description.
- Motion blur results and errors are shown inside the Motion blur section.
- The preview geometry is a pure function (`src/presentation/preview-frames.ts`) driven by the measured stage. The Z starts and ends on the guide ticks at any width and stays inside the stage vertically. The guide width comes from the same constant. (Later the same day the user asked to remove the motion preview entirely; this module and its tests were deleted.)
- Short panels (≤560px tall) use tighter spacing and a smaller graph and preview, without larger type. The footer hides at ≤480px. The workspace no longer exceeds the manifest minimum.
- Headings, status dot, active preset hover, clip-name ellipsis (full name in the tooltip), explicit native select colours, tabular numerals and `:focus-visible` on graph handles follow the Web Interface Guidelines review.

## Validation boundary

Each behaviour was first reproduced by a failing test, then fixed:

- Unit: `src/presentation/preview-frames.test.ts` (guide ticks, vertical bounds, property kinds, keyframe offsets), removed with the preview.
- Component: `src/app.test.tsx` (click that starts a reload still applies once, silent reload, lost pair, blur on reload, blur feedback placement, Apply description, heading persistence, clip-name tooltip).
- Browser: `tests/browser/panel.spec.ts` (no page scroll at 280×400 and 400×750, Z on the guide ticks at 280/400/1100px, vertical preview inside the stage, one click from outside the panel applies once, blur result in its section). The click test was confirmed to fail against the previous `app.tsx`.

These run against a simulated host. Native application in Premiere was not verified by the agent.
