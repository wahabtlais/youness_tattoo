/**
 * The archive's heading, set like the rest of the site: plate number,
 * display title, a mono line, one sentence. Copy is a prototype draft.
 */
export function WorkArchiveIntro() {
  return (
    <header className="relative mx-auto flex max-w-page flex-col items-center px-page-x text-center">
      <p className="type-eyebrow text-burgundy">/ 02</p>
      <h2 id="workTitle" className="mt-5 font-serif text-[clamp(2.6rem,7vw,6.5rem)] leading-[0.82] font-medium tracking-[-0.03em] uppercase [font-variation-settings:'opsz'_96]">
        Selected <span className="text-burgundy-deep">w</span>orks
      </h2>
      <p className="mt-6 type-meta text-ink-muted">Original pieces / no repeats</p>
      <p className="mt-6 max-w-[34ch] font-serif text-lede text-ink-soft">
        Tattoos by Younes, hung as they left the studio. <em className="text-burgundy">Take one down</em> to look
        closer.
      </p>
      <a href="#work-archive" className="mt-8 type-label text-ink underline decoration-burgundy underline-offset-[6px]">
        View all works
      </a>
    </header>
  );
}
