// One-time bootstrap: builds data/teams.json and data/matches.json for the
// 2026 World Cup group stage from openfootball's public-domain dataset.
// Usage: node scripts/bootstrap-schedule.mjs
// Re-running overwrites the schedule but preserves any scores/overrides
// already present in data/matches.json (matched by id).

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = "https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json";

// Canonical team table. Names and 1-48 ranks match the draft tool (draft.html):
// ESPN power rankings 1-15 + FIFA April 2026 for the rest. The league's
// underdog rule derives from these ranks: top 16 = 1-16, bottom 16 = 33-48.
const TEAMS = [
  { name: "Spain",                  code: "ESP", flag: "🇪🇸", rank: 1,  conf: "UEFA" },
  { name: "France",                 code: "FRA", flag: "🇫🇷", rank: 2,  conf: "UEFA" },
  { name: "Argentina",              code: "ARG", flag: "🇦🇷", rank: 3,  conf: "CONMEBOL" },
  { name: "England",                code: "ENG", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", rank: 4,  conf: "UEFA" },
  { name: "Brazil",                 code: "BRA", flag: "🇧🇷", rank: 5,  conf: "CONMEBOL" },
  { name: "Portugal",               code: "POR", flag: "🇵🇹", rank: 6,  conf: "UEFA" },
  { name: "Germany",                code: "GER", flag: "🇩🇪", rank: 7,  conf: "UEFA" },
  { name: "Netherlands",            code: "NED", flag: "🇳🇱", rank: 8,  conf: "UEFA" },
  { name: "Morocco",                code: "MAR", flag: "🇲🇦", rank: 9,  conf: "CAF" },
  { name: "Norway",                 code: "NOR", flag: "🇳🇴", rank: 10, conf: "UEFA" },
  { name: "Belgium",                code: "BEL", flag: "🇧🇪", rank: 11, conf: "UEFA" },
  { name: "Colombia",               code: "COL", flag: "🇨🇴", rank: 12, conf: "CONMEBOL" },
  { name: "Senegal",                code: "SEN", flag: "🇸🇳", rank: 13, conf: "CAF" },
  { name: "Croatia",                code: "CRO", flag: "🇭🇷", rank: 14, conf: "UEFA" },
  { name: "Japan",                  code: "JPN", flag: "🇯🇵", rank: 15, conf: "AFC" },
  { name: "Mexico",                 code: "MEX", flag: "🇲🇽", rank: 16, conf: "CONCACAF" },
  { name: "USA",                    code: "USA", flag: "🇺🇸", rank: 17, conf: "CONCACAF",
    aliases: ["United States", "United States of America"] },
  { name: "Uruguay",                code: "URU", flag: "🇺🇾", rank: 18, conf: "CONMEBOL" },
  { name: "Switzerland",            code: "SUI", flag: "🇨🇭", rank: 19, conf: "UEFA" },
  { name: "Iran",                   code: "IRN", flag: "🇮🇷", rank: 20, conf: "AFC",
    aliases: ["IR Iran", "Iran IR"] },
  { name: "Türkiye",                code: "TUR", flag: "🇹🇷", rank: 21, conf: "UEFA",
    aliases: ["Turkey", "Turkiye"] },
  { name: "Ecuador",                code: "ECU", flag: "🇪🇨", rank: 22, conf: "CONMEBOL" },
  { name: "Austria",                code: "AUT", flag: "🇦🇹", rank: 23, conf: "UEFA" },
  { name: "South Korea",            code: "KOR", flag: "🇰🇷", rank: 24, conf: "AFC",
    aliases: ["Korea Republic", "Korea, South"] },
  { name: "Australia",              code: "AUS", flag: "🇦🇺", rank: 25, conf: "AFC" },
  { name: "Algeria",                code: "ALG", flag: "🇩🇿", rank: 26, conf: "CAF" },
  { name: "Egypt",                  code: "EGY", flag: "🇪🇬", rank: 27, conf: "CAF" },
  { name: "Canada",                 code: "CAN", flag: "🇨🇦", rank: 28, conf: "CONCACAF" },
  { name: "Panama",                 code: "PAN", flag: "🇵🇦", rank: 29, conf: "CONCACAF" },
  { name: "Ivory Coast",            code: "CIV", flag: "🇨🇮", rank: 30, conf: "CAF",
    aliases: ["Côte d'Ivoire", "Cote d'Ivoire", "Cote dIvoire"] },
  { name: "Sweden",                 code: "SWE", flag: "🇸🇪", rank: 31, conf: "UEFA" },
  { name: "Paraguay",               code: "PAR", flag: "🇵🇾", rank: 32, conf: "CONMEBOL" },
  { name: "Czechia",                code: "CZE", flag: "🇨🇿", rank: 33, conf: "UEFA",
    aliases: ["Czech Republic"] },
  { name: "Scotland",               code: "SCO", flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", rank: 34, conf: "UEFA" },
  { name: "Tunisia",                code: "TUN", flag: "🇹🇳", rank: 35, conf: "CAF" },
  { name: "DR Congo",               code: "COD", flag: "🇨🇩", rank: 36, conf: "CAF",
    aliases: ["Congo DR", "Democratic Republic of the Congo"] },
  { name: "Uzbekistan",             code: "UZB", flag: "🇺🇿", rank: 37, conf: "AFC" },
  { name: "Qatar",                  code: "QAT", flag: "🇶🇦", rank: 38, conf: "AFC" },
  { name: "Iraq",                   code: "IRQ", flag: "🇮🇶", rank: 39, conf: "AFC" },
  { name: "South Africa",           code: "RSA", flag: "🇿🇦", rank: 40, conf: "CAF" },
  { name: "Saudi Arabia",           code: "KSA", flag: "🇸🇦", rank: 41, conf: "AFC" },
  { name: "Jordan",                 code: "JOR", flag: "🇯🇴", rank: 42, conf: "AFC" },
  { name: "Bosnia and Herzegovina", code: "BIH", flag: "🇧🇦", rank: 43, conf: "UEFA",
    aliases: ["Bosnia & Herzegovina", "Bosnia-Herzegovina", "Bosnia and Herz."] },
  { name: "Cape Verde",             code: "CPV", flag: "🇨🇻", rank: 44, conf: "CAF",
    aliases: ["Cabo Verde", "Cape Verde Islands"] },
  { name: "Ghana",                  code: "GHA", flag: "🇬🇭", rank: 45, conf: "CAF" },
  { name: "Curaçao",                code: "CUW", flag: "🇨🇼", rank: 46, conf: "CONCACAF",
    aliases: ["Curacao"] },
  { name: "Haiti",                  code: "HAI", flag: "🇭🇹", rank: 47, conf: "CONCACAF" },
  { name: "New Zealand",            code: "NZL", flag: "🇳🇿", rank: 48, conf: "OFC" },
];

export function canonicalTeam(rawName) {
  const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const n = norm(rawName);
  return TEAMS.find(
    (t) => norm(t.name) === n || (t.aliases || []).some((a) => norm(a) === n)
  );
}

// "13:00 UTC-6" + "2026-06-11" -> "2026-06-11T19:00:00Z"
function toUtcIso(date, time) {
  const m = /^(\d{1,2}):(\d{2}) UTC([+-]\d+)(?::(\d{2}))?$/.exec(time);
  if (!m) throw new Error(`Unparseable time: ${time}`);
  const [, hh, mm, offH, offM] = m;
  const sign = offH.startsWith("-") ? -1 : 1;
  const offsetMin = sign * (Math.abs(parseInt(offH, 10)) * 60 + (offM ? parseInt(offM, 10) : 0));
  const utcMs = Date.UTC(
    ...date.split("-").map(Number).map((v, i) => (i === 1 ? v - 1 : v)),
    parseInt(hh, 10), parseInt(mm, 10)
  ) - offsetMin * 60 * 1000;
  return new Date(utcMs).toISOString().replace(".000Z", "Z");
}

async function main() {
  const res = await fetch(SOURCE);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${SOURCE}`);
  const source = await res.json();
  const groupMatches = source.matches.filter((m) => m.group);
  if (groupMatches.length !== 72) {
    throw new Error(`Expected 72 group matches, got ${groupMatches.length}`);
  }

  const teamGroups = {};
  for (const m of groupMatches) {
    for (const raw of [m.team1, m.team2]) {
      const t = canonicalTeam(raw);
      if (!t) throw new Error(`Unknown team in source data: "${raw}"`);
      const group = m.group.replace("Group ", "");
      if (teamGroups[t.name] && teamGroups[t.name] !== group) {
        throw new Error(`${t.name} appears in two groups`);
      }
      teamGroups[t.name] = group;
    }
  }

  const teams = TEAMS.map(({ aliases, ...t }) => ({ ...t, group: teamGroups[t.name] }));

  // Preserve scores/overrides from an existing matches.json across re-runs.
  const matchesPath = join(ROOT, "data", "matches.json");
  const existing = {};
  if (existsSync(matchesPath)) {
    for (const m of JSON.parse(readFileSync(matchesPath, "utf8")).matches) {
      existing[m.id] = m;
    }
  }

  const matches = groupMatches
    .map((m) => {
      const home = canonicalTeam(m.team1);
      const away = canonicalTeam(m.team2);
      const id = `${home.code}v${away.code}`;
      const prev = existing[id] || {};
      return {
        id,
        group: m.group.replace("Group ", ""),
        matchday: parseInt(m.round.replace("Matchday ", ""), 10),
        utcDate: toUtcIso(m.date, m.time),
        venue: m.ground,
        home: home.name,
        away: away.name,
        status: prev.status || "SCHEDULED",
        score: prev.score ?? null,
        ...(prev.override ? { override: true } : {}),
        ...(prev.fdId ? { fdId: prev.fdId } : {}),
      };
    })
    .sort((a, b) => a.utcDate.localeCompare(b.utcDate) || a.group.localeCompare(b.group));

  mkdirSync(join(ROOT, "data"), { recursive: true });
  writeFileSync(join(ROOT, "data", "teams.json"), JSON.stringify(teams, null, 2) + "\n");
  writeFileSync(
    matchesPath,
    JSON.stringify({ updated: new Date().toISOString(), matches }, null, 2) + "\n"
  );
  console.log(`Wrote ${teams.length} teams and ${matches.length} matches.`);
  console.log(`First: ${matches[0].id} ${matches[0].utcDate}  Last: ${matches.at(-1).id} ${matches.at(-1).utcDate}`);
}

const isDirectRun = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isDirectRun) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
