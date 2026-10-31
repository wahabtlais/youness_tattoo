import { api } from '../api';
import { useResource } from '../useResource';
import type { StudioItem } from './publishState';

/**
 * The studio's list of a kind, live. The page's content (the posts and
 * calls themselves) comes with the site; this is what says whether each
 * is on it right now, and switches it.
 */
export function useStudioItems(kind: 'journal' | 'calls' | 'testimonials') {
  const r = useResource<StudioItem[]>(`/api/studio/${kind}`);
  const setPublished = async (id: string, published: boolean) => {
    await api(`/api/studio/${kind}/${id}`, { method: 'PATCH', body: { published } });
    await r.reload();
  };
  return { list: r.data, error: r.error, reload: r.reload, setPublished };
}
