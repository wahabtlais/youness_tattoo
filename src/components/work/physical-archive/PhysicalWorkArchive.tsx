import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useMatch, useNavigate } from 'react-router';
import ropeSrc from '../../../assets/work/rope.png';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import type { TattooWork } from '../../../domain/work';
import { useArchiveMotion } from './useArchiveMotion';
import { WorkArchiveIntro } from './WorkArchiveIntro';
import { WorkPhotograph } from './WorkPhotograph';
import { WorkPhysicalDetail, type PickedPrint } from './WorkPhysicalDetail';
import { WorkDetailV2 } from './detail-v2/WorkDetailV2';
import { detailVersion } from './detailVersion';
import type { ArmStage } from './arm/armStage';
import {
  adoptDetail,
  fadeDetailOut,
  openDetailDirect,
  playPick,
  returnPhotoToArchive,
  resetPick,
  showDetailStatic,
  type PickParts,
  type PickRun,
} from './pickTimeline';
import './physicalArchive.css';

interface PhysicalWorkArchiveProps {
  pieces: TattooWork[];
  /** Find Similar: opens the consultation with this piece */
  onFindSimilar: (workId: string) => void;
}

/**
 * picking   - the arm is taking a print down (opened from the rope)
 * opening   - the detail is opening directly: a shared /work/:slug link, or
 *             another print chosen from inside the detail
 * detail    - the detail is open and settled
 * switching - fading one print's detail out for another (Version B: two
 *             prints changing places inside the detail)
 * adopting  - Version B: the rope catching up with the detail's new print
 * returning - the print is flying back to its clip
 */
type Phase = 'picking' | 'opening' | 'detail' | 'switching' | 'adopting' | 'returning';

const DETAIL_PATH = '/work/:slug';
const isDetailUrl = () => /^\/work\/[^/]+\/?$/.test(location.pathname);

/**
 * PROTOTYPE - the Work section as a physical archive: real prints clipped to
 * a real rope, drifting slowly right to left. Take one down and a tattooed
 * hand comes up, pulls it off the rope and brings it to you as the detail.
 *
 * Motion is split by owner: useArchiveMotion (rope, drift, swing - rAF),
 * pickTimeline (the pick and the return - GSAP), CSS (the touch).
 */
