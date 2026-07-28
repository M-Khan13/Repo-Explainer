import "dotenv/config";
import { retrieve } from "../query/retrieve.js";
import { closeDb } from "../db/mongo.js";
import { EVAL_SET } from "./questions.js";

const REPO = "cafe-ops";
const K = 6;

function scoreOne(hits, expectedFiles) {
  const got = new Set(hits.map((h) => h.filePath));
  return expectedFiles.some((f) => got.has(f));
}

const rows = [];
let hits = 0;

for (const { q, files } of EVAL_SET) {
  const results = await retrieve(q, REPO, K);
  const pass = scoreOne(results, files);
  if (pass) hits++;

  rows.push({
    q: q.slice(0, 40),
    pass: pass ? "✓" : "✗",
    top: `${results[0].filePath.split("/").pop()}`,
  });
}

console.table(rows);
console.log(`\nhit@${K}: ${hits}/${EVAL_SET.length} (${((hits / EVAL_SET.length) * 100).toFixed(0)}%)`);

await closeDb();