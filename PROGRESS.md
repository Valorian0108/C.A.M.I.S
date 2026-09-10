# MARGIN//EVENT progress

This file records the implementation state for each implementation push. Each entry should describe what changed, how it was checked, and what comes next.

## 2026-09-10 — Deterministic event model

### Completed

- Added a local simulator model for corporate-action events.
- Moved the rNVDA before/after values into explicit fixture data.
- Added deterministic delta calculation and shared number formatting.
- Connected the selected event to the hero, consequence table, ratio panel, evidence trail, and scenario comparison.
- Made queued rTSLA and rQQQ events show an honest not-modeled state instead of reusing rNVDA numbers.
- Preserved the existing MARGIN//EVENT visual direction and responsive behavior.

### Verification

- Mockup sandbox typecheck passed.
- Production build passed with the required preview environment values.
- Preview workflow restarted successfully.
- Desktop and mobile screenshots rendered without browser console errors.

### Next

1. Graduate the demo into a shareable application route.
2. Add a server-side Qwen explanation flow over the deterministic simulator output.
3. Replace the rNVDA fixture with validated event and account inputs.

## 2026-09-10 — Documentation and hackathon alignment

### Completed

- Added the project overview and product thesis.
- Documented the current AI Trading Desk positioning.
- Selected Personalized Research Workbench as the strongest current sub-theme fit.
- Defined Qwen as a research and explanation layer rather than the numerical risk engine.
- Documented the current mockup location, run commands, security boundary, and implementation phases.
- Added this progress log for future implementation pushes.

### Current product state

- The MARGIN//EVENT interface is implemented as a responsive mockup.
- The interface uses simulated event and account data.
- The UI has been visually checked at desktop, tablet, and narrow mobile widths.
- The runnable application, deterministic calculation service, live data connection, and Qwen runtime integration are still pending.

### Next

1. Confirm the available Qwen API connection and model configuration without exposing the key.
2. Graduate the mockup into a runnable application route.
3. Add a deterministic simulator for the rNVDA event flow.
4. Add Qwen-generated explanation over the simulator output.
5. Produce the complete question-to-actionable-insight demo required by the AI Trading Desk track.