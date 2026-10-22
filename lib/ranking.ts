/**
 * lib/ranking.ts — Search result ranking (spec R1).
 *
 * Scoring rules (highest first, deterministic tie-break by symbol ascending):
 *   1000  exact symbol match
 *    800  symbol prefix
 *    600  name starts with query
 *    400  any word in name starts with query
 *    200  substring match in symbol or name
 *    100 – 60  fuzzy: Damerau-Levenshtein distance ≤ 2 on symbol or any name word
 *              score = 100 − 20 × edits (min 60)
 *      0  no match — excluded from results
 *
 * All comparisons are case-insensitive; leading/trailing whitespace is stripped.
 */

import type { SearchSuggestion } from "./searchCache";

/**
 * Compute Damerau-Levenshtein distance between two strings.
 * Only adjacent transpositions are counted (optimal string alignment).
 */
export function damerauLevenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  // Allocate (m+1) × (n+1) matrix.
  const d: number[][] = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0)
  );
  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,       // deletion
        d[i][j - 1] + 1,       // insertion
        d[i - 1][j - 1] + cost // substitution
      );
      if (
        i > 1 &&
        j > 1 &&
        a[i - 1] === b[j - 2] &&
        a[i - 2] === b[j - 1]
      ) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + cost); // transposition
      }
    }
  }
  return d[m][n];
}

/**
 * Score a single candidate against the query.
 * Returns 0 if there is no match.
 */
export function scoreCandidate(
  query: string,
  symbol: string,
  name: string
): number {
  const q = query.trim().toUpperCase();
  const s = symbol.trim().toUpperCase();
  const n = name.trim().toUpperCase();

  if (!q) return 0;

  // 1. Exact symbol match.
  if (s === q) return 1000;

  // 2. Symbol prefix.
  if (s.startsWith(q)) return 800;

  // 3. Name starts with query.
  if (n.startsWith(q)) return 600;

  // 4. Any word in name starts with query.
  if (n.split(/\s+/).some((word) => word.startsWith(q))) return 400;

  // 5. Substring (symbol or name).
  if (s.includes(q) || n.includes(q)) return 200;

  // 6. Fuzzy on symbol.
  // Compare against the same-length prefix of the symbol to keep distance meaningful.
  const sSlice = s.slice(0, Math.min(s.length, q.length + 2));
  const distSym = damerauLevenshtein(q, sSlice);
  if (distSym <= 2) return Math.max(60, 100 - 20 * distSym);

  // 7. Fuzzy on each word in name.
  for (const word of n.split(/\s+/)) {
    const wSlice = word.slice(0, Math.min(word.length, q.length + 2));
    const distWord = damerauLevenshtein(q, wSlice);
    if (distWord <= 2) return Math.max(60, 100 - 20 * distWord);
  }

  return 0;
}

/**
 * Rank an array of SearchSuggestion objects for the given query.
 *
 * Returns only candidates with score > 0, sorted:
 *   1. descending by score
 *   2. ascending by symbol as a deterministic tie-break
 */
export function rankResults(
  query: string,
  candidates: SearchSuggestion[]
): SearchSuggestion[] {
  const scored = candidates
    .map((c) => ({ c, score: scoreCandidate(query, c.symbol, c.name) }))
    .filter(({ score }) => score > 0);

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // Tie-break: ascending symbol.
    return a.c.symbol < b.c.symbol ? -1 : a.c.symbol > b.c.symbol ? 1 : 0;
  });

  return scored.map(({ c }) => c);
}
