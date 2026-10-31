import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { ipHash } from '../src/lib/crypto.ts';
import { processOutbox } from '../src/modules/notify/service.ts';
import { consultation, makeCtx, ORIGIN, resetDb, signIn, STUDIO, type Ctx } from './helpers.ts';

let ctx: Ctx;
beforeAll(async () => {
  ctx = await makeCtx();
});
afterAll(() => ctx.close());
beforeEach(() => resetDb(ctx));

const submit = (body: object, c = ctx) => c.app.inject({ method: 'POST', url: '/api/public/consultations', payload: body, headers: { origin: ORIGIN } });

describe('submitting a consultation', () => {
  it('answers 201 with a receipt only after everything is stored together', async () => {
    const r = await submit(consultation());
    expect(r.statusCode).toBe(201);
    const receipt = r.json();
    expect(receipt.receiptId).toMatch(/^YT-[A-Z2-9]{8}$/);
    expect(receipt.duplicate).toBe(false);

    const inquiry = await ctx.db.selectFrom('inquiries').selectAll().executeTakeFirstOrThrow();
    expect(inquiry).toMatchObject({ public_ref: receipt.receiptId, status: 'submitted', demo: false });
    expect(inquiry.summary).toMatchObject({ concept: 'A lion with a crown', bodyArea: 'forearm' });
    expect(inquiry.consent_at).toBeTruthy();
    expect(inquiry.ip_hash).toMatch(/^[0-9a-f]{32}$/);
    // keyed with the server's secret: not a plain hash anyone could rebuild by trying addresses
    const day = new Date().toISOString().slice(0, 10);
    expect(inquiry.ip_hash).toBe(ipHash('127.0.0.1', ctx.config.TOTP_ENC_KEY, day));
    expect(inquiry.ip_hash).not.toBe(createHash('sha256').update(`${day}:127.0.0.1`).digest('hex').slice(0, 32));
    const client = await ctx.db.selectFrom('clients').selectAll().executeTakeFirstOrThrow();
    expect(client).toMatchObject({ name: 'Test Client', email: 'client@example.test', phone: '+1 313 555 0100', instagram: 'test.client' });
    const refs = await ctx.db.selectFrom('inquiry_references').select(['work_number', 'position']).orderBy('position').execute();
    expect(refs.map((x) => x.work_number)).toEqual([4, 8]);
    const log = await ctx.db.selectFrom('activity_log').selectAll().execute();
    expect(log.map((l) => l.action)).toContain('inquiry.submitted');
    // the history holds no contact details (the full number: a random id can contain "555")
    expect(JSON.stringify(log)).not.toMatch(/client@example|Test Client|313 555 0100/);
    const mail = await ctx.db.selectFrom('email_outbox').select(['to_address', 'template']).execute();
    expect(mail.map((m) => m.template).sort()).toEqual(['inquiry-receipt-client']);
  });

  it('notifies the studio when a notification address is known', async () => {
    await ctx.db.updateTable('studio_settings').set({ notify_email: 'studio@example.test' }).execute();
    await submit(consultation());
    const mail = await ctx.db.selectFrom('email_outbox').select(['to_address', 'template']).orderBy('template').execute();
    expect(mail).toEqual([
      { to_address: 'client@example.test', template: 'inquiry-receipt-client' },
      { to_address: 'studio@example.test', template: 'inquiry-received-owner' },
    ]);
  });

  it('files the same draft once, however often it is sent - even at the same moment', async () => {
    const body = consultation();
    const first = await submit(body);
    const again = await submit(body);
    expect(again.statusCode).toBe(200);
    expect(again.json()).toMatchObject({ receiptId: first.json().receiptId, duplicate: true });
    const racing = consultation();
    const results = await Promise.all(Array.from({ length: 5 }, () => submit(racing)));
    expect(results.every((r) => r.statusCode === 200 || r.statusCode === 201)).toBe(true);
    expect(new Set(results.map((r) => r.json().receiptId)).size).toBe(1);
    const count = await ctx.db.selectFrom('inquiries').select((eb) => eb.fn.countAll<number>().as('n')).executeTakeFirstOrThrow();
    expect(Number(count.n)).toBe(2);
    // one receipt per inquiry: a retried or racing send never queues a second email
    const receipts = await ctx.db.selectFrom('email_outbox').select('template').where('template', '=', 'inquiry-receipt-client').execute();
    expect(receipts).toHaveLength(2);
  });

  it('an email outage never turns a stored inquiry into a failure for the visitor', async () => {
    ctx.mailer.failing = true;
    try {
      const r = await submit(consultation());
      // the visitor's answer depends only on the database write
      expect(r.statusCode).toBe(201);
      // the worker's send fails later, in the background: the receipt waits to be retried
      expect(await processOutbox(ctx.db, ctx.mailer)).toMatchObject({ sent: 0, retrying: 1 });
      const mail = await ctx.db.selectFrom('email_outbox').select(['status', 'attempts', 'last_error']).executeTakeFirstOrThrow();
      expect(mail).toMatchObject({ status: 'pending', attempts: 1 });
      expect(mail.last_error).toBeTruthy();
      // the inquiry is untouched by it
      expect(await ctx.db.selectFrom('inquiries').select('status').execute()).toEqual([{ status: 'submitted' }]);
    } finally {
      ctx.mailer.failing = false;
    }
  });

  it('refuses a reused draft id with different contact details', async () => {
    const body = consultation();
    await submit(body);
    const clash = await submit({ ...body, contact: { ...body.contact, email: 'someone.else@example.test' } });
    expect(clash.statusCode).toBe(409);
  });

  it('links a returning client by email without overwriting their details', async () => {
    await submit(consultation({ contact: { name: 'Test Client', email: 'client@example.test' } }));
    await submit(consultation({ contact: { name: 'Another Name', email: 'CLIENT@example.test', phone: '+1 313 555 0199' } }));
    const clients = await ctx.db.selectFrom('clients').selectAll().execute();
    expect(clients).toHaveLength(1);
    expect(clients[0]).toMatchObject({ name: 'Test Client', phone: '+1 313 555 0199' });
    expect(await ctx.db.selectFrom('inquiries').select('client_id').execute()).toHaveLength(2);
  });

  it('turns away bots (honeypot, impossible speed) and storing nothing', async () => {
    expect((await submit(consultation({ website: 'http://spam.example' }))).statusCode).toBe(400);
    expect((await submit(consultation({ startedAt: new Date().toISOString() }))).statusCode).toBe(400);
    expect(await ctx.db.selectFrom('inquiries').select('id').execute()).toHaveLength(0);
    // and nothing refused is ever emailed
    expect(await ctx.db.selectFrom('email_outbox').select('id').execute()).toHaveLength(0);
  });

  it('validates every field and names the problems', async () => {
    const r = await submit(consultation({ contact: { name: '', email: 'not-an-email', instagram: 'bad handle!' }, consent: false }));
    expect(r.statusCode).toBe(400);
    const fields = r.json().fields;
    expect(Object.keys(fields)).toEqual(expect.arrayContaining(['contact.name', 'contact.email', 'contact.instagram', 'consent']));
    const tooLong = await submit(consultation({ summary: { concept: 'x'.repeat(501) } }));
    expect(tooLong.statusCode).toBe(400);
    const badEntry = await submit(consultation({ entry: { from: 'find-similar', workId: '../../etc' } }));
    expect(badEntry.statusCode).toBe(400);
  });

  it('the public endpoints expose nothing private', async () => {
    await submit(consultation());
    const content = await ctx.app.inject({ method: 'GET', url: '/api/public/content' });
    expect(content.statusCode).toBe(200);
    expect(content.body).not.toMatch(/client@example|Test Client|YT-/);
    expect((await ctx.app.inject({ method: 'GET', url: '/api/studio/overview' })).statusCode).toBe(401);
  });

  it('appears in the dashboard straight away', async () => {
    const { cookie } = await signIn(ctx);
    const r = await submit(consultation());
    const overview = (await ctx.app.inject({ method: 'GET', url: '/api/studio/overview', headers: { cookie } })).json();
    expect(overview.inquiries).toHaveLength(1);
    expect(overview.inquiries[0]).toMatchObject({ clientName: 'Test Client', status: 'submitted', publicRef: r.json().receiptId, demo: false });
    const detail = (await ctx.app.inject({ method: 'GET', url: `/api/studio/inquiries/${overview.inquiries[0].id}`, headers: { cookie } })).json();
    expect(detail.client).toMatchObject({ email: 'client@example.test', instagram: 'test.client' });
    expect(detail.references.map((x: { workId: string }) => x.workId)).toEqual(['04', '08']);
  });
});

describe('rate limits (on, as in production)', () => {
  it('the public form allows 5 sends per 10 minutes per address', async () => {
    const limited = await makeCtx({ env: { RATE_LIMITS: 'true' } });
    try {
      const codes = [];
      for (let i = 0; i < 6; i++) codes.push((await submit(consultation(), limited)).statusCode);
      expect(codes.slice(0, 5).every((c) => c === 201)).toBe(true);
      expect(codes[5]).toBe(429);
      const login = await limited.app.inject({ method: 'POST', url: '/api/auth/login', headers: STUDIO, payload: { email: 'a@b.test', password: 'whatever-password' } });
      expect(login.statusCode).toBe(401);
    } finally {
      await limited.close();
    }
  });
});
