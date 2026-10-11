import { gsap } from 'gsap';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type RefObject,
} from 'react';
import ropeSrc from '../../../../assets/work/rope.png';
import type { ImageAsset } from '../../../../domain/media';
import type { TattooWork } from '../../../../domain/work';
import { useReducedMotion } from '../../../../hooks/useReducedMotion';
import { Button } from '../../../ui/Button';
import { Dialog } from '../../../ui/Dialog';
import { ResponsiveImage } from '../../../ui/ResponsiveImage';
import { buildRopeTiles, drawRope, type RopeTiles } from '../ropeRenderer';
import type { PickedPrint } from '../WorkPhysicalDetail';
import { initialOrder, layoutDetail, mainPlace, ropeCurve, type DetailLayout, type PrintSize } from './layoutV2';
import { playSwap, settle, type SwapRun } from './swapTimeline';
import './workDetailV2.css';

/**
 * PROTOTYPE - Version B of the work detail (see detailVersion.ts): the
 * picked print hangs large on its own rope, the other prints smaller along
 * the same rope, its details beneath. Choosing a small print swaps the two.
 *
 * It plugs into the archive's choreography exactly as Version A does - the
 * same refs, so the same pick, direct open and return run unchanged:
 *   paperRef  the whole scene (paper, rope, small prints, details), which
 *             fades in as the print flies in and out as it flies back
 *   slotRef   the large print's paper - where the flying print lands
 * Its own motion (the swap) moves only the print boxes around those, and
 * tells the archive when another piece has become the large print.
 */

const two = (n: number) => String(n).padStart(2, '0');
/** the neutral title for a piece that has none */
const FALLBACK_TITLE = 'Tattoo study';

interface WorkDetailV2Props {
  pieces: TattooWork[];
  picked: PickedPrint | null;
  /** request to close: the archive animates the print back first */
  onClose: () => void;
  onFindSimilar: (piece: TattooWork) => void;
  /** a small print has started changing places with the large one */
  onSwitching: () => void;
  /** ...and is now the large print */
  onSwitched: (index: number) => void;
  /** a print's size as it hangs in the archive */
  archiveSize: (index: number) => PrintSize | null;
  paperRef: RefObject<HTMLDivElement | null>;
  slotRef: RefObject<HTMLDivElement | null>;
  cloneRef: RefObject<HTMLSpanElement | null>;
  titleRef: RefObject<HTMLHeadingElement | null>;
  /** the arm's WebGL canvas: above the flying print, always mounted so it is reused */
  armCanvasRef: RefObject<HTMLCanvasElement | null>;
}

export function WorkDetailV2({
  pieces,
  picked,
  onClose,
  onFindSimilar,
  onSwitching,
  onSwitched,
  archiveSize,
  paperRef,
  slotRef,
  cloneRef,
  titleRef,
  armCanvasRef,
}: WorkDetailV2Props) {
  // a close asked for mid-swap waits for the swap to land (one owner at a time)
  const swapping = useRef(false);
  const closeAfter = useRef(false);
  const requestClose = useCallback(() => {
    if (swapping.current) closeAfter.current = true;
    else onClose();
  }, [onClose]);

  return (
    <Dialog
      open={picked !== null}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        requestClose();
      }}
      labelledBy="paDetailTitle"
      className="fixed inset-0 m-0 size-full max-h-none max-w-none overflow-x-hidden overflow-y-auto bg-transparent p-0 backdrop:bg-transparent"
    >
      {picked && (
        <Scene
          pieces={pieces}
          picked={picked}
          swapping={swapping}
          closeAfter={closeAfter}
          requestClose={requestClose}
          onClose={onClose}
          onFindSimilar={onFindSimilar}
          onSwitching={onSwitching}
          onSwitched={onSwitched}
          archiveSize={archiveSize}
          paperRef={paperRef}
          slotRef={slotRef}
          titleRef={titleRef}
        />
      )}
      <canvas ref={armCanvasRef} className="pointer-events-none fixed inset-0 z-3 size-full" aria-hidden="true" />

      {picked && (
        <>
          {/* the print in flight: the same photograph that left the rope */}
          <span
            ref={cloneRef}
            className="pa-print pointer-events-none invisible z-2 opacity-0"
            style={{ position: 'absolute', '--border': `${picked.border}px` } as CSSProperties}
            aria-hidden="true"
          >
            <img src={picked.src} alt="" className="block size-full object-cover" draggable={false} />
            <span data-lift className="pa-lift" />
          </span>
          <Button
            data-detail-text
            variant="text"
            className="fixed top-[calc(var(--spacing-page-y)+0.4rem)] right-page-x z-10"
            onClick={requestClose}
          >
            Close &times;
          </Button>
        </>
      )}
    </Dialog>
  );
}

