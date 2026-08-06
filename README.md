# Project Exchange

A labour-exchange app: members trade work instead of money, built from the
functional design spec in `Spreading your load/Merged.pdf`.

## Structure

- `backend/` — Node/Express/Prisma API (SQLite locally, swap to Postgres for production)
- `mobile/` — React Native app (Expo), native iOS/Android

## Running it locally

**Backend**
```
cd backend
npm install
npm run prisma:migrate   # first time only, creates the local database
npm run seed              # first time only, adds job categories
npm run dev
```
Runs on http://localhost:4000. SMS verification is stubbed in development —
codes are logged to the console and `123456` always works, so you can test
the full app without a Twilio account.

**Mobile**
```
cd mobile
npm install
npx expo start
```
Scan the QR code with the Expo Go app (same Wi-Fi network as this computer).
Update `mobile/src/config.ts` with this computer's current LAN IP if it
changes.

## Accounts you'll need before going live

Nothing above requires any paid account. These become necessary later:

- **Twilio** (or similar) — real SMS verification codes
- **Apple Developer Program** ($99/yr) — testing on a physical iPhone beyond
  Expo Go, and App Store submission
- **Google Play Console** ($25 one-time) — Play Store submission
- **Stripe** — subscription billing
- A **Postgres hosting provider** (e.g. Supabase, Railway) — production database

## Build progress

See the project task list for the milestone plan. Milestone 1 (accounts,
profiles, phone verification) is complete.
