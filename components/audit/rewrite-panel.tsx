import type { RewriteResult } from "@/lib/models/audit";
import { DiffView } from "./diff-view";
import { InfoTip } from "./info-tip";

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
