import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { enqueue, processOutbox, smtpMailer } from '../src/modules/notify/service.ts';
import { render } from '../src/modules/notify/templates.ts';
import { makeCtx, resetDb, signIn, STUDIO, type Ctx } from './helpers.ts';

let ctx: Ctx;
beforeAll(async () => {
  ctx = await makeCtx();
});
afterAll(() => ctx.close());
beforeEach(async () => {
  await resetDb(ctx);
  ctx.mails.length = 0;
  ctx.mailer.failing = false;
});

const due = () => ctx.db.updateTable('email_outbox').set({ send_after: new Date(Date.now() - 1000) }).where('status', '=', 'pending').execute();

describe('the email queue', () => {
  it('sends what’s due and marks it sent', async () => {
    await enqueue(ctx.db, { to: 'a@example.test', template: 'inquiry-receipt-client', payload: { name: 'A', ref: 'YT-TEST0001' } });
    expect(await processOutbox(ctx.db, ctx.mailer)).toEqual({ sent: 1, failed: 0, retrying: 0 });
    expect(ctx.mails[0]).toMatchObject({ to: 'a@example.test', subject: 'Younes received your tattoo idea' });
    expect((await ctx.db.selectFrom('email_outbox').select('status').executeTakeFirstOrThrow()).status).toBe('sent');
    expect(await processOutbox(ctx.db, ctx.mailer)).toEqual({ sent: 0, failed: 0, retrying: 0 });
  });

  it('retries a failed send with backoff, then marks it failed; the studio can retry it', async () => {
    const { cookie } = await signIn(ctx);
    await enqueue(ctx.db, { to: 'b@example.test', template: 'inquiry-receipt-client', payload: { name: 'B', ref: 'YT-TEST0002' } });
    ctx.mailer.failing = true;
    expect(await processOutbox(ctx.db, ctx.mailer)).toEqual({ sent: 0, failed: 0, retrying: 1 });
    let row = await ctx.db.selectFrom('email_outbox').selectAll().executeTakeFirstOrThrow();
    expect(row).toMatchObject({ status: 'pending', attempts: 1, last_error: 'SMTP connection refused (test)' });
    expect(new Date(row.send_after).getTime()).toBeGreaterThan(Date.now() + 30_000);
    // not due yet: nothing happens
    expect(await processOutbox(ctx.db, ctx.mailer)).toEqual({ sent: 0, failed: 0, retrying: 0 });
    for (let i = 0; i < 4; i++) {
      await due();
      await processOutbox(ctx.db, ctx.mailer);
    }
    row = await ctx.db.selectFrom('email_outbox').selectAll().executeTakeFirstOrThrow();
    expect(row).toMatchObject({ status: 'failed', attempts: 5 });
    const list = (await ctx.app.inject({ method: 'GET', url: '/api/studio/outbox', headers: { cookie } })).json();
    expect(list[0]).toMatchObject({ status: 'failed', lastError: 'SMTP connection refused (test)' });

    ctx.mailer.failing = false;
    expect((await ctx.app.inject({ method: 'POST', url: `/api/studio/outbox/${row.id}/retry`, headers: { ...STUDIO, cookie } })).statusCode).toBe(200);
    expect(await processOutbox(ctx.db, ctx.mailer)).toEqual({ sent: 1, failed: 0, retrying: 0 });
    expect((await ctx.app.inject({ method: 'POST', url: `/api/studio/outbox/${row.id}/retry`, headers: { ...STUDIO, cookie } })).statusCode).toBe(404);
  });

  it('two workers never send the same message twice', async () => {
    for (let i = 0; i < 6; i++) await enqueue(ctx.db, { to: `c${i}@example.test`, template: 'inquiry-receipt-client', payload: { name: 'C', ref: `YT-TEST000${i}` } });
    const [a, b] = await Promise.all([processOutbox(ctx.db, ctx.mailer, 6), processOutbox(ctx.db, ctx.mailer, 6)]);
    expect(a.sent + b.sent).toBe(6);
    expect(new Set(ctx.mails.map((m) => m.to)).size).toBe(6);
    expect(ctx.mails).toHaveLength(6);
  });

  it('escapes whatever a visitor wrote in the HTML', () => {
    const r = render('inquiry-received-owner', { name: '<img src=x onerror=alert(1)>', ref: 'YT-1', concept: '<b>bold</b>', link: 'http://localhost:5201/studio' });
    expect(r.html).not.toMatch(/<img|<b>/);
    expect(r.html).toContain('&lt;img');
  });
});

describe('real SMTP, into Mailpit (local only - nothing is delivered)', () => {
  it('a message sent through the configured SMTP transport arrives in Mailpit', async () => {
    const api = 'http://127.0.0.1:58025/api/v1';
    const up = await fetch(`${api}/messages`).catch(() => null);
    if (!up?.ok) throw new Error('Mailpit is not running (npm run db:up starts it)');
    const subject = `Younes test ${crypto.randomUUID()}`;
    await smtpMailer(ctx.config).send({ to: 'mailpit-check@example.test', subject, text: 'hello', html: '<p>hello</p>' });
    const found = await fetch(`${api}/search?query=${encodeURIComponent(`subject:"${subject}"`)}`).then((r) => r.json() as Promise<{ messages: { Subject: string }[] }>);
    expect(found.messages.map((m) => m.Subject)).toContain(subject);
  });
});
