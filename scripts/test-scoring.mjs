// Hand-computed scoring cases. Run: node scripts/test-scoring.mjs
import { scoreMatch } from "../js/scoring.js";
import assert from "node:assert/strict";

// Ranks: Spain 1 (top 16), Mexico 16 (top 16), USA 17 (middle), Paraguay 32
// (middle), Czechia 33 (bottom 16), Cape Verde 44 (bottom 16)
const ranks = { Spain: 1, Mexico: 16, USA: 17, Paraguay: 32, Czechia: 33, "Cape Verde": 44 };
const m = (home, away, hg, ag) => ({ id: "t", home, away, score: { home: hg, away: ag } });

const cases = [
  // 3-1 win: 3 win + 2 GD = 5; loser (middle 16, vs top 16 -> no underdog) gets 0
  [m("Spain", "USA", 3, 1), { home: 5, away: 0 }],
  // 0-0: both get 1 tie + 1 clean sheet = 2
  [m("USA", "Paraguay", 0, 0), { home: 2, away: 2 }],
  // 2-0: 3 win + 2 GD + 1 CS = 6; loser 0
  [m("Mexico", "USA", 2, 0), { home: 6, away: 0 }],
  // Felipe's example: Cape Verde scores 2 on Spain but loses 3-2.
  // Spain: 3 win + 1 GD = 4. Cape Verde: +2 underdog (no negative GD).
  [m("Spain", "Cape Verde", 3, 2), { home: 4, away: 2 }],
  // Underdog WINS 1-0 over top 16: 3 win + 1 GD + 1 CS + 1 UD = 6
  [m("Czechia", "Mexico", 1, 0), { home: 6, away: 0 }],
  // Underdog ties a top-16 team 2-2: 1 tie + 2 UD = 3; top side gets 1 tie
  [m("Mexico", "Cape Verde", 2, 2), { home: 1, away: 3 }],
  // Bottom-16 vs MIDDLE team (USA rank 17): no underdog points. 1-1 -> 1 each
  [m("Czechia", "USA", 1, 1), { home: 1, away: 1 }],
  // Bottom-16 vs bottom-16: no underdog either way. 4-2 -> 3 + 2 = 5 / 0
  [m("Czechia", "Cape Verde", 4, 2), { home: 5, away: 0 }],
  // Big win with clean sheet: 5-0 = 3 + 5 + 1 = 9
  [m("Spain", "USA", 5, 0), { home: 9, away: 0 }],
  // 1-0 win for rank-16 over rank-17: 16 is top but 17 is not bottom -> no UD
  [m("Mexico", "USA", 1, 0), { home: 5, away: 0 }],
];

let n = 0;
for (const [match, expected] of cases) {
  const r = scoreMatch(match, ranks);
  const label = `${match.home} ${match.score.home}-${match.score.away} ${match.away}`;
  assert.equal(r.home.total, expected.home, `${label}: home expected ${expected.home}, got ${r.home.total}`);
  assert.equal(r.away.total, expected.away, `${label}: away expected ${expected.away}, got ${r.away.total}`);
  n++;
}

// No score yet -> null
assert.equal(scoreMatch({ id: "t", home: "Spain", away: "USA", score: null }, ranks), null);
// Breakdown components on the Cape Verde example
const cv = scoreMatch(m("Spain", "Cape Verde", 3, 2), ranks);
assert.deepEqual(cv.away, { win: 0, tie: 0, gd: 0, cleanSheet: 0, underdog: 2, total: 2 });
assert.deepEqual(cv.home, { win: 3, tie: 0, gd: 1, cleanSheet: 0, underdog: 0, total: 4 });

console.log(`✓ all ${n + 2} scoring cases pass`);
