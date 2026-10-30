// Run by .github/workflows/join.yml when someone opens a "Join the crew" issue.
// Adds the ISSUE AUTHOR (not anything typed in the issue) to friends.json.
// Outputs for the workflow: action=add|exists|reject, login, message.

import { readFile, writeFile, appendFile } from "node:fs/promises";
import { LOGIN_RE, MAX_FRIENDS, cleanName, validate } from "./friends-lib.mjs";

const out = async (k, v) =>
  process.env.GITHUB_OUTPUT
    ? appendFile(process.env.GITHUB_OUTPUT, `${k}<<__EOF__\n${v}\n__EOF__\n`)
    : console.log(`${k}=${v}`);

const login = process.env.ISSUE_AUTHOR || "";
const userType = process.env.ISSUE_AUTHOR_TYPE || "User";
const body = process.env.ISSUE_BODY || "";

if (userType !== "User" || !LOGIN_RE.test(login)) {
  await out("action", "reject");
  await out("message", "Only regular GitHub user accounts can join.");
  process.exit(0);
}

// Issue forms render as "### Display name\n\n<value>"
const m = body.match(/###\s*Display name\s*\n+([^\n]*)/i);
const typed = m && m[1].trim() !== "_No response_" ? m[1] : null;
const name = cleanName(typed);

const file = new URL("../friends.json", import.meta.url);
const friends = JSON.parse(await readFile(file, "utf8"));

await out("login", login);
if (friends.some((f) => f.github.toLowerCase() === login.toLowerCase())) {
  await out("action", "exists");
  await out("message", `@${login} is already on the board.`);
  process.exit(0);
}
if (friends.length >= MAX_FRIENDS) {
  await out("action", "reject");
  await out("message", `The board is full (${MAX_FRIENDS} max).`);
  process.exit(0);
}

friends.push(name ? { github: login, name } : { github: login });
const errors = validate(friends);
if (errors.length) {
  await out("action", "reject");
  await out("message", `Couldn't add you: ${errors.join("; ")}`);
  process.exit(0);
}
await writeFile(file, JSON.stringify(friends, null, 2) + "\n");
await out("action", "add");
await out("message", `Added @${login}${name ? ` as "${name}"` : ""}.`);
