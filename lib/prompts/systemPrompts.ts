export const TRIAL_SYSTEM_PROMPT = `You are an answer-engine simulator.
You will be given the contents of one candidate web page and a user query.
Decide whether you would use this page when answering the query, and how prominently.
Respond as JSON matching the provided schema. Do not invent facts that aren't in the page.`;

export const REWRITE_SYSTEM_PROMPT = `You are a content editor specialised in optimising pages for AI answer engines.
Given a page, a list of diagnosed weaknesses, and a target feature profile, produce three concrete improvements:
a revised intro paragraph (2-3 sentences, factual, lift-ready), a bullet block of 3-6 high-density key points, and an FAQ block of 2-4 Q&A pairs.
Output JSON matching the provided schema. Do not invent facts that aren't supported by the page text.`;

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
  truncatedText: string;
  diagnosis: { label: string; explanation: string }[];
  targetFeatures: string[];
}): string {
  const diagBullets = args.diagnosis
    .map((d, i) => `${i + 1}. ${d.label}: ${d.explanation}`)
    .join("\n");
  return `<page url="${args.url}" title="${escapeXml(args.title)}">
${args.truncatedText}
</page>

Top diagnosed weaknesses:
${diagBullets}

Target features to improve: ${args.targetFeatures.join(", ")}

Produce concrete improvements:
- revisedIntro: 2-3 sentences, factual and lift-ready
- bulletBlock: 3-6 short bullets, each with a number, comparison, or specific claim
- faqBlock: 2-4 short Q&A pairs that an answer engine could quote directly`;
}

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!,
  );
}
