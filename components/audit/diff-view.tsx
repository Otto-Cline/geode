import { diffWordsWithSpace } from "diff";

type Props = {
  before: string;
  after: string;
  emptyBeforeMessage?: string;
};

export function DiffView({ before, after, emptyBeforeMessage }: Props) {
  if (!before.trim()) {
    return (
      <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm">
        {emptyBeforeMessage && (
          <p className="mb-2 text-xs italic text-zinc-500">
            {emptyBeforeMessage}
          </p>
        )}
        <span className="whitespace-pre-wrap text-green-900">{after}</span>
      </div>
    );
  }
  const parts = diffWordsWithSpace(before, after);
  return (
    <div className="rounded-md border bg-white p-3 text-sm leading-relaxed">
      {parts.map((p, i) => {
        if (p.added) {
          return (
            <span
              key={i}
              className="rounded bg-green-100 text-green-900 underline decoration-green-400/60 decoration-1 underline-offset-2"
            >
              {p.value}
            </span>
          );
        }
        if (p.removed) {
          return (
            <span
              key={i}
              className="rounded bg-red-100 text-red-900 line-through decoration-red-500/60"
            >
              {p.value}
            </span>
          );
        }
        return (
          <span key={i} className="text-zinc-800">
            {p.value}
          </span>
        );
      })}
    </div>
  );
}
