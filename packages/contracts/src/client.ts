import { z } from 'zod';
import { passwordSchema } from './auth.ts';
import { consultationEntrySchema, consultationSummarySchema } from './consultation.ts';
import type { InquiryStatus } from './studio.ts';

/**
 * The client portal's shapes: a client's account, the requests they send,
 * their projects' conversation and aftercare - and the studio's side of
 * the same records. Every free-text field has a length limit; ids are
 * uuids; nothing the server didn't check reaches the database.
 */

const uuid = z.uuid();
/** an email, normalised one way everywhere: trimmed, Unicode NFC, lower case */
const email = z
  .string()
  .trim()
  .transform((v) => v.normalize('NFC').toLowerCase())
  .pipe(z.email('Please check your email address'))
  .pipe(z.string().max(254));
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

// ---------------- the account ----------------

export const clientRegisterSchema = z.object({
  name: z.string().trim().min(1, 'Please add your name').max(120),
  email,
  password: passwordSchema,
  /** the privacy notice they read when creating the account */
  consent: z.literal(true, { error: 'Please confirm you’ve read how your details are used' }),
});

export const clientLoginSchema = z.object({ email, password: z.string().min(1).max(128) });
export const clientTokenSchema = z.object({ token: z.string().min(20).max(200) });
export const clientForgotSchema = z.object({ email });
export const clientResetSchema = z.object({ token: z.string().min(20).max(200), password: passwordSchema });
export const clientPasswordChangeSchema = z.object({ current: z.string().min(1).max(128), password: passwordSchema });

const instagram = z
  .string()
  .trim()
  .transform((v) => v.replace(/^@/, ''))
  .pipe(z.string().regex(/^[A-Za-z0-9._]{0,30}$/, 'That doesn’t look like an Instagram handle'));

export const clientProfileSchema = z.object({
  name: z.string().trim().min(1, 'Please add your name').max(120).optional(),
  phone: z
    .string()
    .trim()
    .max(40)
    .refine((v) => v === '' || /^[+()\-.\s0-9]{7,40}$/.test(v), 'Please check the phone number')
    .nullable()
    .optional(),
  instagram: instagram.nullable().optional(),
  preferredContact: z.enum(['email', 'phone', 'instagram']).nullable().optional(),
});

/** where a visitor stands with their client account */
export interface ClientSessionState {
  account: { id: string; name: string; email: string; verified: boolean } | null;
}

// ---------------- requests ----------------

/** reference images a client can send with one consultation request */
export const MAX_REQUEST_REFERENCES = 6;

/**
 * A request from a signed-in client: a consultation (the website's own
 * questions, contact details from the account), or asking to book a
 * session for one of their projects. Neither becomes an appointment by
 * itself - the studio answers it.
 */
export const clientRequestSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('consultation'),
    idempotencyKey: uuid,
    entry: consultationEntrySchema,
    summary: consultationSummarySchema,
    /** reference images uploaded with it (POST /api/client/uploads) - the client's own, not yet sent with anything */
    referenceUploads: z.array(uuid).max(MAX_REQUEST_REFERENCES, `Up to ${MAX_REQUEST_REFERENCES} images`).optional(),
    consent: z.literal(true, { error: 'Please confirm you’ve read how your details are used' }),
    privacyNoticeVersion: z.string().max(40),
  }),
  z.object({
    kind: z.literal('booking'),
    idempotencyKey: uuid,
    projectId: uuid,
    /** when suits them, in their own words */
    preferredTimes: z.string().trim().min(1, 'Tell Younes when suits you').max(500),
    notes: optionalText(2000),
    consent: z.literal(true, { error: 'Please confirm you’ve read how your details are used' }),
    privacyNoticeVersion: z.string().max(40),
  }),
]);
export type ClientRequestInput = z.input<typeof clientRequestSchema>;

/**
 * What a client is told about a request: the studio's stages, said plainly.
 * (The studio's own labels are in its dashboard.)
 */
export const CLIENT_REQUEST_STATUS: Record<InquiryStatus, { label: string; tone: 'waiting' | 'action' | 'good' | 'closed' }> = {
  submitted: { label: 'Pending', tone: 'waiting' },
  'under-review': { label: 'Under review', tone: 'waiting' },
  'changes-requested': { label: 'More information needed', tone: 'action' },
  accepted: { label: 'Accepted', tone: 'good' },
  declined: { label: 'Declined', tone: 'closed' },
  contacted: { label: 'Under review', tone: 'waiting' },
  booking: { label: 'Accepted · booking', tone: 'good' },
  completed: { label: 'Completed', tone: 'closed' },
};

export const messageSchema = z.object({ body: z.string().trim().min(1, 'Write something first').max(4000) });

// ---------------- projects ----------------

export const PROJECT_STATUSES = ['design', 'ready-to-book', 'scheduled', 'in-progress', 'healing', 'complete', 'on-hold'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

/** a project's stage, for the client */
export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  design: 'In design',
  'ready-to-book': 'Ready to book',
  scheduled: 'Session scheduled',
  'in-progress': 'In progress',
  healing: 'Healing',
  complete: 'Complete',
  'on-hold': 'On hold',
};

const projectFields = {
  title: z.string().trim().min(1, 'Give the project a title').max(160),
  concept: z.string().trim().max(500).nullable().optional(),
  description: z.string().trim().max(4000).nullable().optional(),
  placement: z.string().trim().max(300).nullable().optional(),
  size: z.string().trim().max(300).nullable().optional(),
};

export const projectCreateSchema = z.object({ clientId: uuid, inquiryId: uuid.optional(), ...projectFields });
export const projectUpdateSchema = z.object({
  ...projectFields,
  title: projectFields.title.optional(),
  status: z.enum(PROJECT_STATUSES).optional(),
});

// ---------------- aftercare ----------------

export const aftercareStepSchema = z
  .object({
    dayFrom: z.number().int().min(0).max(365),
    dayTo: z.number().int().min(0).max(365).nullable().optional(),
    title: z.string().trim().min(1, 'Give the stage a title').max(160),
    body: z.string().trim().min(1, 'Write the instructions for this stage').max(6000),
  })
  .refine((s) => s.dayTo == null || s.dayTo >= s.dayFrom, { message: 'The last day can’t be before the first', path: ['dayTo'] });

/** a guide as Younes writes it - saving it always leaves it unapproved until he approves it again */
export const aftercareGuideSchema = z.object({
  title: z.string().trim().min(1, 'Give the guide a title').max(160),
  intro: z.string().trim().max(2000).nullable().optional(),
  steps: z.array(aftercareStepSchema).max(40),
});

export const aftercareAssignSchema = z.object({
  guideId: uuid,
  /** the session's day: day 0 of healing */
  startedOn: z.iso.date(),
  reminders: z.boolean().default(true),
});

export const healingResponseSchema = z.object({ response: z.string().trim().min(1, 'Write a reply first').max(4000) });

// ---------------- the account's data ----------------

export const deletionRequestSchema = z.object({
  /** they've read what closing the account means */
  confirm: z.literal(true, { error: 'Please confirm you’ve read what happens' }),
  reason: optionalText(2000),
});

export const deletionResolutionSchema = z.object({
  /** close: the account stops working (records kept until a retention policy decides); cancel: the request is withdrawn */
  action: z.enum(['close', 'cancel']),
  note: optionalText(2000),
});
