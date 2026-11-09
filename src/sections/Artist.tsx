import { ResponsiveImage } from '../components/ui/ResponsiveImage';
import { ARTIST } from '../data/artist';
import { useSiteContent } from '../hooks/useSiteContent';
import './Artist.css';

const two = (n: number) => String(n).padStart(2, '0');

/**
 * The person behind the work - the first of the site's two ink chapters.
 * After a page of paper and prints the stock turns black: the studio at
 * night. His portrait is lit low, from one side, on a deep navy backdrop,
 * and has no frame: its edges dissolve into the ink (Artist.css), so he
 * stands in the chapter rather than in a picture of it. The words stand
 * beside it in paper-white, set like a book's chapter opener, across a fine
 * burgundy rule.
 *
 * Only known facts are shown (data/artist.ts, the dashboard's site content).
 * His own introduction is a marked slot in development until he writes it -
 * production shows nothing there, and the chapter is complete without it.
 *
 * Wide screens: portrait left (bleeding to the edge), words right.
 * Narrower: portrait first, full width, then the words. Keeps the #studio
 * anchor the masthead links to.
 *
 * Behind him, his name: YOUNES set like the hero's (the O and E in
 * burgundy), faint, across the top of the portrait's column. It sits
 * behind the photograph - the cap rises in front of it, and the face is
 * always clear of it - and drifts a little sideways as the chapter passes
 * (Artist.css); it stands still under reduced motion.
 */
export function Artist() {
  const { label, headline, meta, intro } = useSiteContent().content.artist;
  const { name, portrait } = ARTIST;

  return (
    <section
      id="studio"
      data-ink=""
      aria-labelledby="artistHeading"
      className="relative overflow-x-clip bg-ink text-paper desktop:grid desktop:min-h-[min(100svh,58rem)] desktop:grid-cols-12"
    >
      {/* his name sits above the photograph's top edge, which fades into the ink. The photograph starts about two
          thirds of the way down the letters (their height is a set share of the width), so the cap rises in front of them */}
      <figure className="relative m-0 pt-[calc(clamp(4.75rem,13vw,5.5rem)+13vw)] tablet:pt-[calc(5.5rem+13vw)] desktop:col-span-7 desktop:pt-0">
        <Signature />
        <ResponsiveImage
          image={portrait.image}
          alt={portrait.alt}
          sizes="(min-width: 1100px) 58vw, 100vw"
          className="artist-portrait relative z-1 block aspect-[4/5] w-full object-cover object-[40%_0%] tablet:aspect-[5/4]"
        />
        {/* the rule between portrait and words: a fine burgundy line, with a point at its middle */}
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-[clamp(5.5rem,12vh,7.5rem)] right-0 z-2 hidden w-px bg-burgundy-light/35 desktop:block">
          <span className="absolute top-1/2 left-1/2 size-1.75 -translate-1/2 rounded-full bg-burgundy-light" />
        </span>
        <figcaption className="absolute bottom-[clamp(1rem,3vh,2rem)] left-page-x z-2 type-meta text-paper-soft">
          {name} · {meta[1]}
        </figcaption>
      </figure>

      <div className="relative z-2 flex flex-col px-page-x py-[clamp(3.5rem,10vh,7rem)] desktop:col-span-5 desktop:py-[clamp(5rem,14vh,9rem)] desktop:pr-page-x desktop:pl-[clamp(2.5rem,4.5vw,4.5rem)]">
        {/* a chapter opener, not a section label: its number in the run of the page */}
        <p className="flex items-baseline gap-4 type-meta text-paper-muted">
          <span className="font-serif text-[clamp(1.6rem,2.4vw,2.2rem)] leading-none tracking-normal text-burgundy-light normal-case">03</span>
          <span aria-hidden="true" className="h-px w-6 self-center bg-burgundy-light/60" />
          <span>{label}</span>
        </p>
        <h2 id="artistHeading" className="mt-[clamp(1.5rem,4vh,2.5rem)] max-w-[13ch] font-serif text-[clamp(2.6rem,5.2vw,4.6rem)] leading-[1.02] tracking-[-0.012em] text-balance">
          {headline}
        </h2>

        {intro.length > 0 ? (
          <div className="mt-[clamp(1.75rem,4vh,2.5rem)] grid gap-5">
            {intro.map((paragraph) => (
              <p key={paragraph} className="max-w-[36ch] font-serif text-lede text-paper-soft">
                {paragraph}
              </p>
            ))}
          </div>
        ) : (
          import.meta.env.DEV && (
            <p className="mt-8 max-w-[40ch] border border-dashed border-paper/30 px-4 py-3 text-micro leading-copy text-paper-soft">
              Placeholder, shown in development only: Younes’s introduction, in his own words (two short paragraphs), goes in
              src/data/artist.ts (intro) or the studio’s Website page. Production shows nothing here until it is written.
            </p>
          )
        )}

        <p className="mt-[clamp(1.75rem,4vh,2.5rem)] font-serif text-[clamp(1.6rem,2.4vw,2.1rem)] text-burgundy-light italic">&mdash; {name}</p>

        {/* the facts, as a printer's colophon: numbered, ruled */}
        <ol className="mt-auto pt-[clamp(2.5rem,7vh,4rem)]" aria-label={`About ${name}`}>
          {meta.map((fact, i) => (
            <li key={fact} className="flex items-baseline gap-5 border-t border-paper/15 py-3.5 last:border-b">
              <span aria-hidden="true" className="type-meta text-paper-muted">{two(i + 1)}</span>
              <span className="type-label text-paper">{fact}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/*
 * YOUNES as a watermark - the hero's setting (Bodoni Moda, 'opsz' 96,
 * weight 500, tracking -0.035em), in its own units at font-size 100: the
 * ink runs from 1 to 383.5 across, the capitals stand 76 high (1.5 more for
 * the round letters' overshoot). Narrow screens: 4% wider than the page and
 * centred on it, so its drift (Artist.css) never opens a gap at either edge.
 * Wide screens: inside the portrait's column, clear of the rule. Either way
 * it starts below the fixed masthead and ends behind the cap.
 */
const SIG = { left: 1, width: 382.5, cap: 76, height: 77.5 };

function Signature() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox={`0 0 ${SIG.width} ${SIG.height}`}
      className="artist-signature pointer-events-none absolute top-[clamp(4.75rem,13vw,5.5rem)] -left-[2%] z-0 block h-auto w-[104%] max-w-none select-none tablet:top-[5.5rem] tablet:left-[5%] tablet:w-[90%] desktop:top-[clamp(6rem,14vh,8.5rem)] desktop:left-[4%]"
    >
      <text
        x={-SIG.left}
        y={SIG.cap}
        className="fill-paper font-serif text-[100px] font-medium tracking-[-0.035em] [fill-opacity:0.065] [font-variation-settings:'opsz'_96]"
      >
        Y<tspan className="fill-burgundy-light [fill-opacity:0.24]">O</tspan>UN<tspan className="fill-burgundy-light [fill-opacity:0.24]">E</tspan>S
      </text>
    </svg>
  );
}
