import { prisma } from "../db";

export interface SocialReliability {
  attended: number;
  noShows: number;
  validReasons: number;
  // null (shown as "Social Reliability: New") until there's at least one
  // Attended/No Show outcome to base a percentage on - Valid Reason alone
  // doesn't count as qualifying history, matching how it's excluded from
  // the ratio itself.
  percentage: number | null;
}

// Deliberately not recency-weighted or seeded like computeRatingSummary's
// star rating (backend/src/services/ratings.ts) - the spec's formula is
// exact and literal: Attended / (Attended + No Shows) x 100, Valid Reason
// excluded from both sides entirely. Compute-on-read from raw
// SocialAttendance rows, same pattern as the ratings service.
export async function computeSocialReliability(userId: string): Promise<SocialReliability> {
  const events = await prisma.socialAttendance.findMany({ where: { userId } });

  const attended = events.filter((e) => e.outcome === "ATTENDED").length;
  const noShows = events.filter((e) => e.outcome === "NO_SHOW").length;
  const validReasons = events.filter((e) => e.outcome === "VALID_REASON").length;

  const denominator = attended + noShows;
  const percentage = denominator === 0 ? null : Math.round((attended / denominator) * 100);

  return { attended, noShows, validReasons, percentage };
}
