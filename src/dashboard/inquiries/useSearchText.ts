import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';

/**
 * A search box backed by the address (?q). The box keeps its own text, so
 * every keystroke lands at once - a router navigation per keystroke would
 * lag behind fast typing and drop characters - and the address follows when
 * typing pauses. A change from outside (a link, Back) flows into the box.
 */
export function useSearchText(key = 'q') {
  const [params, setParams] = useSearchParams();
  const fromUrl = params.get(key) ?? '';
  const [text, setText] = useState(fromUrl);
  const pushed = useRef(fromUrl);

  useEffect(() => {
    if (fromUrl === pushed.current) return;
    pushed.current = fromUrl;
    setText(fromUrl);
  }, [fromUrl]);

  useEffect(() => {
    if (text === pushed.current) return;
    const t = setTimeout(() => {
      pushed.current = text;
      setParams(
        (p) => {
          const next = new URLSearchParams(p);
          if (text) next.set(key, text);
          else next.delete(key);
          return next;
        },
        { replace: true },
      );
    }, 250);
    return () => clearTimeout(t);
  }, [text, key, setParams]);

  return [text, setText] as const;
}
