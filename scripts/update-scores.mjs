// Pulls live/final group-stage scores from football-data.org (free tier)
// into data/matches.json. Matches with "override": true are never touched,
// so hand-entered corrections survive automatic updates.
//
// Usage: FOOTBALL_DATA_TOKEN=xxx node scripts/update-scores.mjs
// Exits 0 with "no changes" when nothing changed (the CI workflow uses
// git-diff to decide whether to commit).

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalTeam } from "./bootstrap-schedule.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MATCHES_PATH = join(ROOT, "data", "matches.json");
const API = "https://api.football-data.org/v4/competitions/WC/matches?stage=GROUP_STAGE";

const token = process.env.FOOTBALL_DATA_TOKEN;
if (!token) {
  console.error("FOOTBALL_DATA_TOKEN is not set.");
  process.exit(1);
}

// football-data.org statuses -> ours
function mapStatus(s) {
  if (s === "FINISHED") return "FINISHED";
  if (s === "IN_PLAY" || s === "PAUSED") return "LIVE";
  return "SCHEDULED"; // SCHEDULED, TIMED, POSTPONED, SUSPENDED, CANCELLED
}

// Resolve a football-data team object to our canonical name. Tries the
// short name, full name, then the TLA code against our team table.
function resolveTeam(fdTeam, codeIndex) {
  for (const candidate of [fdTeam.shortName, fdTeam.name]) {
    if (!candidate) continue;
    const t = canonicalTeam(candidate);
    if (t) return t.name;
  }
  if (fdTeam.tla && codeIndex[fdTeam.tla]) return codeIndex[fdTeam.tla];
  return null;
}

async function main() {
  const res = await fetch(API, { headers: { "X-Auth-Token": token } });
  if (!res.ok) {
    console.error(`football-data.org: HTTP ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  const fd = await res.json();

  const file = JSON.parse(readFileSync(MATCHES_PATH, "utf8"));
  const teams = JSON.parse(readFileSync(join(ROOT, "data", "teams.json"), "utf8"));
  const codeIndex = Object.fromEntries(teams.map((t) => [t.code, t.name]));
  const byPair = {};
  const byFdId = {};
  for (const m of file.matches) {
    byPair[`${m.home}|${m.away}`] = m;
    if (m.fdId) byFdId[m.fdId] = m;
  }

  let changed = 0;
  const unmatched = [];
  for (const fm of fd.matches || []) {
    let ours = byFdId[fm.id];
    if (!ours) {
      const home = resolveTeam(fm.homeTeam, codeIndex);
      const away = resolveTeam(fm.awayTeam, codeIndex);
      if (!home || !away) {
        unmatched.push(`${fm.homeTeam?.name} vs ${fm.awayTeam?.name}`);
        continue;
      }
      // Group-stage pairs are unique, but try both orders just in case the
      // feed flips home/away relative to the official schedule.
      ours = byPair[`${home}|${away}`] || byPair[`${away}|${home}`];
      if (!ours) {
        unmatched.push(`${home} vs ${away} (not in our schedule)`);
        continue;
      }
    }
    if (ours.override) continue;

    const status = mapStatus(fm.status);
    const ft = fm.score?.fullTime;
    const score =
      typeof ft?.home === "number" && typeof ft?.away === "number"
        ? { home: ft.home, away: ft.away }
        : null;

    const before = JSON.stringify([ours.status, ours.score, ours.fdId]);
    ours.status = status;
    // Only write a score once there is one; never blank out an existing score.
    if (score) {
      // The feed reports relative to ITS home/away — remap if ours is flipped.
      const flipped = resolveTeam(fm.homeTeam, codeIndex) === ours.away;
      ours.score = flipped ? { home: score.away, away: score.home } : score;
    }
    ours.fdId = fm.id;
    if (JSON.stringify([ours.status, ours.score, ours.fdId]) !== before) changed++;
  }

  if (unmatched.length) {
    console.warn(`WARNING: ${unmatched.length} feed matches not mapped:\n  ` + unmatched.join("\n  "));
  }
  if (!changed) {
    console.log("No changes.");
    return;
  }
  file.updated = new Date().toISOString();
  writeFileSync(MATCHES_PATH, JSON.stringify(file, null, 2) + "\n");
  console.log(`Updated ${changed} matches.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
