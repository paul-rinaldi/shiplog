// Pulls public GitHub contribution stats for everyone in friends.json,
// scores them, and writes site/data.json + site/history.json.
//
//   GITHUB_TOKEN=... node scripts/fetch.mjs     real data
//   node scripts/fetch.mjs --demo               fake data, for previewing the site
//
// No dependencies. Node 20+.

import { readFile, writeFile } from "node:fs/promises";

const ROOT = new URL("..", import.meta.url);
const path = (p) => new URL(p, ROOT);
const DEMO = process.argv.includes("--demo");
const DAY = 86_400_000;

const config = JSON.parse(await readFile(path("config.json"), "utf8"));
const friends = DEMO
  ? ["paul", "dan", "saab", "vish", "maya", "theo"].map((g) => ({ github: g, name: g[0].toUpperCase() + g.slice(1) }))
  : JSON.parse(await readFile(path("friends.json"), "utf8"));
const S = config.scoring;

const now = new Date();
const isoDay = (d) => d.toISOString().slice(0, 10);
const daysAgo = (n) => new Date(now.getTime() - n * DAY);

// ---------- GitHub ----------

const COUNTS = `totalCommitContributions totalPullRequestContributions
  totalPullRequestReviewContributions totalIssueContributions restrictedContributionsCount`;

const QUERY = `
query($login: String!, $wFrom: DateTime!, $mFrom: DateTime!, $to: DateTime!, $qW: String!, $qM: String!) {
  user(login: $login) {
    login name avatarUrl url
    week:  contributionsCollection(from: $wFrom, to: $to) { ${COUNTS} }
    month: contributionsCollection(from: $mFrom, to: $to) { ${COUNTS} }
    year:  contributionsCollection { contributionCalendar { weeks { contributionDays { date contributionCount } } } }
  }
  mergedW: search(query: $qW, type: ISSUE, first: 1) { issueCount }
  mergedM: search(query: $qM, type: ISSUE, first: 1) { issueCount }
}`;

async function gql(variables, attempt = 1) {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `bearer ${process.env.GITHUB_TOKEN}`,
      "Content-Type": "application/json",
      "User-Agent": "shiplog",
    },
    body: JSON.stringify({ query: QUERY, variables }),
  });
  if (res.status >= 500 && attempt < 3) {
    await new Promise((r) => setTimeout(r, 2000 * attempt));
    return gql(variables, attempt + 1);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(body).slice(0, 200)}`);
  if (body.errors?.length && !body.data?.user) throw new Error(body.errors[0].message);
  return body.data;
}

async function fetchUser(login) {
  const d = await gql({
    login,
    wFrom: daysAgo(7).toISOString(),
    mFrom: daysAgo(30).toISOString(),
    to: now.toISOString(),
    qW: `author:${login} is:pr is:merged merged:>=${isoDay(daysAgo(7))}`,
    qM: `author:${login} is:pr is:merged merged:>=${isoDay(daysAgo(30))}`,
  });
  const u = d.user;
  if (!u) throw new Error("user not found");
  const days = u.year.contributionCalendar.weeks
    .flatMap((w) => w.contributionDays)
    .map((x) => [x.date, x.contributionCount]);
  const pick = (c, merged) => ({
    commits: c.totalCommitContributions,
    openedPRs: c.totalPullRequestContributions,
    mergedPRs: merged,
    reviews: c.totalPullRequestReviewContributions,
    issues: c.totalIssueContributions,
    private: c.restrictedContributionsCount,
  });
  return {
    login: u.login,
    ghName: u.name,
    avatar: u.avatarUrl,
    url: u.url,
    week: pick(u.week, d.mergedW.issueCount),
    month: pick(u.month, d.mergedM.issueCount),
    days,
  };
}

// ---------- demo data ----------

function fakeUser(login, i) {
  const vibe = [1.6, 1.1, 0.8, 0.5, 0.2, 0][i % 6];
  const days = [];
  for (let k = 364; k >= 0; k--) {
    const active = Math.random() < 0.25 + vibe * 0.4;
    days.push([isoDay(daysAgo(k)), active ? Math.ceil(Math.random() * 12 * vibe) : 0]);
  }
  const win = (n) => {
    const total = days.slice(-n).reduce((a, [, c]) => a + c, 0);
    return {
      commits: Math.round(total * 0.6),
      openedPRs: Math.round(total * 0.08),
      mergedPRs: Math.round(total * 0.06),
      reviews: Math.round(total * 0.1 * vibe),
      issues: Math.round(total * 0.04),
      private: Math.round(total * 0.12),
    };
  };
  return {
    login, ghName: null,
    avatar: `https://github.com/identicons/${login}.png`,
    url: `https://github.com/${login}`,
    week: win(7), month: win(30), days,
  };
}

