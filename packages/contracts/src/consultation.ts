import { z } from 'zod';

/**
 * A consultation as the website submits it - the same shapes as
 * src/domain/consultation.ts, made into schemas so the server can trust
 * nothing it didn't check. Every free-text field has a length limit; the
 * choices are closed lists.
 */

const text = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

export const PREFERENCE_SIGNALS = ['subject', 'composition', 'linework', 'style', 'mood', 'placement', 'other'] as const;
export const BODY_AREAS = ['forearm', 'upper-arm', 'shoulder', 'chest', 'back', 'leg', 'hand', 'other', 'not-sure'] as const;
export const SCALES = ['small', 'medium', 'large', 'large-scale', 'not-sure'] as const;
export const TIMEFRAMES = ['soon', 'months', 'no-rush', 'not-sure'] as const;
export const COLOURS = ['black-and-grey', 'colour', 'undecided'] as const;

/** a piece id ("04") or a call slug: short, plain */
const workId = z.string().regex(/^[0-9]{1,4}$/, 'Not a piece number');
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Not a valid address').max(120);

export const findSimilarSelectionSchema = z.object({
  drawnTo: z.array(z.enum(PREFERENCE_SIGNALS)).max(PREFERENCE_SIGNALS.length),
  note: optionalText(500),
  references: z.array(workId).max(24),
});

export const consultationEntrySchema = z.discriminatedUnion('from', [
  z.object({ from: z.enum(['hero', 'work', 'process', 'journal', 'footer', 'book']) }),
  z.object({ from: z.literal('canvas-call'), callSlug: slug, title: text(200), demo: z.boolean().optional() }),
  z.object({ from: z.literal('find-similar'), workId, selection: findSimilarSelectionSchema.optional() }),
]);
export type ConsultationEntryInput = z.infer<typeof consultationEntrySchema>;

/** the answers - the form's own questions only; uploads aren't collected yet */
export const consultationSummarySchema = z.object({
  concept: optionalText(500),
  meaning: optionalText(2000),
  bodyArea: z.enum(BODY_AREAS).optional(),
  placement: optionalText(300),
  scale: z.enum(SCALES).optional(),
  size: optionalText(300),
  timing: z.enum(TIMEFRAMES).optional(),
  notes: optionalText(2000),
});
export type ConsultationSummaryInput = z.infer<typeof consultationSummarySchema>;

/** an Instagram handle without the @, as Instagram allows them */
const instagram = z
  .string()
  .trim()
  .transform((v) => v.replace(/^@/, ''))
  .pipe(z.string().regex(/^[A-Za-z0-9._]{1,30}$/, 'That doesn’t look like an Instagram handle'));

/** how to reach them - name and email required, the rest optional */
export const contactSchema = z.object({
  name: z.string().trim().min(1, 'Please add your name').max(120),
  email: z.string().trim().toLowerCase().pipe(z.email('Please check your email address')).pipe(z.string().max(254)),
  phone: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((v) => (v ? v : undefined))
    .refine((v) => v === undefined || /^[+()\-.\s0-9]{7,40}$/.test(v), 'Please check the phone number'),
  instagram: z
    .union([z.literal(''), instagram])
    .optional()
    .transform((v) => (v ? v : undefined)),
});
export type ContactInput = z.infer<typeof contactSchema>;

export const PRIVACY_NOTICE_VERSION = '2026-10-draft';

/**
 * What the website sends. `idempotencyKey` is the draft's own id: sending
 * the same draft twice files it once. `website` is a field people never
 * see (left empty by humans). `startedAt` lets the server notice a form
 * filled in faster than a person could.
 */
export const consultationSubmissionSchema = z.object({
  idempotencyKey: z.uuid(),
  entry: consultationEntrySchema,
  summary: consultationSummarySchema,
  contact: contactSchema,
  consent: z.literal(true, { error: 'Please confirm you’ve read how your details are used' }),
  privacyNoticeVersion: z.string().max(40),
  website: z.string().max(0, 'Leave this field empty').optional().default(''),
  startedAt: z.iso.datetime().optional(),
});
export type ConsultationSubmission = z.input<typeof consultationSubmissionSchema>;
export type ConsultationSubmissionParsed = z.infer<typeof consultationSubmissionSchema>;

export const consultationReceiptSchema = z.object({
  receiptId: z.string(),
  receivedAt: z.iso.datetime(),
  /** true when this was a repeat of a draft already filed */
  duplicate: z.boolean(),
});
export type ConsultationReceipt = z.infer<typeof consultationReceiptSchema>;
