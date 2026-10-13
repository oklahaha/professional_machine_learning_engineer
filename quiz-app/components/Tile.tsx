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
      className="holo-card lift group animate-cell-in flex flex-col rounded-lg p-5 focus-visible:border-signal sm:p-6"
    >
      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-mist">
        <span aria-hidden className="neon-glyph">{glyph}</span>
        {kicker}
      </div>
      <h2 className="neon-title mt-3 font-display text-xl font-semibold tracking-tight sm:text-2xl">
        {title}
      </h2>
      <p className="mt-2 flex-1 font-sans text-sm leading-relaxed text-mist">{blurb}</p>
      <dl className="mt-5 flex flex-wrap gap-x-6 gap-y-2 font-mono">
        {stats.map((s) => (
          <div key={s.label}>
            <dt className="text-[10px] uppercase tracking-widest text-mist">{s.label}</dt>
            <dd className="text-lg font-semibold tabular-nums text-signal [text-shadow:0_0_10px_rgba(46,230,255,0.5)]">{s.value}</dd>
          </div>
        ))}
      </dl>
      <span className="mt-5 font-mono text-sm uppercase tracking-widest text-signal transition group-hover:translate-x-1 group-hover:[text-shadow:0_0_10px_rgba(46,230,255,0.9)]">
        open →
      </span>
    </Link>
  );
}
