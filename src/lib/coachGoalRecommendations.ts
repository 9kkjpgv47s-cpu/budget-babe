import { formatCents } from "@/lib/money";

export type GoalsCoachSnapshot = {
  goalCount: number;
  totalSavedCents: number;
  totalTargetCents: number;
  nearestGoalTitle: string | null;
  nearestRemainingCents: number | null;
};

export function snapshotGoalsForCoach(
  goals: {
    title: string;
    targetAmountCents: number;
    savedAmountCents: number;
  }[],
): GoalsCoachSnapshot {
  if (goals.length === 0) {
    return {
      goalCount: 0,
      totalSavedCents: 0,
      totalTargetCents: 0,
      nearestGoalTitle: null,
      nearestRemainingCents: null,
    };
  }

  let nearestTitle: string | null = null;
  let nearestRemaining: number | null = null;

  for (const g of goals) {
    const remaining = g.targetAmountCents - g.savedAmountCents;
    if (remaining <= 0) continue;
    if (nearestRemaining == null || remaining < nearestRemaining) {
      nearestRemaining = remaining;
      nearestTitle = g.title;
    }
  }

  return {
    goalCount: goals.length,
    totalSavedCents: goals.reduce((s, g) => s + g.savedAmountCents, 0),
    totalTargetCents: goals.reduce((s, g) => s + g.targetAmountCents, 0),
    nearestGoalTitle: nearestTitle,
    nearestRemainingCents: nearestRemaining,
  };
}

/** Coach ↔ goals integration copy (Agent 4). */
export function buildGoalsCoachRecommendations(
  coachMonthlySaveCents: number,
  payPeriodsPerMonth: number,
  goals: GoalsCoachSnapshot,
): string[] {
  const recs: string[] = [];

  if (coachMonthlySaveCents <= 0) return recs;

  if (goals.goalCount === 0) {
    recs.push(
      `You have no savings goals yet. If you add targets on Goals, compare them to this month's coach save target (${formatCents(coachMonthlySaveCents)} across ${payPeriodsPerMonth} paycheck${payPeriodsPerMonth === 1 ? "" : "s"}) and update saved amounts when you actually move money.`,
    );
    return recs;
  }

  recs.push(
    `Coach targets ${formatCents(coachMonthlySaveCents)} saved this month (${payPeriodsPerMonth} check${payPeriodsPerMonth === 1 ? "" : "s"}). Goals show ${formatCents(goals.totalSavedCents)} saved manually toward ${formatCents(goals.totalTargetCents)} total — those numbers do not sync automatically.`,
  );

  if (
    goals.nearestGoalTitle != null &&
    goals.nearestRemainingCents != null &&
    goals.nearestRemainingCents > 0
  ) {
    const months = Math.ceil(
      goals.nearestRemainingCents / coachMonthlySaveCents,
    );
    recs.push(
      `Closest open goal "${goals.nearestGoalTitle}" needs ${formatCents(goals.nearestRemainingCents)}. At this month's coach pace that's roughly ${months} month${months === 1 ? "" : "s"} — bump saved on Goals when you transfer, not when you only plan to save.`,
    );
  }

  return recs;
}
