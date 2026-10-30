// CI check for pull requests that touch friends.json.
import { readFile } from "node:fs/promises";
import { validate } from "./friends-lib.mjs";

let list;
try {
  list = JSON.parse(await readFile(new URL("../friends.json", import.meta.url), "utf8"));
} catch (e) {
  console.error(`friends.json is not valid JSON: ${e.message}`);
  process.exit(1);
}
const errors = validate(list);
if (errors.length) {
  for (const e of errors) console.error(`::error file=friends.json::${e}`);
  process.exit(1);
}
console.log(`friends.json ok (${list.length} friends)`);
