import { useEffect, useRef, useState } from 'react';
import type { VoiceAudio } from '../../domain/client';
import { cx } from '../../lib/cx';

interface VoiceNoteProps {
  audio: VoiceAudio;
  /** whose voice, for the controls' names: "Play Alex Morgan's voice note" */
  speaker: string;
  /** what kind of recording it is, shown beside the label (e.g. "Synthetic demo voice") */
  note?: string;
  /** its testimonial is the one showing; leaving it pauses the recording */
  active: boolean;
}

/** the one recording playing on the page: starting another pauses it */
let playingNow: HTMLAudioElement | null = null;

/** 83 -> "1:23"; unknown -> dashes, never a made-up length */
const clock = (s: number) =>
  Number.isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '–:––';

/**
 * A testimonial's recording, set as a short spoken message on the page
 * rather than a media widget: a round play mark, the recording's own
 * waveform (its measured peaks) filling with burgundy as it actually plays,
 * and the time in mono. Without peaks the waveform is a ruled line.
 *
 * It never autoplays; one recording plays at a time; it pauses when its
 * testimonial is no longer the one showing, and stops when removed. Seeking
 * is a native range over the waveform (arrow keys included), which takes
 * sideways drags for itself so a swipe there doesn't turn the carousel.
 */
export function VoiceNote({ audio, speaker, note, active }: VoiceNoteProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [measured, setMeasured] = useState(Number.NaN);
  // no "loading" until asked to play: some browsers fetch nothing before that
  const [state, setState] = useState<'idle' | 'buffering' | 'error'>('idle');

  useEffect(() => {
    if (!active) audioRef.current?.pause();
  }, [active]);

  useEffect(() => {
    const el = audioRef.current;
    return () => {
      el?.pause();
      if (playingNow === el) playingNow = null;
    };
  }, []);

  const duration = Number.isFinite(measured) ? measured : (audio.duration ?? Number.NaN);
  const known = Number.isFinite(duration) && duration > 0;
  const progress = known ? Math.min(1, time / duration) : 0;

  const toggle = () => {
    const el = audioRef.current;
    if (!el || state === 'error') return;
    if (el.paused) {
      el.play().catch(() => setState('error'));
    } else el.pause();
  };

  return (
    <div className="grid gap-3">
      <p className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 type-meta leading-normal">
        <span className="text-burgundy">Voice note</span>
        {note && <span className="text-ink-soft">{note}</span>}
      </p>

      <audio
        ref={audioRef}
        src={audio.src}
        preload="metadata"
        onLoadedMetadata={(e) => setMeasured(e.currentTarget.duration)}
        onDurationChange={(e) => setMeasured(e.currentTarget.duration)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onPlay={(e) => {
          if (playingNow && playingNow !== e.currentTarget) playingNow.pause();
          playingNow = e.currentTarget;
          setPlaying(true);
        }}
        onPause={(e) => {
          if (playingNow === e.currentTarget) playingNow = null;
          setPlaying(false);
          setState((s) => (s === 'error' ? s : 'idle'));
        }}
        onEnded={() => setPlaying(false)}
        onWaiting={() => setState('buffering')}
        onPlaying={() => setState('idle')}
        onError={() => {
          setPlaying(false);
          setState('error');
        }}
      />

      <div className="flex items-center gap-[clamp(0.75rem,1.6vw,1.25rem)]">
        <button
          type="button"
          onClick={toggle}
          disabled={state === 'error'}
          aria-label={`${playing ? 'Pause' : 'Play'} ${speaker}’s voice note`}
          className={cx(
            'grid size-12 shrink-0 place-items-center rounded-full border transition-colors duration-(--duration-fast)',
            playing
              ? 'border-burgundy bg-burgundy text-paper'
              : 'border-burgundy text-burgundy hover:bg-burgundy hover:text-paper',
            'disabled:border-rule disabled:bg-transparent disabled:text-ink-muted',
          )}
        >
          {playing ? (
            <svg aria-hidden="true" viewBox="0 0 12 12" className="size-3 fill-current">
              <rect x="2" y="1.5" width="2.6" height="9" />
              <rect x="7.4" y="1.5" width="2.6" height="9" />
            </svg>
          ) : (
            <svg aria-hidden="true" viewBox="0 0 12 12" className="size-3 translate-x-px fill-current">
              <path d="M2.5 1.2v9.6L10.5 6z" />
            </svg>
          )}
        </button>

        <div className="relative h-12 min-w-0 flex-1 touch-pan-y has-focus-visible:outline-2 has-focus-visible:outline-offset-4 has-focus-visible:outline-focus">
          {audio.peaks?.length ? (
            <span aria-hidden="true" className="absolute inset-0 flex items-center gap-px tablet:gap-0.5">
              {audio.peaks.map((p, i, all) => (
                <span
                  key={i}
                  className={cx(
                    'min-w-px flex-1 transition-colors duration-(--duration-fast)',
                    (i + 0.5) / all.length <= progress ? 'bg-burgundy' : 'bg-ink-muted/45',
                  )}
                  style={{ height: `${Math.max(6, p * 100)}%` }}
                />
              ))}
            </span>
          ) : (
            <span aria-hidden="true" className="absolute inset-x-0 top-1/2 h-px bg-rule">
              <span className="absolute inset-y-0 left-0 bg-burgundy" style={{ width: `${progress * 100}%` }} />
            </span>
          )}
          <input
            type="range"
            min={0}
            max={known ? duration : 0}
            step={1}
            value={time}
            disabled={!known || state === 'error'}
            onChange={(e) => {
              const to = Number(e.currentTarget.value);
              // follow at once - waiting for the audio's own timeupdate would
              // snap the range back between quick key presses
              setTime(to);
              if (audioRef.current) audioRef.current.currentTime = to;
            }}
            aria-label={`Position in ${speaker}’s voice note`}
            aria-valuetext={`${clock(time)} of ${clock(duration)}`}
            className="absolute inset-0 size-full cursor-pointer opacity-0 disabled:cursor-default"
          />
        </div>

        <p className="shrink-0 type-meta text-ink-soft tabular-nums">
          <span className="text-ink">{clock(time)}</span> / {clock(duration)}
        </p>
      </div>

      <p role="status" className={cx('type-meta leading-normal text-ink-soft', state === 'idle' && 'sr-only')}>
        {state === 'error' ? 'The recording could not be played.' : state === 'buffering' ? 'Loading the recording…' : ''}
      </p>
    </div>
  );
}
