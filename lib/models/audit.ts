import { z } from "zod";

export const AuditInputSchema = z.object({
  url: z.url(),
  topic: z.string().min(1),
  prompts: z.array(z.string().min(1)).min(1).max(20),
  runsPerPrompt: z.number().int().min(1).max(10).default(3),
});
export type AuditInput = z.infer<typeof AuditInputSchema>;

export type ExtractedPage = {
  url: string;
  title: string;
  metaDescription?: string;
  headings: { level: number; text: string }[];
  paragraphs: string[];
  lists: string[][];
  tables: string[][];
  outboundLinkCount: number;
  sameDomainLinkCount: number;
  fullText: string;
};

export type PageFeatures = {
  hasIntroSummary: number;
  headingDepthScore: number;
  listDensity: number;
  contentLengthScore: number;
  statisticsDensity: number;
  authoritySignalDensity: number;
  externalSourceSignal: number;
  technicalTermDensity: number;
  readabilityScore: number;
  entityClarityScore: number;
};

export type CompositeFactors = {
  extractability: number;
  factualDensity: number;
  structureChunkability: number;
  authorityTrustSignals: number;
  entityKeywordClarity: number;
};

export const GeneratedPromptsSchema = z.object({
  prompts: z.array(z.string().min(3).max(200)).min(3).max(8),
});
export type GeneratedPrompts = z.infer<typeof GeneratedPromptsSchema>;

export const TrialResultSchema = z.object({
  mentioned: z.boolean(),
  evidenceUsed: z.boolean(),
  prominenceScore: z.number().min(0).max(1),
  notes: z.string().max(280),
});
export type TrialResult = z.infer<typeof TrialResultSchema>;

export type PromptTrialResult = TrialResult & {
  prompt: string;
  runIndex: number;
};

export type AggregatedPromptResult = {
  prompt: string;
  mentionRate: number;
  evidenceUseRate: number;
  avgProminence: number;
  variance: number;
};

export type AuditScores = {
  visibilityScore: number;
  stabilityScore: number;
  featureReadinessScore: number;
  geoReadinessScore: number;
};

export type DiagnosisItem = {
  label: string;
  severity: "high" | "medium" | "low";
  explanation: string;
};

export const ParagraphEditSchema = z.object({
  paragraphIndex: z.number().int().min(0),
  before: z.string(),
  after: z.string(),
  rationale: z.string().max(280),
});
export type ParagraphEdit = z.infer<typeof ParagraphEditSchema>;

export const RewriteResultSchema = z.object({
  revisedIntro: z.string(),
  paragraphEdits: z.array(ParagraphEditSchema).max(3),
  bulletBlock: z.array(z.string()).min(1).max(8),
  faqBlock: z.array(z.object({ q: z.string(), a: z.string() })).min(1).max(6),
});
export type RewriteResult = z.infer<typeof RewriteResultSchema>;

export type LedgerEntry = {
  index: number;
  model: "fast" | "smart" | "stub";
  purpose: string;
  latencyMs: number;
  tokensIn: number;
  tokensOut: number;
  costEstimateUsd: number;
};

export type AuditResponse = {
  auditId: string;
  input: AuditInput;
  page: ExtractedPage;
  features: PageFeatures;
  composites: CompositeFactors;
  trials: PromptTrialResult[];
  aggregated: AggregatedPromptResult[];
  scores: AuditScores;
  diagnosis: DiagnosisItem[];
  rewrite: RewriteResult;
  ledger: LedgerEntry[];
  totals: {
    calls: number;
    totalLatencyMs: number;
    totalCostUsd: number;
  };
  createdAt: string;
};
