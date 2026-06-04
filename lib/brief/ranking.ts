// Activity over taxonomy. A prospect's rank is driven by ACTIVITY (how many
// discovery routes surfaced it, then signal volume), NOT by raw discipline count.
// A suite tool like NX expands to many disciplines via the catalog, but that is a
// single taxonomy fact, not verified activity, so it must not outrank a company
// genuinely active across routes. disciplineCount is carried for display only and
// is deliberately absent from the rank.

export interface RankInput {
  routeCount: number;
  signalCount: number;
  disciplineCount: number; // display only, NOT a rank term
}

// Higher is hotter. routeCount dominates (each route is an independent surfacing),
// signalCount breaks ties. disciplineCount does not appear.
export function activityRank(c: RankInput): number {
  return c.routeCount * 1000 + c.signalCount;
}

export function compareByActivity(a: RankInput, b: RankInput): number {
  return activityRank(b) - activityRank(a);
}
