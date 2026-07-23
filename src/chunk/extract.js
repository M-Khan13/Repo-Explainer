import path from "node:path";

const DECL_TYPES = new Set([
  "function_declaration",
  "generator_function_declaration",
  "class_declaration",
  "lexical_declaration",
  "variable_declaration",
]);

function getName(node) {
  const direct = node.childForFieldName("name");
  if (direct) return direct.text;

  // const foo = () => {}  →  descend to the declarator
  const declarator = node.namedChildren.find(
    (c) => c.type === "variable_declarator"
  );
  return declarator?.childForFieldName("name")?.text ?? null;
}

export function extractChunks(tree, code, filePath) {
  const chunks = [];

  for (const child of tree.rootNode.children) {
    // unwrap `export function foo()` → `function foo()`
    const node =
      child.type === "export_statement"
        ? child.namedChildren.find((c) => DECL_TYPES.has(c.type)) ?? child
        : child;

    if (!DECL_TYPES.has(node.type)) continue;

    const name = getName(node);
    if (!name) continue;

    chunks.push({
      filePath,
      language: "javascript",
      symbol: name,
      type: node.type,
      startLine: child.startPosition.row + 1,
      endLine: child.endPosition.row + 1,
      code: code.slice(child.startIndex, child.endIndex),
    });
  }

  return chunks;
}