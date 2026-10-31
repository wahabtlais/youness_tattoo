import { z } from 'zod';

/** the consultation's own lifecycle (src/domain/consultation.ts), as stored */
export const INQUIRY_STATUSES = ['submitted', 'under-review', 'changes-requested', 'accepted', 'declined', 'contacted', 'booking', 'completed'] as const;
export type InquiryStatus = (typeof INQUIRY_STATUSES)[number];

export const APPOINTMENT_KINDS = ['session', 'consultation', 'aftercare'] as const;
/** proposed and confirmed hold the time; the rest release it */
export const APPOINTMENT_STATUSES = ['proposed', 'confirmed', 'completed', 'cancelled', 'no_show'] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const FOLLOW_UP_KINDS = ['reply', 'reminder', 'aftercare'] as const;

const uuid = z.uuid();

export const statusChangeSchema = z.object({
  status: z.enum(INQUIRY_STATUSES),
  note: z.string().trim().max(2000).optional(),
});

export const noteSchema = z.object({ body: z.string().trim().min(1, 'Write something first').max(4000) });

export const followUpCreateSchema = z.object({
  clientId: uuid,
  inquiryId: uuid.optional(),
  kind: z.enum(FOLLOW_UP_KINDS),
  reason: z.string().trim().min(1).max(300),
  dueAt: z.iso.datetime({ offset: true }),
});
export const followUpUpdateSchema = z.object({ done: z.boolean() });

export const clientUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  instagram: z.string().trim().max(30).nullable().optional(),
  preferredContact: z.enum(['email', 'phone', 'instagram']).nullable().optional(),
});

export const appointmentCreateSchema = z
  .object({
    clientId: uuid,
    inquiryId: uuid.optional(),
    kind: z.enum(APPOINTMENT_KINDS),
    title: z.string().trim().min(1).max(200),
    startsAt: z.iso.datetime({ offset: true }),
    endsAt: z.iso.datetime({ offset: true }),
    status: z.enum(['proposed', 'confirmed']).default('proposed'),
    prep: z.string().trim().max(300).optional(),
  })
  .refine((a) => new Date(a.endsAt) > new Date(a.startsAt), { message: 'The end must be after the start', path: ['endsAt'] });

export const appointmentUpdateSchema = z
  .object({
    startsAt: z.iso.datetime({ offset: true }).optional(),
    endsAt: z.iso.datetime({ offset: true }).optional(),
    status: z.enum(APPOINTMENT_STATUSES).optional(),
    title: z.string().trim().min(1).max(200).optional(),
    prep: z.string().trim().max(300).nullable().optional(),
  })
  .refine((a) => !(a.startsAt && a.endsAt) || new Date(a.endsAt) > new Date(a.startsAt), { message: 'The end must be after the start', path: ['endsAt'] });

/** a weekly opening window, in the studio's own time zone ("10:00"–"18:00") */
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use 24-hour time, like 10:00');
export const availabilitySchema = z.object({
  windows: z
    .array(z.object({ weekday: z.number().int().min(0).max(6), start: hhmm, end: hhmm }))
    .max(28)
    .refine((ws) => ws.every((w) => w.end > w.start), 'Each window must end after it starts'),
});

export const settingsUpdateSchema = z.object({
  studioName: z.string().trim().min(1).max(120).optional(),
  timezone: z.string().trim().min(1).max(64).optional(),
  notifyEmail: z.email().nullable().optional(),
  retentionMonths: z.number().int().min(1).max(120).optional(),
  aiDailyBudgetUsd: z.number().min(0).max(1000).optional(),
  aiMonthlyBudgetUsd: z.number().min(0).max(10000).optional(),
});

export const workUpdateSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  alt: z.string().trim().min(1).max(300).optional(),
  published: z.boolean().optional(),
  metadataStatus: z.enum(['demo', 'verified']).optional(),
});

export const publishToggleSchema = z.object({ published: z.boolean() });
export const proposalDecisionSchema = z.object({ decision: z.enum(['approve', 'reject']) });