export function PhysicalWorkArchive({ pieces, onFindSimilar }: PhysicalWorkArchiveProps) {
  const reducedMotion = useReducedMotion();
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const slotRef = useRef<HTMLDivElement>(null);
  const cloneRef = useRef<HTMLSpanElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const armCanvasRef = useRef<HTMLCanvasElement>(null);
  const arm = useRef<ArmStage | null>(null);

  // the 3D arm: three.js and the model load once the archive is in view (never
  // with reduced motion), and the same stage serves every pick
  useEffect(() => {
    const stage = stageRef.current;
    const canvas = armCanvasRef.current;
    if (reducedMotion || !stage || !canvas) return;
    let disposed = false;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        import('./arm/armStage')
          .then(({ ArmStage }) => {
            if (disposed) return;
            arm.current = new ArmStage(canvas);
            return arm.current.ready();
          })
          .catch(() => (arm.current = null)); // the pick still works without the arm
      },
      { rootMargin: '400px 0px' },
    );
    io.observe(stage);
    return () => {
      disposed = true;
      io.disconnect();
      arm.current?.dispose();
      arm.current = null;
    };
  }, [reducedMotion]);

  const getEngine = useArchiveMotion({ pieces, stageRef, canvasRef, ropeSrc, reducedMotion });
  const [picked, setPicked] = useState<PickedPrint | null>(null);
  const phase = useRef<Phase | null>(null);
  const run = useRef<PickRun | null>(null);

  // the open detail has its own address (/work/:slug) - shareable, and the
  // browser's Back closes it the same way the Close control does
  const navigate = useNavigate();
  const slug = useMatch(DETAIL_PATH)?.params.slug ?? null;
  /** we pushed the detail's URL ourselves (so closing steps back, not replaces) */
  const pushed = useRef(false);
  /** the detail has closed and its address is being left: ignore it until it has gone */
  const leaving = useRef(false);
  /** the address's slug last time it was looked at (to tell Back from a pick still arriving) */
  const lastSlug = useRef<string | null>(null);

  const parts = useCallback((index: number): PickParts | null => {
    const stage = stageRef.current;
    const dialog = paperRef.current?.parentElement;
    const e = getEngine();
    if (!stage || !dialog || !e || !slotRef.current || !cloneRef.current) return null;
    const prints = Array.from(stage.querySelectorAll<HTMLElement>('[data-print]'));
    return {
      engine: e,
      index,
      print: prints[index],
      others: prints.filter((_, i) => i !== index),
      paper: paperRef.current!,
      clone: cloneRef.current,
      slot: slotRef.current,
      arm: arm.current,
      text: Array.from(dialog.querySelectorAll<HTMLElement>('[data-detail-text]')),
    };
  }, [getEngine]);

  /** the print as it hangs right now: what the detail is built from */
  const measure = useCallback(
    (index: number): PickedPrint | null => {
      const pose = getEngine()?.pose(index);
      const img = stageRef.current?.querySelectorAll<HTMLImageElement>('[data-print] img')[index];
      if (!pose || !img) return null;
      return { index, w: pose.w, h: pose.h, border: pose.border, src: img.currentSrc || img.src };
    },
    [getEngine],
  );

  const pick = useCallback(
    (index: number) => {
      const e = getEngine();
      if (!e || phase.current || e.consumeDrag()) return;
      const next = measure(index);
      if (!next) return;
      phase.current = 'picking';
      setPicked(next);
      pushed.current = true;
      navigate(`/work/${pieces[index].slug}`);
    },
    [getEngine, measure, navigate, pieces],
  );

  /** the detail has arrived: the visitor's focus goes to what they opened */
  const arrived = useCallback(() => {
    phase.current = 'detail';
    titleRef.current?.focus({ preventScroll: true });
  }, []);

  // the dialog is open and laid out: run the choreography for how it opened
  useLayoutEffect(() => {
    if (!picked) return;
    const mode = phase.current;
    if (mode !== 'picking' && mode !== 'opening') return;
    const p = parts(picked.index);
    if (!p) return;
    if (reducedMotion) {
      showDetailStatic(p);
      arrived();
      return;
    }
    if (mode === 'picking') run.current = playPick(p, arrived);
    else {
      const pose = p.engine.pose(picked.index);
      if (pose) run.current = openDetailDirect(p, pose, arrived);
    }
  }, [picked, parts, reducedMotion, arrived]);

  // the page title follows the open piece
  useEffect(() => {
    if (!picked) return;
    const before = document.title;
    const piece = pieces[picked.index];
    document.title = `${piece.title} ${String(picked.index + 1).padStart(2, '0')} — Younes Tattoo`;
    return () => {
      document.title = before;
    };
  }, [picked, pieces]);

  // focus goes back to the print that went back on the rope - not
  // necessarily the one that opened the detail (another may have been
  // chosen inside it, or it was opened from a link). Runs after the
  // dialog's own close, which returns focus to its opener.
  const returned = useRef<number | null>(null);
  useEffect(() => {
    if (picked || returned.current === null) return;
    stageRef.current?.querySelectorAll<HTMLElement>('.pa-photo')[returned.current]?.focus({ preventScroll: true });
    returned.current = null;
  }, [picked]);

  const finish = useCallback(() => {
    phase.current = null;
    run.current = null;
    getEngine()?.hold(false);
    setPicked((current) => {
      returned.current = current?.index ?? null;
      return null;
    });
    // leave the detail's address (unless Back already did)
    if (isDetailUrl()) {
      leaving.current = true;
      if (pushed.current) navigate(-1);
      else navigate('/', { replace: true });
    }
    pushed.current = false;
  }, [getEngine, navigate]);

  /** close: fly the print back to its clip (or snap back when that isn't possible) */
  const close = useCallback(() => {
    if (!picked || phase.current === 'returning') return;
    const p = parts(picked.index);
    const dialogOpen = !!paperRef.current?.closest('dialog')?.open;
    run.current?.kill();
    if (!p) return finish();
    if (reducedMotion || !dialogOpen || phase.current !== 'detail') {
      resetPick(p);
      p.engine.rehang(picked.index);
      return finish();
    }
    phase.current = 'returning';
    run.current = returnPhotoToArchive(p, finish);
  }, [picked, parts, reducedMotion, finish]);

  // Find similar opens the consultation over the detail, with this piece as
  // its starting reference; closing the consultation comes back to the piece
  const findSimilar = useCallback((piece: TattooWork) => onFindSimilar(piece.id), [onFindSimilar]);

  /** another print, chosen from inside the detail: the detail changes over in place */
  const openOther = useCallback(
    (index: number) => {
      if (!picked || phase.current !== 'detail' || index === picked.index) return;
      const p = parts(picked.index);
      if (!p) return;
      phase.current = 'switching';
      run.current = fadeDetailOut(p, reducedMotion, () => {
        const next = measure(index);
        if (!next) return;
        phase.current = 'opening';
        setPicked(next);
        navigate(`/work/${pieces[index].slug}`, { replace: true });
      });
    },
    [picked, parts, reducedMotion, measure, navigate, pieces],
  );

  // the address drives the detail too: a shared link opens it directly over
  // the archive; Back (or a link to another piece) closes or changes it
  useEffect(() => {
    const was = lastSlug.current;
    lastSlug.current = slug;
    if (leaving.current) {
      if (slug === null) leaving.current = false;
      return;
    }
    const index = slug === null ? -1 : pieces.findIndex((w) => w.slug === slug);
    if (slug !== null && index < 0) {
      navigate('/', { replace: true });
      return;
    }
    if (index < 0) {
      // the address LEFT the detail (Back): close it the usual way - but not
      // when a pick has opened it and its address hasn't arrived yet
      if (was !== null && picked && phase.current !== 'returning') close();
      return;
    }
    if (picked?.index === index || phase.current) return;
    // arriving on /work/:slug: bring the archive into view behind the
    // detail (so closing returns the print to a rope you can see), and give
    // it a frame to settle there before the print is measured and opened
    stageRef.current?.scrollIntoView({ block: 'center', behavior: 'instant' });
    const frame = requestAnimationFrame(() => {
      if (phase.current) return;
      const next = measure(index);
      if (!next) return;
      phase.current = 'opening';
      setPicked(next);
    });
    return () => cancelAnimationFrame(frame);
  }, [slug, pieces, picked, close, measure, navigate]);

  // ---- Version B (detail-v2): the detail swaps prints by itself and tells
  // the archive, which catches the rope up behind the paper ----

  /** a print's size as it hangs here: Version B scales its prints from it */
  const archiveSize = useCallback((i: number) => getEngine()?.pose(i) ?? null, [getEngine]);
  const switching = useCallback(() => {
    if (phase.current === 'detail') phase.current = 'switching';
  }, []);
  /** the piece that was open before Version B swapped another in */
  const adoptFrom = useRef<number | null>(null);
  const switched = useCallback(
    (index: number) => {
      if (!picked || phase.current !== 'switching') return;
      const next = measure(index);
      if (!next) return;
      adoptFrom.current = picked.index;
      phase.current = 'adopting';
      setPicked(next);
      navigate(`/work/${pieces[index].slug}`, { replace: true });
    },
    [picked, measure, navigate, pieces],
  );
  useLayoutEffect(() => {
    if (!picked || phase.current !== 'adopting') return;
    const p = parts(picked.index);
    const from = adoptFrom.current;
    const previous = from === null ? null : stageRef.current?.querySelectorAll<HTMLElement>('[data-print]')[from];
    const pose = p?.engine.pose(picked.index);
    if (p && pose && previous) adoptDetail(p, previous, pose);
    adoptFrom.current = null;
    phase.current = 'detail';
  }, [picked, parts]);

  const hover = useCallback((i: number | null) => getEngine()?.hover(i), [getEngine]);
  const focus = useCallback((i: number) => {
    getEngine()?.reveal(i);
    getEngine()?.hover(i);
  }, [getEngine]);

  return (
    <section id="work" aria-labelledby="workTitle" className="relative overflow-x-clip bg-paper pt-section pb-[clamp(3rem,8vh,6rem)]">
      <WorkArchiveIntro />

      <div
        id="work-archive"
        ref={stageRef}
        role="group"
        aria-label="Work archive - prints on a line. Tab through them, Enter to take one down."
        className="pa-stage relative mt-[clamp(2.5rem,7vh,5rem)] w-full"
      >
        <canvas ref={canvasRef} className="pointer-events-none absolute top-0 left-0 w-full" aria-hidden="true" />
        {pieces.map((piece, i) => (
          <WorkPhotograph
            key={piece.id}
            piece={piece}
            index={i}
            total={pieces.length}
            onPick={pick}
            onHover={hover}
            onFocus={focus}
          />
        ))}
      </div>

      <p className="mt-4 flex justify-center gap-6 type-meta text-ink-muted">
        <span>Work archive</span>
        <span aria-hidden="true">&middot;</span>
        <span>{reducedMotion ? 'Drag or tab to explore' : 'Drag to explore'}</span>
      </p>

      {detailVersion === 'b' ? (
        <WorkDetailV2
          pieces={pieces}
          picked={picked}
          onClose={close}
          onFindSimilar={findSimilar}
          onSwitching={switching}
          onSwitched={switched}
          archiveSize={archiveSize}
          paperRef={paperRef}
          slotRef={slotRef}
          cloneRef={cloneRef}
          titleRef={titleRef}
          armCanvasRef={armCanvasRef}
        />
      ) : (
        <WorkPhysicalDetail
          pieces={pieces}
          picked={picked}
          onClose={close}
          onFindSimilar={findSimilar}
          onOpenOther={openOther}
          paperRef={paperRef}
          slotRef={slotRef}
          cloneRef={cloneRef}
          titleRef={titleRef}
          armCanvasRef={armCanvasRef}
        />
      )}
    </section>
  );
}
