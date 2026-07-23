import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const run = promisify(execFile);

export async function cloneRepo(url) {
  const dir = await mkdtemp(path.join(tmpdir(), "repo-explainer-"));
  await run("git", ["clone", "--depth", "1", url, dir]);
  return dir;
}

export async function cleanupRepo(dir) {
  await rm(dir, { recursive: true, force: true });
}