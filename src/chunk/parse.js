import Parser from "web-tree-sitter";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const wasmDir = path.dirname(require.resolve("tree-sitter-wasms/package.json"));

let parser;

async function getParser() {
  if (parser) return parser;
  await Parser.init();
  parser = new Parser();
  const JS = await Parser.Language.load(
    path.join(wasmDir, "out", "tree-sitter-javascript.wasm")
  );
  parser.setLanguage(JS);
  return parser;
}

export async function parseCode(code) {
  const p = await getParser();
  return p.parse(code);
}