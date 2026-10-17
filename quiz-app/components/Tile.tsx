import Link from "next/link";

type Props = {
  href: string;
  glyph: string;
  title: string;
  subtitle: string; // one plain line under the title: what kind of source or mode this is
  blurb: string;
  stats: { label: string; value: number | string }[];
  action: string; // the button's words: what opening the tile does
};

/** A big pickable card: the source chooser on `/` and the mode chooser on `/dsai`. */
export default function Tile({ href, glyph, title, subtitle, blurb, stats, action }: Props) {
  return (
    <Link
      href={href}
      className="holo-card lift group animate-cell-in flex flex-col rounded-lg p-6 focus-visible:border-signal sm:p-8"
    >
      <div className="flex items-start gap-3">
        <span aria-hidden className="neon-glyph mt-1 text-xl">
          {glyph}
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-paper sm:text-[28px]">
            {title}
          </h2>
          <p className="hud-label mt-1">{subtitle}</p>
        </div>
      </div>

      <p className="mt-5 flex-1 font-sans text-base leading-relaxed text-paperdim">{blurb}</p>

      <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-3">
        {stats.map((s) => (
          <div key={s.label} className="flex flex-col-reverse">
            <dt className="hud-label">{s.label}</dt>
            <dd className="hud-figure text-3xl text-signal">{s.value}</dd>
          </div>
        ))}
      </dl>

      <span className="btn-cyber btn-neon mt-7 self-start px-5 py-2.5 text-sm">
        {action}
        <span aria-hidden className="transition-transform group-hover:translate-x-1">
          →
        </span>
      </span>
    </Link>
  );
}
