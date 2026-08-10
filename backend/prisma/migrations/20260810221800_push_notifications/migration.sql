-- AlterTable
-- Push notification support: Expo push token, IANA timezone (for the daily
-- midday digest), and a dedup guard so the digest never double-sends on the
-- same local day.
ALTER TABLE "User" ADD COLUMN "expoPushToken" TEXT;
ALTER TABLE "User" ADD COLUMN "timezone" TEXT;
ALTER TABLE "User" ADD COLUMN "lastDigestSentAt" TIMESTAMP(3);
