import { MongoClient } from "mongodb";

const uri = process.env.MONGO_URI;
let client;

export async function getDb() {
  if (!client) {
    client = new MongoClient(uri);
    await client.connect();
  }
  return client.db("repo_explainer");
}

export async function closeDb() {
  if (client) await client.close();
}
