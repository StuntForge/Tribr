import { prisma } from "../db";

// 6.10 - recent ratings carry more weight; simple exponential decay.
const HALF_LIFE_DAYS = 180;
// 6.11 - a fixed-weight neutral seed damps volatility from the first few
// ratings. Its weight never decays, so its relative influence naturally
// shrinks as real (recency-weighted) history accumulates.
const SEED_WEIGHT = 3;
const SEED_SCORE = 3;

function eventWeight(createdAt: Date): number {
  const ageDays = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
  return Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
}

// Computes a user's Worker or Host rating from their *visible* rating
// events (6.7 - hidden until the cycle they belong to ends). Returns null
// until at least one real event exists, so brand new/untested users show
// as unrated rather than a seeded 3 stars nobody earned.
export async function computeCategoryRating(userId: string, type: "WORKER" | "HOST"): Promise<number | null> {
  const events = await prisma.ratingEvent.findMany({ where: { rateeId: userId, type, visible: true } });
  if (events.length === 0) return null;

  let weightedSum = SEED_WEIGHT * SEED_SCORE;
  let weightSum = SEED_WEIGHT;
  for (const e of events) {
    const score = (e.scoreA + e.scoreB + e.scoreC) / 3;
    const w = eventWeight(e.createdAt);
    weightedSum += w * score;
    weightSum += w;
  }
  return weightedSum / weightSum;
}

export interface RatingSummary {
  overallRating: number | null;
  workerRating: number | null;
  hostRating: number | null;
  completedCycles: number;
}

// 6.9 - overall rating is derived from both categories combined.
export async function computeRatingSummary(userId: string): Promise<RatingSummary> {
  const [workerRating, hostRating] = await Promise.all([
    computeCategoryRating(userId, "WORKER"),
    computeCategoryRating(userId, "HOST"),
  ]);

  const parts = [workerRating, hostRating].filter((r): r is number => r != null);
  const overallRating = parts.length > 0 ? parts.reduce((a, b) => a + b, 0) / parts.length : null;

  const completedTasks = await prisma.task.findMany({
    where: { ownerId: userId, status: "ARCHIVED", cycle: { completedAt: { not: null } } },
    select: { cycleId: true },
  });
  const completedCycles = new Set(completedTasks.map((t) => t.cycleId)).size;

  return { overallRating, workerRating, hostRating, completedCycles };
}

// 6.7 - hidden ratings become part of public reputation once the cycle
// they belong to ends (normal completion or dissolution).
export async function revealCycleRatings(cycleId: string) {
  await prisma.ratingEvent.updateMany({
    where: { task: { cycleId }, visible: false },
    data: { visible: true },
  });
}
