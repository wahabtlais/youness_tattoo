import { describe, expect, it } from 'vitest';
import { appointmentCreateSchema, consultationSubmissionSchema, contactSchema, mfaCodeSchema, passwordSchema, siteContentSchema } from './index.ts';

const content = {
  visible: { artist: true, experiences: true, process: true, journal: true, canvasCalls: true },
  artist: { label: 'The artist', headline: 'Headline', meta: ['a', 'b', 'c'], intro: [] },
  experiences: { eyebrow: 'e', heading: 'h', intro: 'i' },
  process: { eyebrow: 'e', heading: 'h', intro: 'i', steps: [0, 1, 2, 3].map((n) => ({ title: `t${n}`, body: `b${n}` })), closing: 'c' },
  journal: { eyebrow: 'e', heading: 'h', intro: 'i' },
  canvasCalls: { heading: 'h', intro: 'i' },
  book: { intro: 'i' },
};

describe('contact details', () => {
  it('normalises email and Instagram, drops empty optionals', () => {
    expect(contactSchema.parse({ name: ' Ana ', email: ' Ana@Example.TEST ', phone: '', instagram: '@ana.ink' })).toEqual({ name: 'Ana', email: 'ana@example.test', phone: undefined, instagram: 'ana.ink' });
  });
  it('refuses a bad email, phone or handle', () => {
    expect(contactSchema.safeParse({ name: 'A', email: 'nope' }).success).toBe(false);
    expect(contactSchema.safeParse({ name: 'A', email: 'a@b.test', phone: 'call me' }).success).toBe(false);
    expect(contactSchema.safeParse({ name: 'A', email: 'a@b.test', instagram: 'has space' }).success).toBe(false);
  });
});

describe('a consultation', () => {
  const base = { idempotencyKey: '6f1c2b0e-8a3d-4c5e-9f7a-1b2c3d4e5f60', entry: { from: 'hero' }, summary: {}, contact: { name: 'A', email: 'a@b.test' }, consent: true, privacyNoticeVersion: 'v' };
  it('needs consent', () => {
    expect(consultationSubmissionSchema.safeParse(base).success).toBe(true);
    expect(consultationSubmissionSchema.safeParse({ ...base, consent: false }).success).toBe(false);
  });
  it('accepts only the known entries and piece numbers', () => {
    expect(consultationSubmissionSchema.safeParse({ ...base, entry: { from: 'admin' } }).success).toBe(false);
    expect(consultationSubmissionSchema.safeParse({ ...base, entry: { from: 'find-similar', workId: '04/../x' } }).success).toBe(false);
    expect(consultationSubmissionSchema.safeParse({ ...base, entry: { from: 'canvas-call', callSlug: 'Bad Slug', title: 't' } }).success).toBe(false);
  });
  it('rejects a filled honeypot', () => {
    expect(consultationSubmissionSchema.safeParse({ ...base, website: 'x' }).success).toBe(false);
  });
});

describe('site content', () => {
  it('accepts the shape, refuses an empty required field and over-long text', () => {
    expect(siteContentSchema.safeParse(content).success).toBe(true);
    expect(siteContentSchema.safeParse({ ...content, book: { intro: '   ' } }).success).toBe(false);
    expect(siteContentSchema.safeParse({ ...content, artist: { ...content.artist, headline: 'x'.repeat(91) } }).success).toBe(false);
    expect(siteContentSchema.safeParse({ ...content, process: { ...content.process, steps: content.process.steps.slice(0, 3) } }).success).toBe(false);
  });
});

describe('sign-in shapes', () => {
  it('passwords: 12 to 128 characters', () => {
    expect(passwordSchema.safeParse('x'.repeat(11)).success).toBe(false);
    expect(passwordSchema.safeParse('x'.repeat(12)).success).toBe(true);
    expect(passwordSchema.safeParse('x'.repeat(129)).success).toBe(false);
  });
  it('codes: six digits, or a recovery code', () => {
    expect(mfaCodeSchema.parse({ code: '123 456' }).code).toBe('123456');
    expect(mfaCodeSchema.safeParse({ code: 'abcd-efgh-2345' }).success).toBe(true);
    expect(mfaCodeSchema.safeParse({ code: '12345' }).success).toBe(false);
  });
});

describe('appointments', () => {
  it('end after start, with an offset', () => {
    const a = { clientId: '0d9e8f7a-6b5c-4d3e-8f1a-2b3c4d5e6f70', kind: 'session', title: 't', startsAt: '2027-01-01T10:00:00-05:00', endsAt: '2027-01-01T09:00:00-05:00' };
    expect(appointmentCreateSchema.safeParse(a).success).toBe(false);
    expect(appointmentCreateSchema.safeParse({ ...a, endsAt: '2027-01-01T12:00:00-05:00' }).success).toBe(true);
  });
});
