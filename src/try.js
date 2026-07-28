import "dotenv/config";
import { retrieve } from "./query/retrieve.js";
import { closeDb } from "./db/mongo.js";

const hits = await retrieve("how are orders created", "cafe-ops");
for (const h of hits) {
  console.log(h.score.toFixed(3), `${h.filePath}:${h.startLine}-${h.endLine}`, h.symbol);
}

await closeDb();