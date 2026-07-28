const GEMINI_KEY = process.env.GEMINI_API_KEY;
const MODEL = "gemini-3-flash-preview";

function buildContext(hits) {
  return hits
    .map(
      (h, i) =>
        `[${i + 1}] ${h.filePath}:${h.startLine}-${h.endLine} (${h.symbol})\n${h.code}`
    )
    .join("\n\n---\n\n");
}

const SYSTEM = `You are a code explainer. Answer the question using ONLY the code context provided.
Rules:
- Explain how the code works, referencing specific files and line numbers.
- Cite sources inline with [n] markers matching the context blocks.
- If the context does not contain the answer, reply exactly: "I can't answer that from the retrieved code."
- Do not invent code or behavior not present in the context.`;

export async function generate(question, hits) {
  const context = buildContext(hits);
  const prompt = `${SYSTEM}\n\nCONTEXT:\n${context}\n\nQUESTION: ${question}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    }
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);

  const data = await res.json();
  return data.candidates[0].content.parts[0].text;
}