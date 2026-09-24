// Normalises an organisation name into a stable lookup key so "Stripe, Inc."
// and "stripe" hit the same saved research. Keep in sync with lib/org.js in
// the app (same steps, same output; both are covered by tests).

const SUFFIXES = new Set([
  "inc", "llc", "ltd", "limited", "pty", "plc", "corp", "corporation", "co",
  "gmbh", "sa", "ag", "bv", "nv", "pvt", "holdings", "group",
]);

export function normalizeOrg(name: string): string {
  let s = String(name ?? "");
  if (typeof s.normalize === "function") s = s.normalize("NFKD");
  s = s
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['\u2019`.]/g, "")
    .replace(/&/g, " and ")
    .replace(/[\u0021-\u002f\u003a-\u0040\u005b-\u0060\u007b-\u007e\s]+/g, " ")
    .trim();
  const words = s.split(" ").filter(Boolean);
  while (words.length > 1 && SUFFIXES.has(words[words.length - 1])) words.pop();
  return words.join(" ");
}
