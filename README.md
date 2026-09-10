# MARGIN//EVENT

MARGIN//EVENT is a pre-event consequence simulator for leveraged rToken traders. It helps a trader understand how a corporate action may change collateral representation, leverage, margin buffer, and liquidation distance before settlement.

## Current status

The repository currently contains a responsive UI prototype in the mockup sandbox. It uses simulated data and demonstrates the intended AI Trading Desk workflow:

1. Select an upcoming rToken corporate action.
2. Inspect the event, evidence trail, and countdown.
3. Compare account state before and after the event.
4. Compare responses such as holding, adding collateral, or reducing exposure.
5. Read a plain-language explanation of the calculated consequence.

The prototype is not connected to live Bitget data, a user account, trading execution, or Qwen yet. The next implementation phase will turn the prototype into a runnable demo with a deterministic calculation layer and Qwen as the explanation and research layer.

## Hackathon alignment

- **Main track:** AI Trading Desk
- **Recommended sub-theme:** Personalized Research Workbench
- **Secondary fit:** Decision Stress Testing
- **Core thesis:** rTokens trade continuously while corporate actions and macro events can arrive outside traditional market hours. Traders need to see the margin consequence before the event settles.

### Qwen's planned role

Qwen will act as a research copilot. It will:

- interpret a trader's question about an upcoming event;
- summarize event evidence;
- explain deterministic margin-impact results;
- surface uncertainty and missing information;
- compare possible responses.

Qwen will not be the source of numerical truth, calculate margin independently, or execute trades. The simulator will calculate the financial outputs first, then Qwen will make them understandable and actionable.

## Current prototype

The main mockup lives at:

`artifacts/mockup-sandbox/src/components/mockups/margin-event/Desk.tsx`

Its sibling styles are in:

`artifacts/mockup-sandbox/src/components/mockups/margin-event/_group.css`

The current demo includes:

- rNVDA, rTSLA, and rQQQ event selection;
- an rNVDA reverse split / adjustment scenario;
- collateral, leverage, liquidation-distance, and collateral-ratio comparison;
- event countdown and evidence timeline;
- scenario comparison;
- command/search affordance;
- responsive desktop and mobile layouts;
- visible focus states and reduced-motion support.

## Running the current prototype

From the repository root:

```bash
pnpm install
pnpm --filter @workspace/mockup-sandbox run dev
```

Useful checks:

```bash
pnpm run typecheck
pnpm run build
```

## Planned implementation phases

### Phase 1 — Runnable demo

- Graduate the mockup into an accessible application route.
- Add local event and account fixtures.
- Implement deterministic before/after margin calculations.
- Add the Qwen research response flow.
- Show one complete question-to-actionable-insight demo.

### Phase 2 — Real data

- Add server-side Bitget account and market data access.
- Add corporate-action event data.
- Replace fixtures with validated data.
- Keep API credentials server-side and out of the frontend.

### Phase 3 — Product hardening

- Add authentication and account consent.
- Add data freshness and uncertainty states.
- Add test coverage for event and margin rules.
- Produce the final demo, documentation, and hackathon submission materials.

## Documentation

- [`PROGRESS.md`](./PROGRESS.md) — implementation history and the result of each push.
- [`replit.md`](./replit.md) — workspace guidance and project conventions.
- [`attached_assets/Pasted--Base-Camp-Hackathon-S2-EN-When-tokenized-US-stocks-mak_1789011891049.txt`](./attached_assets/Pasted--Base-Camp-Hackathon-S2-EN-When-tokenized-US-stocks-mak_1789011891049.txt) — hackathon brief used for the track and submission alignment.

## Security note

Never commit the Qwen API key or any Bitget credential. Store secrets in the workspace secret manager and access them only from server-side code.