type Props = {
  text: string;
  className?: string;
};

export function InfoTip({ text, className = "" }: Props) {
  return (
    <span className={`group relative inline-flex items-center ${className}`}>
      <span
        aria-hidden
        className="flex h-3.5 w-3.5 cursor-help select-none items-center justify-center rounded-full border border-zinc-300 text-[9px] font-medium leading-none text-zinc-500"
      >
        i
      </span>
      <span
        role="tooltip"
        className="pointer-events-none invisible absolute bottom-full left-1/2 z-20 mb-1.5 w-64 -translate-x-1/2 rounded-md bg-zinc-900 px-2.5 py-1.5 text-left text-xs font-normal leading-snug text-zinc-100 opacity-0 shadow-md transition group-hover:visible group-hover:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}
