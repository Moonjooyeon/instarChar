import assert from "node:assert/strict";
import test from "node:test";
import { starterMissionProgress } from "../../src/domain/credits/rewardMissions.js";

test("starter missions follow the three server reward grants", () => {
  const progress = starterMissionProgress([
    { code: "signup", credits: 50, completed: true },
    { code: "first_character", credits: 50, completed: false },
    { code: "first_dm", credits: 50, completed: false },
  ]);
  assert.equal(progress.completedCount, 1);
  assert.equal(progress.earnedCredits, 50);
  assert.equal(progress.totalCredits, 150);
  assert.equal(progress.next.code, "first_character");
  assert.equal(progress.next.actionLabel, "주인공 만들기");
});

test("starter missions keep the completed journey visible", () => {
  const progress = starterMissionProgress([
    { code: "signup", credits: 50, completed: true },
    { code: "first_character", credits: 50, completed: true },
    { code: "first_dm", credits: 50, completed: true },
  ]);
  assert.equal(progress.completedCount, 3);
  assert.equal(progress.earnedCredits, 150);
  assert.equal(progress.next, null);
});
