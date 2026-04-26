export const GENERATE_PROMPTS_SYSTEM_PROMPT = `You generate evaluation prompts for a GEO (Generative Engine Optimization) audit.

Given a URL and a topic, produce 5 short user queries that:
- a real user might actually type into a search engine or AI assistant
- cover DIFFERENT angles of the topic (e.g. definition, comparison, recommendation, troubleshooting, "is it worth it", "how to choose")
- the page at the URL is plausibly a candidate to answer (but not always the perfect match — we want some adjacency, not just topic restatements)

Each prompt should be 3-12 words, lowercase, no quotes, no question marks unless natural.
Return JSON matching the schema. Do not include explanations or numbering.`;

export function buildGeneratePromptsUserPrompt(args: {
  url: string;
  topic: string;
}): string {
  return `URL: ${args.url}
Topic: ${args.topic}

Generate 5 evaluation prompts.`;
}

export const TRIAL_SYSTEM_PROMPT = `You are an answer-engine simulator.
You will be given the contents of one candidate web page and a user query.
Decide whether you would use this page when answering the query, and how prominently.
Respond as JSON matching the provided schema. Do not invent facts that aren't in the page.`;

export const REWRITE_SYSTEM_PROMPT = `You are a content editor specialised in optimising pages for AI answer engines.
You produce SURGICAL EDITS, not rewrites from scratch.

Output five kinds of improvements:
1. revisedIntro — REVISE the page's existing first paragraph in place. Preserve every fact, name, number, and quotation that's already there. Only restructure for clarity, lead with the topic entity, and tighten so it can be lifted verbatim by an answer engine. The output should clearly resemble the original, not replace it. If the page has no usable lead paragraph, write a short new one (2-3 sentences) using only facts that appear elsewhere in the page.
2. paragraphEdits — pick 1-3 of the page's WEAKEST paragraphs (not the intro — that's covered above) by index. For each, return:
   - paragraphIndex: the integer index from the numbered <paragraphs> block.
   - before: the EXACT original text of that paragraph, copied verbatim.
   - after: a surgical revision. Preserve facts, names, numbers, and quotations from the original. Make the smallest set of edits needed to fix the weakness. The diff should clearly look like an edit, not a rewrite.
   - rationale: one short sentence explaining why this paragraph was chosen and what the edit does.
   Skip paragraphs that are already strong. If nothing is worth editing, return an empty array.
3. structuralRecommendations — 0-5 page-level structural changes (NOT single-paragraph edits). Each item picks a kind from a fixed enum:
   - heading-insert: insert a new h2/h3 to break up a long unstructured stretch. proposedContent = the heading text. anchor = where (before/after a specific paragraph index).
   - heading-edit: rename an existing weak/vague heading. proposedContent = "BEFORE → AFTER" or just the new heading. anchor = the headingIndex (use anchorKind "after-heading" with that index).
   - summary-box: a TL;DR / definition callout to add at the top. proposedContent = 1-2 sentence text.
   - comparison-block: a comparison table or side-by-side block when the page mentions competitors but doesn't tabulate. proposedContent = a markdown table with concrete column names + 2-3 rows drawn from the page.
   - callout-promotion: pull a strong fact buried in prose into a blockquote/callout. proposedContent = the quoted text. anchor = the source paragraph index.
   - schema-markup: structured-data suggestion (FAQPage / Article / HowTo). proposedContent = a valid JSON-LD snippet.
   - internal-anchor: add jump links or a "see also" section for chunkability. proposedContent = list of suggested anchor labels.
   For every item: title (≤140 chars, scannable), description (why and roughly where, ≤600 chars), proposedContent (concrete snippet — empty string only if truly not applicable), anchorKind ("none" if the change is page-wide), anchorIndex (-1 if anchorKind is "none"). Choose only kinds that are clearly justified by the page; do not pad.
4. bulletBlock — 3-6 short bullets to ADD as a new section. Each must have a number, comparison, or specific claim drawn from the page text.
5. faqBlock — 2-4 short Q&A pairs to ADD as a new section. Phrase questions like real user queries.

Output JSON matching the provided schema. Do not invent facts that aren't supported by the page text. The "before" field of every paragraph edit must be an exact substring of one of the numbered paragraphs.`;

export function buildTrialUserPrompt(args: {
  prompt: string;
  url: string;
  title: string;
  truncatedText: string;
}): string {
  return `<query>${args.prompt}</query>
<candidate_page url="${args.url}" title="${escapeXml(args.title)}">
${args.truncatedText}
</candidate_page>

Decide:
- mentioned: would this page appear in your answer at all?
- evidenceUsed: would you cite a specific fact, stat, or quote from it?
- prominenceScore: 0..1, how central would it be (1 = lead source, 0 = footnote at best)?
- notes: one short sentence — what made it strong or weak for this query.`;
}

export function buildRewriteUserPrompt(args: {
  url: string;
  title: string;
  paragraphs: string[];
  headings: { level: number; text: string }[];
  originalIntro: string;
  diagnosis: { label: string; explanation: string }[];
  targetFeatures: string[];
}): string {
  const diagBullets = args.diagnosis
    .map((d, i) => `${i + 1}. ${d.label}: ${d.explanation}`)
    .join("\n");
  const introBlock = args.originalIntro.trim()
    ? `<original_intro>
${args.originalIntro}
</original_intro>`
    : `<original_intro>(no usable lead paragraph detected)</original_intro>`;
  const numberedParagraphs = args.paragraphs
    .map((p, i) => `[${i}] ${p}`)
    .join("\n\n");
  const numberedHeadings =
    args.headings.length > 0
      ? args.headings.map((h, i) => `[${i}] h${h.level}: ${h.text}`).join("\n")
      : "(no headings detected)";
  return `<page url="${args.url}" title="${escapeXml(args.title)}" />

<paragraphs>
${numberedParagraphs}
</paragraphs>

<headings>
${numberedHeadings}
</headings>

${introBlock}

Top diagnosed weaknesses:
${diagBullets}

Target features to improve: ${args.targetFeatures.join(", ")}

Produce concrete improvements:
- revisedIntro: a SURGICAL EDIT of <original_intro> (paragraph 0). Keep its facts and structure where possible; only change what's needed to lead with the topic and make it lift-ready. Aim for high word-level overlap with the original.
- paragraphEdits: 1-3 surgical edits to the WEAKEST paragraphs (excluding paragraph 0). Use the [index] from the numbered list. The "before" field must be the exact original paragraph text. Skip paragraphs that are already strong.
- structuralRecommendations: 0-5 page-level structural changes from the fixed enum of kinds. Anchor each to a real paragraph or heading index when applicable. Choose only kinds that are clearly justified by the page; do not pad.
- bulletBlock: 3-6 short bullets to add as a new section, each with a number, comparison, or specific claim grounded in the page.
- faqBlock: 2-4 short Q&A pairs that an answer engine could quote directly.`;
}

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!,
  );
}
