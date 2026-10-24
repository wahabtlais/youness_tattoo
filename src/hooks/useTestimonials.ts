import type { ClientExperiences, ClientTestimonial, DemoTestimonial } from '../domain/client';
import { CLIENT_EXPERIENCES } from '../data/clientExperiences';
import { published } from '../lib/publicContent';

/**
 * The client experiences the home page shows - the published ones from the
 * studio's records when the server provided them, otherwise the bundled
 * set (data/clientExperiences.ts).
 *
 * From the server come the words, their order and whether each is
 * published. A demo entry keeps its bundled stand-ins (the drawn
 * placeholder portrait, the labelled synthetic voice, the sample piece) -
 * those files ship with the site; it stays marked fictional. A real
 * testimonial is shown only with its consent; one without is left out.
 */
export function testimonials(): ClientExperiences {
  const bundle = published();
  if (!bundle) return CLIENT_EXPERIENCES;
  const local = CLIENT_EXPERIENCES.status === 'awaiting' ? [] : CLIENT_EXPERIENCES.testimonials;
  const list: (DemoTestimonial | ClientTestimonial)[] = [];
  for (const t of bundle.testimonials) {
    const known = local.find((l) => l.id === t.id);
    if (t.demo) {
      const base = known && 'demo' in known ? known : undefined;
      const initials = t.attribution
        .split(/\s+/)
        .map((w) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
      list.push({ ...(base ?? { portrait: { placeholder: true, initials } }), demo: true, id: t.id, quote: t.quote, attribution: t.attribution, context: t.context });
    } else if (t.consent) {
      const base = known && !('demo' in known) ? known : undefined;
      list.push({ ...base, id: t.id, quote: t.quote, attribution: t.attribution, context: t.context, workId: t.workId, consent: t.consent });
    }
  }
  if (!list.length) return { status: 'awaiting' };
  return list.every((t) => 'demo' in t)
    ? { status: 'demo', testimonials: list as [DemoTestimonial, ...DemoTestimonial[]] }
    : { status: 'published', testimonials: list.filter((t): t is ClientTestimonial => !('demo' in t)) as [ClientTestimonial, ...ClientTestimonial[]] };
}

const RESOLVED = testimonials();

export function useTestimonials(): ClientExperiences {
  return RESOLVED;
}