// ---------- scoring ----------

function streaks(days) {
  let longest = 0, run = 0;
  for (const [, c] of days) { run = c > 0 ? run + 1 : 0; longest = Math.max(longest, run); }
  // Current streak: today with 0 doesn't break it yet (day isn't over).
  let i = days.length - 1;
  if (i >= 0 && days[i][1] === 0) i--;
  let current = 0;
  while (i >= 0 && days[i][1] > 0) { current++; i--; }
  return { current, longest };
}

function score(c, streak) {
  const base =
    c.mergedPRs * S.mergedPR + c.reviews * S.review + c.openedPRs * S.openedPR +
    c.issues * S.issue + c.commits * S.commit + c.private * S.private;
  const mult = 1 + Math.min(streak * S.streakBonusPerDay, S.streakBonusMax);
  return { score: Math.round(base * mult), multiplier: +mult.toFixed(2) };
}

// ---------- run ----------

const users = [];
const failed = [];
for (const [i, f] of friends.entries()) {
  try {
    const raw = DEMO ? fakeUser(f.github, i) : await fetchUser(f.github);
    const st = streaks(raw.days);
    users.push({
      login: raw.login,
      name: f.name || raw.ghName || raw.login,
      avatar: raw.avatar,
      url: raw.url,
      streak: st.current,
      longestStreak: st.longest,
      week: { ...raw.week, ...score(raw.week, st.current) },
      month: { ...raw.month, ...score(raw.month, st.current) },
      heat: raw.days.slice(-84).map(([, c]) => c), // last 12 weeks, oldest first
    });
    console.log(`ok   ${f.github}`);
  } catch (e) {
    failed.push(f.github);
    console.error(`FAIL ${f.github}: ${e.message}`);
  }
}

// History: one snapshot per day, keep 60 days. Used for "rank moved" arrows.
const histPath = path("site/history.json");
let history = {}, histRaw = "";
try { histRaw = await readFile(histPath, "utf8"); history = JSON.parse(histRaw); } catch {}
const rankOf = (key) =>
  Object.fromEntries([...users].sort((a, b) => b[key].score - a[key].score).map((u, i) => [u.login, i + 1]));
const today = isoDay(now);
const rW = rankOf("week"), rM = rankOf("month");
history[today] = Object.fromEntries(users.map((u) => [u.login, { w: rW[u.login], m: rM[u.login] }]));
for (const d of Object.keys(history)) if (d < isoDay(daysAgo(60))) delete history[d];

// Compare against the snapshot closest to 7 days ago (within 7-14 days).
const past = Object.keys(history).filter((d) => d <= isoDay(daysAgo(7)) && d >= isoDay(daysAgo(14))).sort().pop();
for (const u of users) {
  const prev = past && history[past][u.login];
  u.week.rankDelta = prev ? prev.w - rW[u.login] : null;
  u.month.rankDelta = prev ? prev.m - rM[u.login] : null;
}

const data = { title: config.title, tagline: config.tagline, repo: config.repo, scoring: S, users };

// Only rewrite if something real changed, so the repo doesn't get a commit every run.
const dataPath = path("site/data.json");
let prevData = null;
try { prevData = JSON.parse(await readFile(dataPath, "utf8")); } catch {}
const { updatedAt: _, ...prevRest } = prevData || {};
if (JSON.stringify(prevRest) !== JSON.stringify(data)) {
  await writeFile(dataPath, JSON.stringify({ updatedAt: now.toISOString(), ...data }, null, 1) + "\n");
  console.log(`wrote ${users.length} users`);
} else {
  console.log("no changes");
}
const histOut = JSON.stringify(history) + "\n";
if (histOut !== histRaw) await writeFile(histPath, histOut);

if (failed.length && failed.length === friends.length) process.exit(1);
