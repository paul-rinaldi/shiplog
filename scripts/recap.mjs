// Weekly recap email via Resend.
//   RESEND_API_KEY  Resend API key (secret)
//   RECAP_TO        comma-separated emails (secret, so addresses stay out of the repo)
//   RECAP_FROM      e.g. "Shiplog <recap@yourdomain.com>" (domain must be verified in Resend)
// Without RESEND_API_KEY it writes recap-preview.html instead of sending.

import { readFile, writeFile } from "node:fs/promises";

const root = new URL("..", import.meta.url);
const data = JSON.parse(await readFile(new URL("site/data.json", root), "utf8"));
const config = JSON.parse(await readFile(new URL("config.json", root), "utf8"));

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const users = [...data.users].sort((a, b) => b.week.score - a.week.score);
const total = (k) => users.reduce((n, u) => n + u.week[k], 0);
const best = (f) => [...users].sort((a, b) => f(b) - f(a))[0];
const sleepers = users.filter((u) => u.week.score === 0);

const C = { bg: "#0e1b2c", row: "#16263b", paper: "#ede6d3", fog: "#8796ab", yellow: "#f2b33d", red: "#e0564c" };
const font = "font-family:'Arial Narrow',Arial,sans-serif;";

const rows = users.map((u, i) => {
  const w = u.week;
  const move = w.rankDelta > 0 ? ` <span style="color:#4fb07a">▲${w.rankDelta}</span>`
             : w.rankDelta < 0 ? ` <span style="color:${C.red}">▼${-w.rankDelta}</span>` : "";
  return `<tr style="background:${C.row}">
    <td style="padding:10px 12px;font-size:22px;font-weight:700;color:${i < 3 && w.score ? C.yellow : C.paper}">${i + 1}${move}</td>
    <td style="padding:10px 0;font-size:17px;font-weight:700;color:${C.paper}">${esc(u.name)}<br>
      <span style="font-size:13px;font-weight:400;color:${C.fog}">${w.mergedPRs} shipped · ${w.reviews} reviews · ${w.commits + w.private} commits · ${u.streak}d streak</span></td>
    <td style="padding:10px 12px;font-size:24px;font-weight:700;text-align:right;color:${C.paper}">${w.score}</td>
  </tr>`;
}).join(`<tr><td colspan="3" style="height:3px"></td></tr>`);

const s = best((u) => u.streak);
const lines = [
  `The crew merged ${total("mergedPRs")} PRs and left ${total("reviews")} reviews this week.`,
  users[0]?.week.score ? `${esc(users[0].name)} takes the week with ${users[0].week.score} points.` : "",
  s?.streak >= 3 ? `${esc(s.name)} is on a ${s.streak}-day streak.` : "",
  sleepers.length ? `<span style="color:${C.red}">${sleepers.map((u) => esc(u.name)).join(", ")}: the keyboard misses you.</span>` : "",
].filter(Boolean);

const site = config.siteUrl;
const html = `<!doctype html><html><body style="margin:0;background:${C.bg};${font}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg}"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
  <tr><td style="font-size:48px;font-weight:900;letter-spacing:1px;color:${C.paper}">${esc(data.title)}</td></tr>
  <tr><td style="padding:4px 0 18px;font-size:17px;color:${C.fog}">Weekly recap</td></tr>
  <tr><td style="padding:0 0 20px;font-size:17px;line-height:1.5;color:${C.paper}">${lines.join("<br>")}</td></tr>
  <tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table></td></tr>
  <tr><td style="padding:24px 0"><a href="${esc(site)}" style="display:inline-block;background:${C.paper};color:${C.bg};font-weight:700;font-size:16px;text-decoration:none;padding:12px 18px;border-radius:4px">Open the board</a></td></tr>
</table></td></tr></table></body></html>`;

const subject = users[0]?.week.score
  ? `${users[0].name} took the week · ${data.title} recap`
  : `${data.title} weekly recap`;

if (!process.env.RESEND_API_KEY) {
  await writeFile(new URL("recap-preview.html", root), html);
  console.log(`no RESEND_API_KEY, wrote recap-preview.html (subject: ${subject})`);
  process.exit(0);
}

const to = (process.env.RECAP_TO || "").split(",").map((s) => s.trim()).filter(Boolean);
if (!to.length || !process.env.RECAP_FROM) {
  console.error("Set RECAP_TO and RECAP_FROM.");
  process.exit(1);
}

// Send one email per person so addresses aren't exposed to each other.
const res = await fetch("https://api.resend.com/emails/batch", {
  method: "POST",
  headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify(to.map((addr) => ({ from: process.env.RECAP_FROM, to: [addr], subject, html }))),
});
const out = await res.text();
if (!res.ok) { console.error(`Resend ${res.status}: ${out}`); process.exit(1); }
console.log(`sent to ${to.length} people`);