/** the rope photograph, cut into its drawable strip once per visit */
let ropeTiles: Promise<RopeTiles> | null = null;
function loadRope() {
  ropeTiles ??= new Promise<RopeTiles>((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(buildRopeTiles(img));
    img.onerror = reject;
    img.src = ropeSrc;
  });
  return ropeTiles;
}

/** the screen the scene fills (the dialog covers it, less any page scrollbar) */
const screenSize = () => ({ w: document.documentElement.clientWidth, h: innerHeight });

/** warm a photograph at the size it is about to be shown, so it arrives sharp */
function prefetch(image: ImageAsset, width: number, wait: number) {
  if (!image.variants.length) return Promise.resolve();
  const img = new Image();
  img.sizes = `${Math.round(width)}px`;
  img.srcset = image.variants.map((v) => `${v.src} ${v.width}w`).join(', ');
  return Promise.race([img.decode().catch(() => undefined), new Promise((r) => setTimeout(r, wait))]);
}

interface SceneProps {
  pieces: TattooWork[];
  picked: PickedPrint;
  swapping: RefObject<boolean>;
  closeAfter: RefObject<boolean>;
  requestClose: () => void;
  onClose: () => void;
  onFindSimilar: (piece: TattooWork) => void;
  onSwitching: () => void;
  onSwitched: (index: number) => void;
  archiveSize: (index: number) => PrintSize | null;
  paperRef: RefObject<HTMLDivElement | null>;
  slotRef: RefObject<HTMLDivElement | null>;
  titleRef: RefObject<HTMLHeadingElement | null>;
}

