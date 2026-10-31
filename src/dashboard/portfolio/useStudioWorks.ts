import type { TattooWork } from '../../domain/work';
import { useResource } from '../useResource';
import type { StudioWork } from './studioWorks';

/** a piece as the studio's API sends it */
export interface WorkRow {
  id: string;
  number: string;
  slug: string;
  title: string;
  alt: string;
  description: string | null;
  published: boolean;
  metadataStatus: 'demo' | 'verified';
  traits: Record<string, string | string[] | null>;
  image: TattooWork['image'];
}

/** the public shape the pages already draw, plus whether it's on the site; empty traits left out */
const toWork = (r: WorkRow): StudioWork => {
  const traits = Object.fromEntries(Object.entries(r.traits).filter(([, v]) => v !== null && !(Array.isArray(v) && v.length === 0)));
  return { ...(traits as Partial<TattooWork>), id: r.number, uuid: r.id, slug: r.slug, title: r.title, alt: r.alt, description: r.description, published: r.published, metadataStatus: r.metadataStatus, image: r.image } as StudioWork;
};

/** every piece, published or not - from the studio's API */
export function useStudioWorks() {
  const r = useResource<StudioWork[], WorkRow[]>('/api/studio/works', (rows) => rows.map(toWork));
  return { list: r.data, error: r.error, reload: r.reload };
}
