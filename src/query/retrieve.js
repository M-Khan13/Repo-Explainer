import { embed } from "../embed/embed.js";
import { getDb } from "../db/mongo.js";
import { cosineSimilarity } from "./similarity.js";

export async function retrieve(question, repo, k = 6) {
  const qVec = await embed(question);

  const db = await getDb();
  const chunks = await db.collection("chunks").find({ repo }).toArray();

  return chunks
    .map((c) => ({ ...c, score: cosineSimilarity(qVec, c.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}