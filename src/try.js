import { cloneRepo, cleanupRepo } from "./ingest/clone.js";
import { walkRepo } from "./ingest/walk.js";

const dir = await cloneRepo("https://github.com/M-Khan13/Cafe-opps");
try {
  const files = await walkRepo(dir);
  console.log(files);
  console.log("total:", files.length);
} finally {
  await cleanupRepo(dir);
}