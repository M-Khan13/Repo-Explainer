import { readdir } from "node:fs/promises";
import path from "node:path";

const SKIP_DIRS = new Set([
  ".git", "node_modules", "dist", "build", ".next",
  "coverage", "venv", "__pycache__", ".venv",
]);

const KEEP_EXTS = new Set([
  ".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".py",
]);

export async function walkRepo(root) {
  const files = [];

  async function recurse(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        await recurse(full);
      } else if (entry.isFile()) {
        if (!KEEP_EXTS.has(path.extname(entry.name))) continue;
        files.push(path.relative(root, full));
      }
    }
  }

  await recurse(root);
  return files;
}