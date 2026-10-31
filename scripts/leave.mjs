// Run by .github/workflows/leave.yml when someone opens a "Leave the crew" issue.
// Removes the ISSUE AUTHOR (not anything typed in the issue) from friends.json
// and from the rank history.
// Outputs for the workflow: action=remove|absent, message.

import { readFile, writeFile, appendFile } from "node:fs/promises";

const out = async (k, v) =>
  process.env.GITHUB_OUTPUT
    ? appendFile(process.env.GITHUB_OUTPUT, `${k}<<__EOF__\n${v}\n__EOF__\n`)
    : console.log(`${k}=${v}`);

const login = (process.env.ISSUE_AUTHOR || "").toLowerCase();

const file = new URL("../friends.json", import.meta.url);
const friends = JSON.parse(await readFile(file, "utf8"));
const kept = friends.filter((f) => f.github.toLowerCase() !== login);

if (!login || kept.length === friends.length) {
  await out("action", "absent");
  await out("message", `@${process.env.ISSUE_AUTHOR} isn't on the board.`);
  process.exit(0);
}
await writeFile(file, JSON.stringify(kept, null, 2) + "\n");

const histFile = new URL("../site/history.json", import.meta.url);
const history = JSON.parse(await readFile(histFile, "utf8"));
for (const day of Object.values(history)) {
  for (const k of Object.keys(day)) if (k.toLowerCase() === login) delete day[k];
}
await writeFile(histFile, JSON.stringify(history) + "\n");

await out("action", "remove");
await out("message", `Removed @${process.env.ISSUE_AUTHOR}. You'll be off the board within a few minutes.`);
