import type {
  RewriteResult,
  StructuralRecommendation,
  StructuralRecommendationKind,
} from "@/lib/models/audit";
import { DiffView } from "./diff-view";
import { InfoTip } from "./info-tip";

const KIND_LABEL: Record<StructuralRecommendationKind, string> = {
  "heading-insert": "Heading: insert",
  "heading-edit": "Heading: edit",
  "summary-box": "Summary box",
  "comparison-block": "Comparison block",
  "callout-promotion": "Callout promotion",
  "schema-markup": "Schema.org markup",
  "internal-anchor": "Internal anchors",
};

const KIND_TONE: Record<StructuralRecommendationKind, string> = {
  "heading-insert": "bg-indigo-50 text-indigo-800 border-indigo-200",
  "heading-edit": "bg-indigo-50 text-indigo-800 border-indigo-200",
  "summary-box": "bg-sky-50 text-sky-800 border-sky-200",
  "comparison-block": "bg-amber-50 text-amber-800 border-amber-200",
  "callout-promotion": "bg-fuchsia-50 text-fuchsia-800 border-fuchsia-200",
  "schema-markup": "bg-emerald-50 text-emerald-800 border-emerald-200",
  "internal-anchor": "bg-zinc-100 text-zinc-800 border-zinc-200",
};

function anchorLabel(rec: StructuralRecommendation): string | null {
  if (rec.anchorKind === "none" || rec.anchorIndex < 0) return null;
  if (rec.anchorKind === "after-heading") return `after heading #${rec.anchorIndex}`;
  if (rec.anchorKind === "before-paragraph") return `before ¶${rec.anchorIndex}`;
  return `after ¶${rec.anchorIndex}`;
}

function isCodeLike(kind: StructuralRecommendationKind): boolean {
  return kind === "schema-markup" || kind === "comparison-block";
}

type Props = {
  rewrite: RewriteResult;
  originalIntro: string;
};

export function RewritePanel({ rewrite, originalIntro }: Props) {
  return (
    <section className="rounded-lg border p-4 space-y-4">
      <header className="flex items-center gap-2">
        <h2 className="text-sm font-semibold">Suggested edits</h2>
        <InfoTip text="Targeted in-place edits aimed at the lowest-scoring features. Red strikethrough = remove; green underline = add. Bullet and FAQ blocks are net-new additions and shown all-green." />
      </header>
      <p className="text-xs text-zinc-600">
        GitHub-style word-level diff. The intro shows your current paragraph with proposed edits applied; the bullet and FAQ blocks are new sections to add.
      </p>

      <section>
        <div className="mb-1 flex items-center gap-1.5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Intro paragraph
          </h3>
          <InfoTip text="The current first paragraph from the page, with proposed edits shown inline. Answer engines often lift this verbatim, so it pays to make it self-contained and topic-explicit." />
        </div>
        <DiffView
          before={originalIntro}
          after={rewrite.revisedIntro}
          emptyBeforeMessage="No detectable lead paragraph on the page — this would be a new addition."
        />
      </section>

      {rewrite.paragraphEdits.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-1.5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Paragraph edits ({rewrite.paragraphEdits.length})
            </h3>
            <InfoTip text="Surgical edits to specific weak paragraphs in the page, picked by the model from the lowest-scoring sections. Each is a word-level diff against the original paragraph." />
          </div>
          <ul className="space-y-3">
            {rewrite.paragraphEdits.map((edit, i) => (
              <li key={i} className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="font-mono text-zinc-500">
                    Paragraph #{edit.paragraphIndex}
                  </span>
                  <span className="italic text-zinc-600">{edit.rationale}</span>
                </div>
                <DiffView
                  before={edit.before}
                  after={edit.after}
                  emptyBeforeMessage="Original paragraph not found on page — treating as a new addition."
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {rewrite.structuralRecommendations.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-1.5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Structural recommendations ({rewrite.structuralRecommendations.length})
            </h3>
            <InfoTip text="Page-level structural changes (headings, summary boxes, comparison tables, schema.org markup, etc.) that aren't a single text edit. Each recommendation is anchored to a real paragraph or heading when applicable." />
          </div>
          <ul className="space-y-3">
            {rewrite.structuralRecommendations.map((rec, i) => {
              const anchor = anchorLabel(rec);
              return (
                <li key={i} className="rounded-md border bg-white p-3 text-sm">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${KIND_TONE[rec.kind]}`}
                    >
                      {KIND_LABEL[rec.kind]}
                    </span>
                    {anchor && (
                      <span className="font-mono text-[10px] text-zinc-500">
                        {anchor}
                      </span>
                    )}
                  </div>
                  <div className="font-medium text-zinc-900">{rec.title}</div>
                  <p className="mt-1 text-xs text-zinc-600">{rec.description}</p>
                  {rec.proposedContent && rec.proposedContent.trim() && (
                    <div className="mt-2">
                      {isCodeLike(rec.kind) ? (
                        <pre className="overflow-auto rounded border border-zinc-200 bg-zinc-50 p-2 text-[11px] text-zinc-800">
                          {rec.proposedContent}
                        </pre>
                      ) : (
                        <div className="rounded border border-green-200 bg-green-50 p-2 text-xs text-green-900">
                          {rec.proposedContent}
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section>
        <div className="mb-1 flex items-center gap-1.5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Bullet block (add)
          </h3>
          <InfoTip text="A short scannable list to add somewhere prominent. Bullets are easier for answer engines to lift verbatim than long prose." />
        </div>
        <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm">
          <ul className="list-disc pl-5 text-green-900">
            {rewrite.bulletBlock.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </div>
      </section>

      <section>
        <div className="mb-1 flex items-center gap-1.5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            FAQ block (add)
          </h3>
          <InfoTip text="A short Q&A section to add. Question-shaped headings often map directly onto user queries that answer engines try to match." />
        </div>
        <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm">
          <dl className="space-y-2 text-green-900">
            {rewrite.faqBlock.map((qa, i) => (
              <div key={i}>
                <dt className="font-medium">{qa.q}</dt>
                <dd>{qa.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </section>
  );
}
