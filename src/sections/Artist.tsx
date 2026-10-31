import { Fragment } from 'react';
import { Reveal } from '../components/ui/Reveal';
import { ResponsiveImage } from '../components/ui/ResponsiveImage';
import { ScrollRevealText } from '../components/ui/ScrollRevealText';
import { ARTIST } from '../data/artist';
import { useSiteContent } from '../hooks/useSiteContent';

/**
 * The person behind the work, straight after the archive: his portrait,
 * shown whole and printed on the page with crop marks, and a turn of phrase
 * from the prints to the man who made them. Words come from data/artist.ts - only known
 * facts today; his own introduction is a marked slot until he writes it.
 *
 * Wide screens set the (landscape) portrait left and the words right;
 * narrower ones read headline, portrait, then the rest. Keeps the #studio anchor the masthead links to.
 */
export function Artist() {
  // the words from the site's content (data/siteContent.ts); the name and portrait are his own
  const { label, headline, meta, intro } = useSiteContent().content.artist;
  const { name, portrait } = ARTIST;

  return (
    <section
      id="studio"
      aria-labelledby="artistHeading"
      // Book, next, opens with its own wide margin: only a little here
      className="relative mt-[clamp(2rem,6vh,4rem)] bg-paper-stone px-page-x py-[clamp(4rem,11vh,7.5rem)]"
    >
      {/* the turn of a page: the person on their own stone-grey stock after the work */}
      <Reveal className="mx-auto grid max-w-page gap-x-[clamp(2rem,6vw,6rem)] gap-y-[clamp(1.75rem,5vw,2.75rem)] desktop:grid-cols-12">
        <header className="desktop:col-span-5 desktop:col-start-8 desktop:row-start-1 desktop:self-end">
          <p className="type-eyebrow text-burgundy">{label}</p>
          {/* the line settles from faint to full ink as it moves up the screen */}
          <ScrollRevealText as="h2" id="artistHeading" text={headline} from={0.5} className="mt-4 max-w-[16ch] type-heading text-headline" />
        </header>

        <figure className="w-full tablet:w-[86%] desktop:col-span-7 desktop:col-start-1 desktop:row-span-2 desktop:row-start-1 desktop:w-[min(100%,calc(72vh*1.25))] desktop:justify-self-start">
          <div className="relative bg-paper-light p-[clamp(10px,1.4vw,20px)]">
            <ResponsiveImage
              image={portrait.image}
              alt={portrait.alt}
              sizes="(max-width: 699px) 100vw, (max-width: 1099px) 86vw, 56vw"
              className="block h-auto w-full"
            />
            <CropMarks />
          </div>
          <figcaption className="mt-4 flex justify-between gap-6 type-meta text-ink-soft">
            <span>{name}</span>
            <span>{meta[1]}</span>
          </figcaption>
        </figure>

        <div className="flex flex-col gap-5 desktop:col-span-5 desktop:col-start-8 desktop:row-start-2 desktop:self-start">
          {intro.length > 0 ? (
            // his own words, revealed the same way (from 65%: body text stays 4.5:1 from the start)
            intro.map((paragraph) => (
              <ScrollRevealText key={paragraph} text={paragraph} from={0.65} className="max-w-[34ch] font-serif text-lede text-ink" />
            ))
          ) : (
            import.meta.env.DEV && (
              <p className="max-w-[40ch] border border-dashed border-rule px-4 py-3 text-micro leading-copy text-ink-soft">
                Placeholder, shown in development only: Younes’s introduction, in his own words, goes in
                src/data/artist.ts (intro). Production shows nothing here until it is written.
              </p>
            )
          )}
          <p className="font-serif text-title text-burgundy-deep italic">&mdash; {name}</p>
          <p className="type-meta text-ink-soft">
            {/* a fact never breaks in two; the line breaks between them */}
            {meta.map((fact, i) => (
              <Fragment key={fact}>
                {i > 0 && ' · '}
                <span className="whitespace-nowrap">{fact}</span>
              </Fragment>
            ))}
          </p>
        </div>
      </Reveal>
    </section>
  );
}

/** printer's crop marks at the corners, just off the print */
function CropMarks() {
  const mark = 'pointer-events-none absolute size-3 border-ink/45';
  return (
    <span aria-hidden="true">
      <span className={`${mark} -top-2 -left-2 border-t border-l`} />
      <span className={`${mark} -top-2 -right-2 border-t border-r`} />
      <span className={`${mark} -bottom-2 -left-2 border-b border-l`} />
      <span className={`${mark} -right-2 -bottom-2 border-r border-b`} />
    </span>
  );
}
