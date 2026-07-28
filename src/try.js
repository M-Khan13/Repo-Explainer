import "dotenv/config";
import { ingestRepo } from "./ingest/ingest.js";
import {getDb, closeDb } from "./db/mongo.js";

await ingestRepo("https://github.com/M-Khan13/Cafe-opps", "cafe-ops");
const db = await getDb();
const one = await db.collection("chunks").findOne({ repo: "cafe-ops" });
console.log(one.filePath, one.symbol, "emb:", one.embedding.length);
await closeDb();

// quick check, add before closeDb()
