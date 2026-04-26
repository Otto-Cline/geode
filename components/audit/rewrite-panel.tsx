import type { RewriteResult } from "@/lib/models/audit";

export function RewritePanel({ rewrite }: { rewrite: RewriteResult }) {
  return (
    <div className="rounded-lg border p-4 space-y-4">
      <h2 className="text-sm font-semibold">Suggested rewrites</h2>
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Revised intro
        </h3>
        <p className="mt-1 text-sm">{rewrite.revisedIntro}</p>
      </section>
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Bullet block
        </h3>
        <ul className="mt-1 list-disc pl-5 text-sm">
          {rewrite.bulletBlock.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      </section>
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          FAQ block
        </h3>
        <dl className="mt-1 space-y-2 text-sm">
          {rewrite.faqBlock.map((qa, i) => (
            <div key={i}>
              <dt className="font-medium">{qa.q}</dt>
              <dd className="text-zinc-700">{qa.a}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
