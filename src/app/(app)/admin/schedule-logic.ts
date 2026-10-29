import { cellKey, MAX_SHIFTS_PER_WEEK, SHIFTS } from "@/lib/schedule";

// Pure scheduling rules shared by the editor; no React, so they're easy to
// test. All maps are keyed by cellKey() ("YYYY-MM-DD|shift").

export type Assignments = Record<string, string | null>;

export type RankedCandidate = {
  id: string;
  // 1 = submitted first for this shift.
  submissionRank: number;
  // Shifts this week, not counting this one.
  otherShifts: number;
  // At the weekly cap, so assigning this shift would exceed it.
  capped: boolean;
  // Already on another shift the same day.
  busyToday: boolean;
  // Worked this exact Friday/Saturday shift last week.
  repeatWeekend: boolean;
};

// Weekend shifts of this week mapped to who worked the same shift (same
// weekday and shift type) the week before.
export type LastWeekend = Record<string, string>;

export function countShifts(assignments: Assignments) {
  const counts = new Map<string, number>();
  for (const employeeId of Object.values(assignments)) {
    if (employeeId) counts.set(employeeId, (counts.get(employeeId) ?? 0) + 1);
  }
  return counts;
}

function busyOnDate(assignments: Assignments, key: string) {
  const [date, current] = key.split("|");
  return new Set(
    SHIFTS.filter((shift) => shift.type !== current)
      .map((shift) => assignments[cellKey(date, shift.type)])
      .filter((id): id is string => Boolean(id)),
  );
}

// Orders the employees available for a shift: fewest shifts this week
// first, then first to submit. Counts exclude the shift itself, so the
// person currently in it isn't penalized for holding it.
export function rankCandidates(
  key: string,
  queue: string[],
  assignments: Assignments,
  counts: Map<string, number>,
  lastWeekend: LastWeekend = {},
): RankedCandidate[] {
  const busy = busyOnDate(assignments, key);
  return queue
    .map((id, index) => {
      const otherShifts = (counts.get(id) ?? 0) - (assignments[key] === id ? 1 : 0);
      return {
        id,
        submissionRank: index + 1,
        otherShifts,
        capped: otherShifts >= MAX_SHIFTS_PER_WEEK,
        busyToday: busy.has(id),
        repeatWeekend: lastWeekend[key] === id,
      };
    })
    .sort(
      (a, b) =>
        a.otherShifts - b.otherShifts || a.submissionRank - b.submissionRank,
    );
}

// True when the assigned employee would be on their 5th+ shift while an
// eligible candidate with fewer shifts could take it instead.
export function hasFairerCandidate(
  ranked: RankedCandidate[],
  assignedId: string | null,
  warnFromShift: number,
) {
  if (!assignedId) return false;
  const assigned = ranked.find((c) => c.id === assignedId);
  if (!assigned || assigned.otherShifts + 1 < warnFromShift) return false;
  return ranked.some(
    (c) =>
      c.id !== assignedId &&
      !c.capped &&
      !c.busyToday &&
      !c.repeatWeekend &&
      c.otherShifts < assigned.otherShifts,
  );
}

// Pre-fills open, upcoming shifts. "Open" means no saved row: a shift the
// admin saved as unassigned stays empty. Each pick goes to the best-ranked
// candidate (fewest shifts, then first to submit) who is under the weekly
// cap and didn't work this same weekend shift last week (never relaxed),
// preferring someone not already working that day; if everyone left is
// working that day, the best-ranked one is used and the editor flags it.
export function buildSuggestions(
  dates: string[],
  today: string,
  initial: Assignments,
  queues: Record<string, string[]>,
  lastWeekend: LastWeekend = {},
) {
  const assignments: Assignments = { ...initial };
  const suggested = new Set<string>();
  const counts = countShifts(assignments);

  for (const date of dates) {
    if (date < today) continue;
    for (const shift of SHIFTS) {
      const key = cellKey(date, shift.type);
      if (key in initial) continue;

      const eligible = rankCandidates(key, queues[key] ?? [], assignments, counts, lastWeekend)
        .filter((c) => !c.capped && !c.repeatWeekend);
      const pick = eligible.find((c) => !c.busyToday) ?? eligible[0];
      if (!pick) continue;

      assignments[key] = pick.id;
      suggested.add(key);
      counts.set(pick.id, (counts.get(pick.id) ?? 0) + 1);
    }
  }

  return { assignments, suggested };
}
