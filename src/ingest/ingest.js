import { readFile } from "node:fs/promises";
import path from "node:path";
import { cloneRepo, cleanupRepo } from "./clone.js";
import { walkRepo } from "./walk.js";
import { parseCode } from "../chunk/parse.js";
import { extractChunks } from "../chunk/extract.js";
import { embed } from "../embed/embed.js";
import { getDb } from "../db/mongo.js";

const EMBED_TEXT = (c) => `${c.filePath} ${c.symbol}\n${c.code}`;

export async function ingestRepo(url, repo) {
  const dir = await cloneRepo(url);
  try {
    const files = await walkRepo(dir);

    const chunks = [];
    for (const file of files) {
      const code = await readFile(path.join(dir, file), "utf8");
      const tree = await parseCode(code);
      chunks.push(...extractChunks(tree, code, file));
    }
    console.log(`parsed ${files.length} files → ${chunks.length} chunks`);

    const db = await getDb();
    const col = db.collection("chunks");
    await col.deleteMany({ repo });

    let done = 0;
    for (const c of chunks) {
      const embedding = await embed(EMBED_TEXT(c));
      await col.insertOne({ ...c, repo, embedding });
      if (++done % 20 === 0) console.log(`embedded ${done}/${chunks.length}`);
    }

    console.log(`stored ${done} chunks for ${repo}`);
    return done;
  } finally {
    await cleanupRepo(dir);
  }
}
