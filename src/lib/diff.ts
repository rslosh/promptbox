export type DiffToken = { type: "same" | "add" | "remove"; text: string };

/**
 * Word-level diff using LCS. Tokenizes on word/whitespace boundaries so
 * whitespace tokens can be rendered plain while only word tokens are styled.
 */
export function computeWordDiff(oldStr: string, newStr: string): DiffToken[] {
  const tokenize = (s: string) => s.match(/\S+|\s+/g) ?? [];
  const oldT = tokenize(oldStr);
  const newT = tokenize(newStr);
  const m = oldT.length;
  const n = newT.length;

  // LCS DP table
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0)
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        oldT[i - 1] === newT[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  // Backtrack to build diff
  const result: DiffToken[] = [];
  let i = m,
    j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldT[i - 1] === newT[j - 1]) {
      result.unshift({ type: "same", text: oldT[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ type: "add", text: newT[j - 1] });
      j--;
    } else {
      result.unshift({ type: "remove", text: oldT[i - 1] });
      i--;
    }
  }
  return result;
}
