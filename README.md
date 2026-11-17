# Poker Ledger

Poker Ledger keeps track of home poker games: who bought in, how many chips they finished with, who owes whom, and how to settle up. It also includes two poker calculators for working out odds during a hand.

**Live app:** <!-- LIVE_URL: add the deployed link here -->

## Contents

- [What it does](#what-it-does)
- [Pages](#pages)
- [How the money works](#how-the-money-works)
- [Hand calculator](#hand-calculator)
- [Architecture](#architecture)
- [Data and privacy](#data-and-privacy)
- [Getting started](#getting-started)
- [Scripts](#scripts)
- [Testing](#testing)
- [Project layout](#project-layout)
- [Deployment](#deployment)
- [Known limits](#known-limits)

## What it does

A game moves through a simple lifecycle:

1. **Create** a game with a name, date, currency, venue, standard buy-in, chips per buy-in, game variants and blinds.
2. **Add players.** Players are reusable profiles, so a regular only needs to be entered once.
3. **Buy in.** Each buy-in records money paid and chips received. Standard buy-ins are one tap; custom amounts and rebuys are supported.
4. **Count chips.** At the end of the night, enter each player's final chip count.
5. **Settle.** The app checks that chips and money balance, then works out the smallest set of payments that clears every balance.
6. **Track payments.** Mark each payment as paid, optionally with a UPI reference or a note.
7. **Archive or correct.** Settled games can be archived. A correction unlocks the game, and the old settlement is kept as superseded, so there is always a record of what changed.

Amounts are stored as whole paise (1 INR = 100 paise), so rounding never drifts. Money is never converted between currencies: each game uses one currency.

## Pages

| Route | Purpose |
| --- | --- |
| `/` | Dashboard: active and recent games. |
| `/chip-board` | The live game: buy-ins, final chips, and running totals for each player. |
| `/games/new` | Create a game. The default currency comes from the device's timezone unless you set one. |
| `/settlement` | Balances, the payments needed to settle, and payment tracking. |
| `/history` and `/history/[id]` | Past games and their details, with CSV export and a WhatsApp-ready summary. |
| `/players/[id]` | A player's results across games. |
| `/settings` | Currency (auto-detected or manual), default buy-in, chips per buy-in, and default blinds. |
| `/calculator` | Pot odds and equity for two hands on a board. |
| `/hand-calculator` | A table-based calculator for seats, hole cards, runouts and outs. See [Hand calculator](#hand-calculator). |

The app has a light and a dark theme.

## How the money works

- **Net per player** = chip value at the end of the game minus money invested.
- **Chip value** = final chips multiplied by the game's rate (buy-in divided by chips per buy-in). The rate is never rounded before the calculation, so chip values are exact.
- **Settlement** pairs the largest debtors with the largest creditors until every balance is zero. This keeps the number of payments low.
- **Unbalanced chips.** If the chip counts don't add up to the money put in, settlement warns about the difference. You choose how to handle it: the winners absorb it, or it is split evenly. The adjustment is stored with the settlement, so the history stays accurate.
- **Payments** have a paid flag, paid time, UPI reference and note. Changing a settled game requires an explicit unlock with a reason.

## Hand calculator

The hand calculator works out win, tie, loss and equity for every player at a table.

- **Seats.** Add or remove players and assign them from your ledger, or enter an unnamed seat.
- **Cards.** Fill hole cards for each seat and the shared board from a card picker. Placed cards are greyed out elsewhere, showing where each one is.
- **Games.** Texas Hold'em (two hole cards) or Omaha (four hole cards, exactly two used with three from the board).
- **Runouts.** Once the flop is in, you can view one, two or three runouts. Multi-runout views also show an overall average.
- **Outs.** For a player who is behind, the app lists the cards that would move them ahead, with card images next to the player.
- **Partial information.** Seats without all their cards are treated as unknown. The app deals the missing cards at random, so the figures are estimates in that case.
- **Method.** The footer says whether the numbers are exact (every possible deal checked) or from a Monte Carlo simulation, and how many random deals were used.

Calculations run in a Web Worker, so the page stays responsive. A small number of cards to come is enumerated exactly. Otherwise the calculator runs a sample of random deals, scaled to the number of unknown cards.

The equity panel keeps the last numbers on screen while a new result is calculating, so it doesn't jump around as you add cards.

## Architecture

- **Framework:** Next.js 16 (App Router) with React 19 and TypeScript.
- **Styling:** Tailwind CSS 4, with colours defined as tokens for light and dark themes.
- **State:** a single reducer (`lib/state/reducer.ts`) provided through a context. Each action is recorded in an audit log.
- **Persistence:** the whole ledger is saved to browser localStorage under `poker-ledger:v1`. It is loaded through a zod schema, so corrupted data can't crash the app, and older saves are migrated when they load.
- **Validation:** zod schemas for forms and for stored data (`lib/validation/schemas.ts`).
- **Calculations:** pure functions in `lib/calculations/` and `lib/poker/`. They have no UI dependencies, so they are easy to test.
- **Icons:** lucide-react.

## Data and privacy

- All game data stays in the browser that created it. Nothing is sent to a server by the app itself.
- Clearing site data, using a private window, or switching devices means the data isn't there. CSV export covers history; a full JSON backup and restore is not built yet.
- Player names are capitalised automatically (for example, "alex" is saved as "Alex").

## Getting started

### Requirements

- Node.js 20.9 or newer (required by Next.js 16)
- npm (the project includes `package-lock.json`)

### Run it locally

```bash
git clone https://github.com/asfrosche/poker-ledger.git
cd poker-ledger
npm install
npm run dev
```

Open http://localhost:3000 in your browser. Edits to files reload automatically.

To check the project before pushing:

```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the development server. |
| `npm run build` | Create a production build. |
| `npm start` | Serve the production build. Run `npm run build` first. |
| `npm run lint` | Run ESLint. |
| `npm test` | Run the test suite once. |
| `npm run test:watch` | Run tests in watch mode. |

## Testing

Tests use Vitest and live next to the code they cover, in `lib/**/*.test.ts`. They cover:

- money parsing and formatting, and currency detection
- settlement, balances and adjustments
- the reducer and ledger migration
- poker hand evaluation (Hold'em and Omaha), equity and outs
- the hand-table state and its calculations

## Project layout

```
app/                 Routes (App Router pages and layout)
components/          UI: app shell, chip board, settlement, history, settings, hand calculator
lib/
  calculations/      Ledger, settlement and adjustment maths
  currency.ts        Currency list, timezone mapping, detection
  money.ts           Paise parsing and formatting
  poker/             Cards, hand evaluation, equity and pot odds
  hand-table/        Hand calculator state, simulation, outs and labels
  state/             Reducer, context and storage
  validation/        zod schemas
types/               Shared domain types
public/              Static assets
```

## Deployment

Poker Ledger is a standard Next.js app and can be deployed to any host that runs Next.js, such as Vercel. The repository has no deployment configuration file, so the host's settings (build command `npm run build`, output handled by Next.js) are set in the host's dashboard.

Because data lives in each browser, a deployment has no shared database to configure.

## Known limits

- **Single browser.** Data isn't synced between devices. Use backups to move data around.
- **No sign-in.** Anyone with the link can open the app, and data is stored only in the browser of whoever uses it.
- **Game variants are labels only.** The game variant list (for example Stud, Hi-Lo, Short Deck) is recorded for reference. Only Hold'em and Omaha are calculated in the hand calculator.
- **Hand calculator and phones.** Seat placement and the full five-card board are tightest on very narrow screens (around 320px).
