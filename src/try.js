import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { cloneRepo, cleanupRepo } from "./ingest/clone.js";
import { walkRepo } from "./ingest/walk.js";
import { parseCode } from "./chunk/parse.js";
import { extractChunks } from "./chunk/extract.js";

const dir = await cloneRepo("https://github.com/M-Khan13/Cafe-opps");
try {
  const files = await walkRepo(dir);
  const all = [];

  for (const file of files) {
    const code = await readFile(path.join(dir, file), "utf8");
    const tree = await parseCode(code);
    all.push(...extractChunks(tree, code, file));
  }

  await writeFile("chunks.json", JSON.stringify(all, null, 2));

  console.log("files:", files.length, "chunks:", all.length);
  const lens = all.map((c) => c.code.length).sort((a, b) => a - b);
  console.log("shortest:", lens[0], "longest:", lens.at(-1));

  const empty = files.filter(
    (f) => !all.some((c) => c.filePath === f)
  );
  console.log("files producing 0 chunks:", empty);
} finally {
  await cleanupRepo(dir);
}