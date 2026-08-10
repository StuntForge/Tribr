-- AlterTable
-- Estimated man hours is replaced by a coarse job-length band
-- (FEW_HOURS | HALF_DAY | FULL_DAY). Nullable so existing tasks don't need
-- a backfill; estimatedManHours is left in place (unused going forward)
-- rather than dropped, to avoid any data loss on this pass.
ALTER TABLE "Task" ADD COLUMN "jobLength" TEXT;
