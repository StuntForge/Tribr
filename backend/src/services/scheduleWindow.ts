export const PROPOSAL_WINDOW_DAYS = 14;

export function dayString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Compared as whole calendar days (not exact timestamps) so the window the
// leader/owner sees on the calendar and the window the server accepts always
// agree - no picking a date the UI allowed and then getting rejected on
// submit. Anchored to when the window opened (task activation, or a Social
// Tribe's start), not "today".
export function withinProposalWindow(date: Date, anchor: Date): boolean {
  const targetDay = dayString(date);
  const anchorDay = dayString(anchor);
  const maxDay = dayString(new Date(anchor.getTime() + PROPOSAL_WINDOW_DAYS * 24 * 60 * 60 * 1000));
  return targetDay >= anchorDay && targetDay <= maxDay;
}
