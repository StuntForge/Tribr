export type JobLength = "FEW_HOURS" | "HALF_DAY" | "FULL_DAY";

export const JOB_LENGTHS: JobLength[] = ["FEW_HOURS", "HALF_DAY", "FULL_DAY"];

export const JOB_LENGTH_RANK: Record<JobLength, number> = { FEW_HOURS: 0, HALF_DAY: 1, FULL_DAY: 2 };

export const JOB_LENGTH_LABELS: Record<JobLength, string> = {
  FEW_HOURS: "A few hours",
  HALF_DAY: "Half a day",
  FULL_DAY: "A full day",
};

export const JOB_LENGTH_LABELS_SHORT: Record<JobLength, string> = {
  FEW_HOURS: "Few hours",
  HALF_DAY: "Half day",
  FULL_DAY: "Full day",
};

export function jobLengthLabel(value: string | null | undefined): string {
  return value && value in JOB_LENGTH_LABELS ? JOB_LENGTH_LABELS[value as JobLength] : "Length not set";
}

export function jobLengthLabelShort(value: string | null | undefined): string {
  return value && value in JOB_LENGTH_LABELS_SHORT ? JOB_LENGTH_LABELS_SHORT[value as JobLength] : "—";
}
