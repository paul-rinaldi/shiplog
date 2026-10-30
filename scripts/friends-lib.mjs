// Shared rules for friends.json, used by join + validate.

export const LOGIN_RE = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;
export const MAX_FRIENDS = 100;

// Letters (any language), numbers, spaces and a little punctuation. No markup, no URLs.
export function cleanName(raw) {
  if (!raw) return null;
  const s = String(raw)
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N} ._'-]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 32);
  return s || null;
}

export function validate(list) {
  const errors = [];
  if (!Array.isArray(list)) return ["friends.json must be a JSON array"];
  if (list.length > MAX_FRIENDS) errors.push(`max ${MAX_FRIENDS} friends`);
  const seen = new Set();
  list.forEach((f, i) => {
    const where = `entry ${i + 1}`;
    if (!f || typeof f !== "object" || Array.isArray(f)) return errors.push(`${where}: must be an object`);
    const extra = Object.keys(f).filter((k) => !["github", "name"].includes(k));
    if (extra.length) errors.push(`${where}: unknown field(s) ${extra.join(", ")}`);
    if (typeof f.github !== "string" || !LOGIN_RE.test(f.github)) errors.push(`${where}: "github" is not a valid username`);
    else if (seen.has(f.github.toLowerCase())) errors.push(`${where}: ${f.github} is listed twice`);
    else seen.add(f.github.toLowerCase());
    if (f.name != null && (typeof f.name !== "string" || cleanName(f.name) !== f.name))
      errors.push(`${where}: "name" can only use letters, numbers, spaces and . _ ' - (max 32)`);
  });
  return errors;
}
