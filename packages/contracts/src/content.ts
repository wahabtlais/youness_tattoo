import { z } from 'zod';

/**
 * The home page's editable copy and optional sections - the shape of
 * src/data/siteContent.ts (SiteContent), with the limits the dashboard's
 * Website Management enforces. A draft must pass this to be saved or
 * published; nothing else of the page (layout, images, order) is content.
 */

const line = (max: number) => z.string().trim().min(1, 'Required — the site needs words here.').max(max, `At most ${max} characters.`);

export const OPTIONAL_SECTIONS = ['artist', 'experiences', 'process', 'journal', 'canvasCalls'] as const;
export type OptionalSectionKey = (typeof OPTIONAL_SECTIONS)[number];

export const siteContentSchema = z.object({
  visible: z.object({
    artist: z.boolean(),
    experiences: z.boolean(),
    process: z.boolean(),
    journal: z.boolean(),
    canvasCalls: z.boolean(),
  }),
  artist: z.object({
    label: line(40),
    headline: line(90),
    meta: z.tuple([line(40), line(40), line(40)]),
    /** optional: empty until he writes it */
    intro: z
      .array(z.string().trim().min(1).max(1200))
      .max(8)
      .refine((ps) => ps.join('\n\n').length <= 1200, 'At most 1200 characters.'),
  }),
  experiences: z.object({ eyebrow: line(40), heading: line(80), intro: line(220) }),
  process: z.object({
    eyebrow: line(40),
    heading: line(80),
    intro: line(260),
    steps: z.tuple([0, 1, 2, 3].map(() => z.object({ title: line(40), body: line(260) })) as [
      z.ZodObject<{ title: z.ZodString; body: z.ZodString }>,
      z.ZodObject<{ title: z.ZodString; body: z.ZodString }>,
      z.ZodObject<{ title: z.ZodString; body: z.ZodString }>,
      z.ZodObject<{ title: z.ZodString; body: z.ZodString }>,
    ]),
    closing: line(80),
  }),
  journal: z.object({ eyebrow: line(40), heading: line(80), intro: line(220) }),
  canvasCalls: z.object({ heading: line(80), intro: line(260) }),
  book: z.object({ intro: line(160) }),
});
export type SiteContentInput = z.infer<typeof siteContentSchema>;

/** where a content document stands, as the dashboard shows it */
export const contentStateSchema = z.object({
  key: z.string(),
  draft: siteContentSchema,
  draftUpdatedAt: z.string().nullable(),
  /** the draft differs from what's published */
  hasDraft: z.boolean(),
  published: z.object({ version: z.number().int(), publishedAt: z.string(), data: siteContentSchema }).nullable(),
  versions: z.array(z.object({ version: z.number().int(), publishedAt: z.string(), publishedBy: z.string().nullable(), current: z.boolean() })),
  /**
   * How the published content reaches visitors: 'served' when this server
   * renders the site (the next page load shows it), 'not-connected' when no
   * public site is served by it - so nothing claims "live" that isn't.
   */
  delivery: z.enum(['served', 'not-connected']),
});
export type ContentState = z.infer<typeof contentStateSchema>;
