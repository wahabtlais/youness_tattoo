import nodemailer from 'nodemailer';
import { sql } from 'kysely';
import type { Config } from '../../config.ts';
import type { DB, Executor } from '../../db/index.ts';
import { render, type Template } from './templates.ts';

/**
 * Email, through a queue: a message is a row written in the same
 * transaction as the change that caused it (an inquiry, a reset request),
 * so it's never lost and never sent for something that didn't happen.
 * The worker sends what's due, retrying with backoff; after the last
 * attempt a message is 'failed' and the dashboard shows it, with a retry.
 *
 * Locally the transport is Mailpit (docker/compose.yaml): every message is
 * caught, none delivered. Production SMTP is configured, not coded.
 */

export interface Mailer {
  send(m: { to: string; subject: string; text: string; html: string }): Promise<void>;
}

export function smtpMailer(config: Config): Mailer {
  const transport = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_SECURE,
    auth: config.SMTP_USER ? { user: config.SMTP_USER, pass: config.SMTP_PASS } : undefined,
    connectionTimeout: 10_000,
    socketTimeout: 20_000,
  });
  return {
    async send(m) {
      await transport.sendMail({ from: config.MAIL_FROM, to: m.to, subject: m.subject, text: m.text, html: m.html });
    },
  };
}

export async function enqueue(
  db: Executor,
  m: { to: string; template: Template; payload: Record<string, unknown>; related?: { type: string; id: string } },
) {
  const { subject } = render(m.template, m.payload);
  await db
    .insertInto('email_outbox')
    .values({
      to_address: m.to,
      template: m.template,
      subject,
      payload: JSON.stringify(m.payload) as never,
      related_type: m.related?.type ?? null,
      related_id: m.related?.id ?? null,
    })
    .execute();
}

/** wait before attempt n+1: 1, 4, 16, 64 minutes */
const backoffMinutes = (attempts: number) => 4 ** Math.max(0, attempts - 1);

/**
 * Send what's due, once. Rows are claimed with SKIP LOCKED, so two workers
 * (or a manual run during a test) never send the same message twice.
 */
export async function processOutbox(db: DB, mailer: Mailer, limit = 10) {
  const results = { sent: 0, failed: 0, retrying: 0 };
  const claimed = await db
    .updateTable('email_outbox')
    // send_after doubles as "claimed at" while sending (see releaseStuck)
    .set({ status: 'sending', attempts: sql`attempts + 1`, send_after: new Date() })
    .where(
      'id',
      'in',
      db
        .selectFrom('email_outbox')
        .select('id')
        .where('status', '=', 'pending')
        // the database's clock: send_after defaults to its now(), and the app's clock can lag it by a millisecond or two
        .where('send_after', '<=', sql<Date>`now()`)
        .orderBy('send_after')
        .limit(limit)
        .forUpdate()
        .skipLocked(),
    )
    .returningAll()
    .execute();

  for (const m of claimed) {
    try {
      const r = render(m.template as Template, m.payload);
      await mailer.send({ to: m.to_address, subject: r.subject, text: r.text, html: r.html });
      await db.updateTable('email_outbox').set({ status: 'sent', sent_at: new Date(), last_error: null }).where('id', '=', m.id).execute();
      results.sent++;
    } catch (e) {
      const error = (e instanceof Error ? e.message : String(e)).slice(0, 500);
      const final = m.attempts >= m.max_attempts;
      await db
        .updateTable('email_outbox')
        .set({
          status: final ? 'failed' : 'pending',
          last_error: error,
          send_after: new Date(Date.now() + backoffMinutes(m.attempts) * 60_000),
        })
        .where('id', '=', m.id)
        .execute();
      if (final) results.failed++;
      else results.retrying++;
    }
  }
  return results;
}

/** a message left 'sending' by a crash goes back to the queue */
export async function releaseStuck(db: DB, olderThanMinutes = 10) {
  await db
    .updateTable('email_outbox')
    .set({ status: 'pending' })
    .where('status', '=', 'sending')
    .where('send_after', '<', new Date(Date.now() - olderThanMinutes * 60_000))
    .execute();
}

export async function retry(db: Executor, id: string) {
  const r = await db
    .updateTable('email_outbox')
    .set({ status: 'pending', send_after: new Date(), max_attempts: sql`greatest(max_attempts, attempts + 1)` })
    .where('id', '=', id)
    .where('status', '=', 'failed')
    .executeTakeFirst();
  return Number(r.numUpdatedRows) > 0;
}

export async function list(db: Executor, limit = 50) {
  const rows = await db.selectFrom('email_outbox').selectAll().orderBy('created_at', 'desc').limit(limit).execute();
  return rows.map((r) => ({
    id: r.id,
    to: r.to_address,
    template: r.template,
    subject: r.subject,
    status: r.status,
    attempts: r.attempts,
    maxAttempts: r.max_attempts,
    lastError: r.last_error,
    sentAt: r.sent_at ? new Date(r.sent_at).toISOString() : null,
    createdAt: new Date(r.created_at).toISOString(),
    sendAfter: new Date(r.send_after).toISOString(),
  }));
}
