# Tribr

A labour-exchange app: members trade work instead of money, built from the
functional design spec in `Spreading your load/Merged.pdf`.

## Structure

- `backend/` — Node/Express/Prisma API (SQLite locally, swap to Postgres for production)
- `mobile/` — React Native app (Expo), native iOS/Android
- `admin/` — React admin portal (separate web app, per spec 8.11)

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

**Admin portal**
```
cd backend && npm run seed:admin   # first time only, creates the login below
cd admin
npm install
npm run dev
```
Runs on http://localhost:5173. Default login is `admin@example.com` /
`changeme123` — change `ADMIN_EMAIL`/`ADMIN_PASSWORD` in `backend/.env` and
re-run `seed:admin` to set your own.

## Billing (Stripe, test mode)

```
cd backend
npm run stripe:setup   # once STRIPE_SECRET_KEY is set, creates the price
```
Add your Stripe **test-mode** keys (`sk_test_.../pk_test_...`) to
`backend/.env` first — see the comments there. Subscribing/cancelling then
works for free indefinitely with Stripe's test card `4242 4242 4242 4242`
(any future expiry, any CVC). A dev-only toggle also exists in the app for
switching plans instantly without going through Stripe at all.

## Accounts you'll need before going live

Nothing above requires any paid account (Stripe test mode is free). These
become necessary later:

- **Twilio** (or similar) — real SMS verification codes
- **Apple Developer Program** ($99/yr) — testing on a physical iPhone beyond
  Expo Go, and App Store submission
- **Google Play Console** ($25 one-time) — Play Store submission
- **Stripe live mode** — only once you're ready to charge real customers;
  switch `sk_test_`/`pk_test_` keys to `sk_live_`/`pk_live_` deliberately
- A **Postgres hosting provider** (e.g. Supabase, Railway) — production database

## Build progress

See the project task list for the milestone plan. Milestones 1-6 (accounts,
tasks, groups, scheduling/chat, ratings, search/invitations) are complete.
Milestone 7 (subscriptions & admin portal) is in progress.
