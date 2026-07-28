import "dotenv/config";
import { retrieve } from "./query/retrieve.js";
import { generate } from "./query/generate.js";
import { closeDb } from "./db/mongo.js";

const q = "what fields does the Order schema have";
const hits = await retrieve(q, "cafe-ops");
console.log("hits:", hits.length);
console.log("first hit code length:", hits[0]?.code?.length);
console.log("---");
console.log(await generate(q, hits));
console.log(hits.map(h => `${h.filePath}:${h.startLine}-${h.endLine} ${h.symbol} (${h.code.length}c)`));

await closeDb();