import type { ExtractedPage, PageFeatures } from "@/lib/models/audit";
import { clamp01 } from "@/lib/utils/stats";
import { wordCount, fleschReadingEase } from "@/lib/utils/text";

const AUTHORITY_PHRASES = [
  /\baccording to\b/gi,
  /\bstud(y|ies)\b/gi,
  /\bresearch(?:ers)?\b/gi,
  /\bsurvey\b/gi,
  /\bdata (?:from|shows?)\b/gi,
  /\b(?:dr|prof)\.\s+[A-Z]/g,
];

const STAT_PATTERNS = [
  /\d+(?:\.\d+)?\s?%/g,
  /\$\s?\d+(?:[.,]\d+)?/g,
  /\d+(?:\.\d+)?\s?(?:million|billion|bn|m|k|×|x)\b/gi,
  /\b\d{4}\b/g, // years
];

export function extractFeatures(
  page: ExtractedPage,
  topic: string,
): PageFeatures {
  const words = wordCount(page.fullText);
  const w100 = Math.max(1, words / 100);

  const hasIntroSummary = computeIntroSummary(page);
  const headingDepthScore = computeHeadingDepth(page);
  const listDensity = computeListDensity(page);
  const contentLengthScore = computeContentLength(words);
  const statisticsDensity = clamp01(
    countMatches(page.fullText, STAT_PATTERNS) / w100 / 5,
  );
  const authoritySignalDensity = clamp01(
    countMatches(page.fullText, AUTHORITY_PHRASES) / w100 / 3,
  );
  const externalSourceSignal = clamp01(
    (page.outboundLinkCount /
      Math.max(1, page.sameDomainLinkCount + page.outboundLinkCount)) *
      1.5,
  );
  const technicalTermDensity = computeTechnicalTermDensity(
    page.fullText,
    topic,
    w100,
  );
  const readabilityScore = fleschReadingEase(page.fullText);
  const entityClarityScore = computeEntityClarity(page, topic);

  return {
    hasIntroSummary,
    headingDepthScore,
    listDensity,
    contentLengthScore,
    statisticsDensity,
    authoritySignalDensity,
    externalSourceSignal,
    technicalTermDensity,
    readabilityScore,
    entityClarityScore,
  };
}

function computeIntroSummary(page: ExtractedPage): number {
  const first = page.paragraphs[0];
  if (!first) return 0;
  const w = wordCount(first);
  if (w < 40 || w > 250) return 0;
  // No question-mark heading immediately above the first paragraph.
  if (page.headings[0]?.text?.includes("?")) return 0.5;
  return 1;
}

function computeHeadingDepth(page: ExtractedPage): number {
  const levels = new Set(page.headings.map((h) => h.level));
  if (levels.has(2) && levels.has(3)) return 1;
  if (levels.has(2)) return 0.6;
  if (levels.has(1)) return 0.2;
  return 0;
}

function computeListDensity(page: ExtractedPage): number {
  const listItems = page.lists.reduce((a, l) => a + l.length, 0);
  const tableRows = page.tables.reduce((a, t) => a + t.length, 0);
  const blocks = page.paragraphs.length + listItems + tableRows;
  if (blocks === 0) return 0;
  return clamp01((listItems + tableRows) / blocks);
}

function computeContentLength(words: number): number {
  if (words < 300) return 0.2;
  if (words < 800) return 0.6;
  if (words <= 2500) return 1;
  return 0.7;
}

function countMatches(text: string, patterns: RegExp[]): number {
  let n = 0;
  for (const p of patterns) {
    const m = text.match(p);
    if (m) n += m.length;
  }
  return n;
}

function computeTechnicalTermDensity(
  text: string,
  topic: string,
  w100: number,
): number {
  const terms = topic.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  if (terms.length === 0) return 0;
  const lower = text.toLowerCase();
  let count = 0;
  for (const t of terms) {
    if (t.length < 3) continue;
    const re = new RegExp(`\\b${escapeRegex(t)}\\b`, "g");
    count += (lower.match(re) ?? []).length;
  }
  return clamp01(count / w100 / 5);
}

function computeEntityClarity(page: ExtractedPage, topic: string): number {
  const topicTerms = (topic.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(
    (t) => t.length > 2,
  );
  if (topicTerms.length === 0) return 0;
  const titleLower = (page.title ?? "").toLowerCase();
  const titleHits = topicTerms.filter((t) => titleLower.includes(t)).length;
  const lead = (page.paragraphs[0] ?? "").toLowerCase().slice(0, 600);
  const leadHits = topicTerms.filter((t) => lead.includes(t)).length;
  const titleScore = titleHits / topicTerms.length;
  const leadScore = leadHits / topicTerms.length;
  return clamp01(0.5 * titleScore + 0.5 * leadScore);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
