import Link from "next/link";

type Props = {
  href: string;
  glyph: string;
  kicker: string; // small mono line above the title
  title: string;
  blurb: string;
  stats: { label: string; value: number | string }[];
};

/** A big pickable card: the source chooser on `/` and the mode chooser on `/dsai`. */
export default function Tile({ href, glyph, kicker, title, blurb, stats }: Props) {
  return (
    <Link
      href={href}
      className="group animate-cell-in flex flex-col rounded-2xl border border-line bg-panel/80 p-5 shadow-[0_1px_0_rgba(255,255,255,0.03)_inset,0_20px_50px_-30px_rgba(0,0,0,0.9)] transition hover:border-signal/50 hover:bg-panel2/70 focus-visible:border-signal sm:p-6"
    >
      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-mist">
        <span aria-hidden className="text-signal">{glyph}</span>
        {kicker}
      </div>
      <h2 className="mt-3 font-display text-xl font-semibold tracking-tight text-paper sm:text-2xl">
        {title}
      </h2>
      <p className="mt-2 flex-1 font-sans text-sm leading-relaxed text-mist">{blurb}</p>
      <dl className="mt-5 flex flex-wrap gap-x-6 gap-y-2 font-mono">
        {stats.map((s) => (
          <div key={s.label}>
            <dt className="text-[10px] uppercase tracking-widest text-mist">{s.label}</dt>
            <dd className="text-lg font-semibold tabular-nums text-paper">{s.value}</dd>
          </div>
        ))}
      </dl>
      <span className="mt-5 font-mono text-sm text-signal transition group-hover:translate-x-1">
        open →
      </span>
    </Link>
  );
}
