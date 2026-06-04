import { describe, it, expect } from "vitest";
import { activityRank, compareByActivity, type RankInput } from "./ranking";

describe("activity over taxonomy", () => {
  // Same discipline count (3). The activity-rich company reached that count by
  // being surfaced across 3 routes with 9 signals; the taxonomy-rich company got
  // there from a single suite-tool detection (NX) on one route, one signal.
  const activityRich: RankInput = { routeCount: 3, signalCount: 9, disciplineCount: 3 };
  const taxonomyRich: RankInput = { routeCount: 1, signalCount: 1, disciplineCount: 3 };

  it("a multi-route company outranks a single-route suite-tool company at equal discipline count", () => {
    expect(activityRank(activityRich)).toBeGreaterThan(activityRank(taxonomyRich));
  });

  it("discipline count alone does not lift the rank", () => {
    const oneRouteManyDisciplines: RankInput = { routeCount: 1, signalCount: 1, disciplineCount: 6 };
    const twoRoutesFewDisciplines: RankInput = { routeCount: 2, signalCount: 2, disciplineCount: 1 };
    expect(activityRank(twoRoutesFewDisciplines)).toBeGreaterThan(
      activityRank(oneRouteManyDisciplines)
    );
  });

  it("sorts activity-rich first", () => {
    expect([taxonomyRich, activityRich].sort(compareByActivity)[0]).toBe(activityRich);
  });
});
