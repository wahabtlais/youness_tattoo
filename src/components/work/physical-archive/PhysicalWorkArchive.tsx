import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import ropeSrc from '../../../assets/work/rope.png';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import type { TattooWork } from '../../../domain/work';
import { useArchiveMotion } from './useArchiveMotion';
import { WorkArchiveIntro } from './WorkArchiveIntro';
import { WorkPhotograph } from './WorkPhotograph';
import { WorkPhysicalDetail, type PickedPrint } from './WorkPhysicalDetail';
import type { ArmStage } from './arm/armStage';
import { playPick, returnPhotoToArchive, resetPick, showDetailStatic, type PickParts, type PickRun } from './pickTimeline';
import './physicalArchive.css';

interface PhysicalWorkArchiveProps {
  pieces: TattooWork[];
  /** Find Similar: opens the consultation with this piece */
  onFindSimilar: (workId: string) => void;
}

type Phase = 'picking' | 'detail' | 'returning';

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
  const textRef = useRef<HTMLDivElement>(null);
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

  const pick = useCallback(
    (index: number) => {
      const e = getEngine();
      if (!e || phase.current || e.consumeDrag()) return;
      const pose = e.pose(index);
      const img = stageRef.current?.querySelectorAll<HTMLImageElement>('[data-print] img')[index];
      if (!pose || !img) return;
      phase.current = 'picking';
      setPicked({ index, w: pose.w, h: pose.h, border: pose.border, src: img.currentSrc || img.src });
    },
    [getEngine],
  );

  // the dialog is open and laid out: run the choreography
  useLayoutEffect(() => {
    if (!picked || phase.current !== 'picking') return;
    const p = parts(picked.index);
    if (!p) return;
    if (reducedMotion) {
      showDetailStatic(p);
      phase.current = 'detail';
      return;
    }
    run.current = playPick(p, () => (phase.current = 'detail'));
  }, [picked, parts, reducedMotion]);

  const finish = useCallback(() => {
    phase.current = null;
    run.current = null;
    getEngine()?.hold(false);
    setPicked(null);
  }, [getEngine]);

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

  const findSimilar = useCallback(
    (piece: TattooWork) => {
      const p = picked && parts(picked.index);
      run.current?.kill();
      if (p) resetPick(p);
      finish();
      onFindSimilar(piece.id);
    },
    [picked, parts, finish, onFindSimilar],
  );

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

      <WorkPhysicalDetail
        piece={picked ? pieces[picked.index] : null}
        picked={picked}
        total={pieces.length}
        onClose={close}
        onFindSimilar={findSimilar}
        paperRef={paperRef}
        slotRef={slotRef}
        cloneRef={cloneRef}
        textRef={textRef}
        armCanvasRef={armCanvasRef}
      />
    </section>
  );
}
