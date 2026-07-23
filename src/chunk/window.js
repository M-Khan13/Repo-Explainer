import path from "node:path";

export const MAX_CHARS = 3000;
const OVERLAP_LINES = 10;

export function windowLines({ code, filePath, offset = 0, symbol = null }) {
  const lines = code.split("\n");
  const label = symbol ?? path.basename(filePath);
  const out = [];
  let i = 0;
  let part = 1;

  while (i < lines.length) {
    let end = i;
    let size = 0;
    while (end < lines.length && size + lines[end].length + 1 <= MAX_CHARS) {
      size += lines[end].length + 1;
      end++;
    }
    if (end === i) end = i + 1; // one line longer than the budget

    out.push({
      filePath,
      language: "javascript",
      symbol: `${label} (part ${part})`,
      type: "window",
      startLine: offset + i + 1,
      endLine: offset + end,
      code: lines.slice(i, end).join("\n"),
    });

    part++;
    if (end >= lines.length) break;
    i = Math.max(i + 1, end - OVERLAP_LINES);
  }

  return out;
}