/** one opening of the detail: mounted when it opens, gone when it closes */
function Scene({
  pieces,
  picked,
  swapping,
  closeAfter,
  requestClose,
  onClose,
  onFindSimilar,
  onSwitching,
  onSwitched,
  archiveSize,
  paperRef,
  slotRef,
  titleRef,
}: SceneProps) {
  const reduced = useReducedMotion();
  const n = pieces.length;
  const m = mainPlace(n);

  // the archive prints' sizes, measured once: the picked one exactly as it
  // left the rope, so the flying print and the large print match
  const [sizes] = useState<PrintSize[]>(() =>
    pieces.map((piece, i) => {
      if (i === picked.index) return { w: picked.w, h: picked.h, border: picked.border };
      return archiveSize(i) ?? { w: 200, h: (200 * piece.image.height) / piece.image.width, border: 9 };
    }),
  );
  const [order, setOrder] = useState(() => initialOrder(n, picked.index));
  /** the piece the details describe (changes halfway through a swap) */
  const [shown, setShown] = useState(picked.index);
  const [announce, setAnnounce] = useState('');
  const [view, setView] = useState(screenSize);
  const L = useMemo(() => layoutDetail(pieces, sizes, order, view.w, view.h), [pieces, sizes, order, view]);

  const prints = useRef<(HTMLElement | null)[]>([]);
  const clips = useRef<(HTMLElement | null)[]>([]);
  const textRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLElement>(null);
  const ropeRef = useRef<HTMLCanvasElement>(null);
  const run = useRef<SwapRun | null>(null);
  const pending = useRef<{ from: DetailLayout; fromOrder: number[]; incoming: number; outgoing: number } | null>(null);
  const alive = useRef(true);

  // at rest before anything is drawn (and before the archive measures the
  // large print for the pick): every print at its angle, the rope row
  // scrolled so the large print is in the middle
  useLayoutEffect(() => {
    settle(L, order, prints.current);
    const scroller = scrollerRef.current;
    if (scroller) scroller.scrollLeft = L.places[m].cx - scroller.clientWidth / 2;
    // only when the screen changes - a swap recentres itself
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  // The rope row (rope, clips, small prints) must not cross-fade with the
  // archive's own rope and prints behind - the same photographs would show
  // twice. So it waits until the paper the archive lays over the page is
  // nearly opaque, and leaves first when the archive starts the return.
  // The archive's choreography is not changed for this: the scene reads it
  // from the paper's own style (this element is the paper it fades).
  useLayoutEffect(() => {
    const paper = paperRef.current;
    const row = rowRef.current;
    if (!paper || !row) return;
    gsap.set(row, { autoAlpha: 0 });
    let shown = false;
    const follow = () => {
      const opacity = parseFloat(paper.style.opacity || '0');
      if (!shown && paper.style.visibility !== 'hidden' && opacity >= 0.92) {
        shown = true;
        gsap.to(row, { autoAlpha: 1, duration: reduced ? 0 : 0.25, ease: 'power1.out', overwrite: true });
      } else if (shown && opacity === 0) {
        shown = false;
        gsap.to(row, { autoAlpha: 0, duration: reduced ? 0 : 0.12, ease: 'power2.out', overwrite: true });
      }
    };
    const watch = new MutationObserver(follow);
    watch.observe(paper, { attributes: true, attributeFilter: ['style'] });
    // the paper may already be laid (reduced motion lays it at once, and an
    // effect can be set up again after it has been)
    follow();
    return () => watch.disconnect();
  }, [paperRef, reduced]);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      run.current?.kill();
    };
  }, []);

  // the rope: drawn once per layout of the row, never per frame
  const { width, rope } = L;
  useEffect(() => {
    const canvas = ropeRef.current;
    if (!canvas) return;
    let cancelled = false;
    void loadRope().then((tiles) => {
      if (cancelled) return;
      const dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(rope.canvasHeight * dpr);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, rope.canvasHeight);
      drawRope(ctx, tiles, width, 0, ropeCurve(rope), rope.thickness);
    });
    return () => {
      cancelled = true;
    };
  }, [width, rope]);

  // a new screen size re-lays the scene (not mid-swap)
  useEffect(() => {
    let frame = 0;
    const onResize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!swapping.current) setView(screenSize());
      });
    };
    addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(frame);
      removeEventListener('resize', onResize);
    };
  }, [swapping]);

  /** a small print, chosen: it changes places with the large one */
  const choose = useCallback(
    (at: number) => {
      if (swapping.current || at === m) return;
      swapping.current = true;
      onSwitching();
      const incoming = order[at];
      const outgoing = order[m];
      const next = order.slice();
      next[m] = incoming;
      next[at] = outgoing;
      const to = layoutDetail(pieces, sizes, next, view.w, view.h);
      // the chosen photograph at its large size (normally already warm from hover)
      void prefetch(pieces[incoming].image, to.places[m].w, reduced ? 0 : 350).then(() => {
        if (!alive.current) return;
        pending.current = { from: L, fromOrder: order, incoming, outgoing };
        setOrder(next);
      });
    },
    [swapping, m, onSwitching, order, pieces, sizes, view, reduced, L],
  );

  // the new order is laid out: play the swap from where everything was
  useLayoutEffect(() => {
    const s = pending.current;
    if (!s) return;
    pending.current = null;
    // the chosen print's control is gone (it is the large print now): keep
    // focus in the detail, on its title
    titleRef.current?.focus({ preventScroll: true });
    run.current = playSwap({
      from: s.from,
      to: L,
      fromOrder: s.fromOrder,
      toOrder: order,
      incoming: s.incoming,
      outgoing: s.outgoing,
      prints: prints.current,
      clips: clips.current,
      text: textRef.current,
      scroller: scrollerRef.current,
      reduced,
      onMid: () => {
        setShown(s.incoming);
        const piece = pieces[s.incoming];
        setAnnounce(`${piece.title || FALLBACK_TITLE} ${piece.id}, ${s.incoming + 1} of ${n}`);
      },
      onDone: () => {
        run.current = null;
        swapping.current = false;
        onSwitched(s.incoming);
      },
    });
  }, [order, L, reduced, titleRef, pieces, n, swapping, onSwitched]);

  // a close that waited for the swap: once the archive has caught up with
  // the new large print, so it returns the right photograph
  useEffect(() => {
    if (closeAfter.current && !swapping.current && picked.index === order[m]) {
      closeAfter.current = false;
      onClose();
    }
  }, [picked, order, m, closeAfter, swapping, onClose]);

  const piece = pieces[shown];
  const title = piece.title || FALLBACK_TITLE;
  const meta = [piece.style, piece.placement].filter(Boolean).join(' / ');
  const textTop = L.mainTop + L.mainHeight(shown) + L.textGap;

  // a click on the empty paper closes, like the dialog's own surface
  const onPaperClick = (e: MouseEvent) => {
    if (!(e.target as Element).closest('button, a, [data-v2-print], [data-v2-text]')) requestClose();
  };

  return (
    <div
      ref={paperRef}
      onClick={onPaperClick}
      className="invisible relative flex min-h-full flex-col bg-paper pb-6 opacity-0"
    >
      {/* the details come first for keyboard and screen readers (title,
          then Find similar, then the other prints), drawn beneath the print */}
      <div
        ref={textRef}
        data-v2-text
        className="relative order-2 mx-auto flex w-full max-w-136 flex-col items-center gap-3 px-page-x text-center"
        style={{ marginTop: textTop - L.height }}
      >
        <p data-detail-text className="type-eyebrow text-burgundy">
          / {two(shown + 1)} <span className="text-ink-muted">of {two(n)}</span>
        </p>
        <h2
          data-detail-text
          id="paDetailTitle"
          ref={titleRef}
          tabIndex={-1}
          className="type-heading text-headline outline-none"
        >
          {title}
        </h2>
        {meta && (
          <p data-detail-text className="type-meta text-ink-muted">
            {meta}
          </p>
        )}
        {piece.description && (
          <p data-detail-text className="mt-1 max-w-104 font-serif text-lede text-ink-soft italic">
            {piece.description}
          </p>
        )}
        <div data-detail-text className="mt-4">
          <Button onClick={() => !swapping.current && onFindSimilar(piece)}>Find similar &rarr;</Button>
        </div>
        <p className="sr-only" aria-live="polite">
          {announce}
        </p>
      </div>

      <nav ref={rowRef} aria-label="More from the archive" className="invisible order-1 opacity-0">
        <div
          ref={scrollerRef}
          className="pb-row relative w-full overflow-x-auto overflow-y-hidden"
          style={{ height: L.height }}
        >
          <div className="relative" style={{ width: L.width, height: L.height }}>
            <canvas
              ref={ropeRef}
              className="pointer-events-none absolute top-0 left-0"
              style={{ width: L.width, height: L.rope.canvasHeight }}
              aria-hidden="true"
            />
            {L.places.map((p, at) => (
              <span
                key={`clip-${at}`}
                ref={(el) => {
                  clips.current[at] = el;
                }}
                className="pb-hang"
                style={{ left: p.cx, top: p.clipY, '--hang': `${p.hang}px` } as CSSProperties}
                aria-hidden="true"
              >
                <span className="pa-clip" />
                <span className="pa-wire" />
              </span>
            ))}
            {order.map((i, at) => {
              const p = L.places[at];
              const main = at === m;
              const other = pieces[i];
              // the shadow and paper border scale with the print, from its
              // archive size - so a swap (a transform) and the flying print match
              const ss = p.w / sizes[i].w;
              return (
                <div
                  key={other.id}
                  ref={(el) => {
                    prints.current[i] = el;
                  }}
                  data-v2-print
                  data-main={main || undefined}
                  className="pb-print"
                  style={{ left: p.cx - p.w / 2, top: p.top, width: p.w, height: p.h }}
                >
                  <span data-lift className="pa-lift" />
                  <div
                    ref={main ? slotRef : undefined}
                    className="pa-print"
                    style={{ '--border': `${sizes[i].border * ss}px`, '--ss': ss } as CSSProperties}
                  >
                    <ResponsiveImage
                      image={other.image}
                      alt={main ? other.alt : ''}
                      priority={main}
                      sizes={`${Math.round(p.w)}px`}
                      draggable={false}
                      className="block size-full object-cover"
                    />
                  </div>
                  {!main && (
                    <button
                      type="button"
                      className="pb-pick"
                      aria-label={`Show ${other.title || FALLBACK_TITLE} ${other.id}`}
                      onClick={() => choose(at)}
                      onPointerEnter={() => void prefetch(other.image, L.mainHeight(i) * (sizes[i].w / sizes[i].h), 0)}
                      onFocus={() => void prefetch(other.image, L.mainHeight(i) * (sizes[i].w / sizes[i].h), 0)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </nav>
    </div>
  );
}
