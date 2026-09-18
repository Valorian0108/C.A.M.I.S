# CAMIS

**Corporate Action Margin Impact Simulator**

CAMIS is a Bitget rToken margin workbench built for BitgetAI_HackathonS2. The idea is simple: if an rToken is used as collateral, a corporate action should not be treated like background information. It can change the numbers that decide whether a trader still has enough room in the account.

When a stock splits, pays a dividend, or goes through another corporate action, Bitget's rTokens can adjust automatically. For a normal holder, that adjustment may feel seamless. For a trader using the rToken as collateral, the same event can change collateral value, adjusted equity, leverage, margin ratio, and liquidation distance. CAMIS was built to make that change visible before the event settles.

## The Idea

The project started from one question:

> What happens to a leveraged account before a corporate action hits an rToken position?

Most traders can see the current price of an asset. They can also see their current account balance. The missing part is the consequence path. If an rToken is about to go through an adjustment, the trader needs to know what that event could do to the account, not after the fact, but early enough to decide whether to hold, add collateral, or reduce exposure.

CAMIS takes that problem and turns it into a readable margin simulation. It connects live Bitget market data, account data, collateral information, corporate action context, and AI explanation into one screen.

## What CAMIS Does

CAMIS lets a trader inspect an rToken event and see how it may affect a leveraged position.

It shows:

- the selected rToken and its live Bitget spot price;
- whether live data sources are working;
- the current account consequence before and after the event case;
- collateral value, adjusted equity, leverage, margin ratio, and liquidation distance;
- a comparison of three possible responses: hold, add collateral, or reduce exposure;
- a plain-language AI explanation of what changed and why it matters.

The goal is not to predict the future price of the asset. The goal is to show the trader how a known or modeled corporate action can flow through the account math.

## Why This Matters

An rToken can be easy to hold, but margin is not forgiving. A small change in collateral treatment can become important when the account is already using leverage. CAMIS focuses on that exact moment where the trader is not liquidated yet, but the buffer has changed.

That is the useful window. The trader still has time to respond.

## How It Works

CAMIS works in four layers.

1. **Live market layer**

   The app pulls live Bitget spot data for rToken pairs such as `RNVDAUSDT`, `RTSLAUSDT`, and `RQQQUSDT`. It also supports searching Bitget spot pairs, so the workbench is not locked to only three assets.

2. **Account layer**

   The backend reads the connected Bitget account through server-side API credentials. If the selected rToken exists in the account, CAMIS uses the live account asset balance in the consequence table. If the selected asset is not present, the app clearly shows that it is using scenario sizing instead.

3. **Simulation layer**

   The margin table calculates the before and after path from account inputs, live price, collateral assumptions, and the selected event case. This is deterministic math. The AI does not invent the numbers.

4. **Explanation layer**

   The AI receives the calculated before and after state, then turns it into a short explanation that a trader can understand. It explains what changed, whether the buffer improved or worsened, and what the selected action means.

## What The AI Does

AI in CAMIS is used as an explanation layer, not as the source of truth.

The AI does:

- explain the margin impact in plain language;
- summarize the difference between the before and after account state;
- describe the risk direction;
- help the user understand the selected action path.

The AI does not:

- execute trades;
- make private account changes;
- replace Bitget account data;
- decide the margin numbers on its own.

This separation is important because a trader should be able to trust where the numbers came from. CAMIS calculates first, then the AI explains.

## Current Build

The current build includes:

- live Bitget rToken spot prices;
- searchable Bitget spot pairs;
- live Bitget account asset checks;
- live collateral ratio checks from Bitget public data;
- corporate action lookup through Alpaca where available;
- AI analysis using Qwen when configured;
- visible live, fallback, and unavailable states;
- scenario controls for hold, add collateral, and reduce exposure;
- a judge demo path that shows whether the main live pieces are ready.

Some event cases are still modeled because corporate action timing and exact rToken treatment need reliable event-specific inputs. CAMIS labels those parts honestly instead of pretending that every event field is live.

## Tools Used

- **Bitget API and Bitget Agent Hub references** for rToken market data, account context, and collateral-related checks.
- **Qwen** for the AI explanation layer.
- **Alpaca corporate actions API** for corporate action lookup where matching records exist.
- **React and Vite** for the frontend.
- **Express and Node.js** for the backend API.
- **TypeScript** for shared types and safer implementation.
- **Vercel** for deployment.
- **Codex** for implementation support, debugging, and iteration.

## Running Locally

Install dependencies:

```bash
pnpm install
```

Start the API server:

```bash
pnpm --filter @workspace/api-server run dev
```

Start the frontend:

```bash
pnpm --filter @workspace/mockup-sandbox run dev
```

The frontend runs on:

```text
http://localhost:5173/
```

The API runs on:

```text
http://localhost:5000/api
```

## Environment Variables

The backend expects the live API keys to be configured in the hosting environment:

```text
BITGET_API_KEY
BITGET_API_SECRET
BITGET_PASSPHRASE
BITGET_BASE_URL
BITGET_QWEN_API_KEY
BITGET_QWEN_BASE_URL
BITGET_QWEN_MODEL
ALPACA_API_KEY
ALPACA_API_SECRET
```

Secrets should stay server-side. They should not be placed in frontend code.

## Vercel Deployment

This repository is configured for Vercel.

The frontend builds to:

```text
artifacts/mockup-sandbox/dist
```

The backend is exposed through a Vercel serverless catch-all under:

```text
/api/*
```

That means frontend requests such as `/api/market-data`, `/api/account-snapshot`, and `/api/margin-explanation` can work on the same deployed domain when the environment variables are configured.

## Project Direction

CAMIS is not trying to be another trading dashboard. It is focused on one risk that is easy to miss: what a corporate action does to a leveraged rToken account before the event is applied.

The next steps are to add more event templates, improve event-specific corporate action mapping, and make the search flow stronger for a larger set of Bitget-listed rTokens. The core idea stays the same: show the margin consequence early, explain it clearly, and help the trader decide before the account is under pressure.
