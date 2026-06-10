// League scoring engine — single source of truth, used by both the tracker
// page (index.html) and the node test suite (scripts/test-scoring.mjs).
//
// Rules:
//   +3 win · +1 tie · +1 per goal of winning margin (winner only)
//   +1 clean sheet · +1 per goal a bottom-16 team scores on a top-16 team
// Top 16 = ranks 1-16, bottom 16 = ranks 33-48 (draft-board ranks; ranks
// 17-32 trigger nothing on the underdog rule).

export const TOP16_MAX_RANK = 16;
export const BOTTOM16_MIN_RANK = 33;

function sideBreakdown(goalsFor, goalsAgainst, ownRank, oppRank) {
  const win = goalsFor > goalsAgainst ? 3 : 0;
  const tie = goalsFor === goalsAgainst ? 1 : 0;
  const gd = goalsFor > goalsAgainst ? goalsFor - goalsAgainst : 0;
  const cleanSheet = goalsAgainst === 0 ? 1 : 0;
  const underdog =
    ownRank >= BOTTOM16_MIN_RANK && oppRank <= TOP16_MAX_RANK ? goalsFor : 0;
  return { win, tie, gd, cleanSheet, underdog, total: win + tie + gd + cleanSheet + underdog };
}

// match: { home, away, score: {home, away} | null }
// rankByTeam: { [teamName]: rank 1-48 }
// Returns { home, away } breakdowns, or null if the match has no score yet.
export function scoreMatch(match, rankByTeam) {
  if (!match.score) return null;
  const { home: hg, away: ag } = match.score;
  if (typeof hg !== "number" || typeof ag !== "number") return null;
  const hr = rankByTeam[match.home];
  const ar = rankByTeam[match.away];
  if (!hr || !ar) throw new Error(`Unknown team in match ${match.id}: ${match.home} / ${match.away}`);
  return {
    home: sideBreakdown(hg, ag, hr, ar),
    away: sideBreakdown(ag, hg, ar, hr),
  };
}

// Human-readable chips for a breakdown, e.g. ["W +3", "GD +2", "CS +1"]
export function breakdownChips(b) {
  const chips = [];
  if (b.win) chips.push(`W +${b.win}`);
  if (b.tie) chips.push(`T +${b.tie}`);
  if (b.gd) chips.push(`GD +${b.gd}`);
  if (b.cleanSheet) chips.push(`CS +${b.cleanSheet}`);
  if (b.underdog) chips.push(`UD +${b.underdog}`);
  return chips;
}
