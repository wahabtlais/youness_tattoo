import { readFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';
import pg from 'pg';

/**
 * A client of the portal, for the browser tests: registered through the
 * site's own pages and confirmed through the link in the email - read from
 * the outbox of the *test* database (server/test/e2e-server.ts; nothing is
 * sent anywhere).
 */

function testDatabaseUrl() {
  const line = readFileSync('server/.env', 'utf8')
    .split(/\r?\n/)
    .find((l) => l.startsWith('TEST_DATABASE_URL='));
  const url = (process.env.TEST_DATABASE_URL ?? line?.slice('TEST_DATABASE_URL='.length) ?? '').replace(/^"|"$/g, '');
  if (!url || !new URL(url).pathname.endsWith('_test')) throw new Error('The browser tests read only the *_test database');
  return url;
}

/** the newest one-time link of a kind sent to an address, as its path on the site */
export async function linkFor(email: string, template: 'client-verify-email' | 'client-password-reset') {
  const c = new pg.Client({ connectionString: testDatabaseUrl() });
  await c.connect();
  try {
    const r = await c.query(`select payload from email_outbox where to_address = $1 and template = $2 order by created_at desc limit 1`, [email, template]);
    const link = new URL(r.rows[0].payload.link);
    return `${link.pathname}${link.search}`;
  } finally {
    await c.end();
  }
}

/** register on the site, confirm the email, and arrive in the portal */
export async function registerClient(page: Page, who: { name: string; email: string; password?: string }) {
  await page.goto('/account?mode=register');
  await page.getByLabel(/Your name/).fill(who.name);
  await page.getByLabel(/^Email/).fill(who.email);
  await page.getByLabel(/^Password/).fill(who.password ?? 'a long e2e client password');
  await page.getByLabel(/I’ve read how my details are used/).check();
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'Check your inbox.' })).toBeVisible();
  await page.goto(await linkFor(who.email, 'client-verify-email'));
  await expect(page).toHaveURL(/\/portal$/);
}

/** the studio's record id for a client's account email (test database) */
export async function clientIdFor(email: string) {
  const c = new pg.Client({ connectionString: testDatabaseUrl() });
  await c.connect();
  try {
    const r = await c.query(`select client_id from client_accounts where email = $1`, [email]);
    return r.rows[0].client_id as string;
  } finally {
    await c.end();
  }
}

/** an appointment's start, as stored (UTC) */
export async function appointmentStart(title: string) {
  const c = new pg.Client({ connectionString: testDatabaseUrl() });
  await c.connect();
  try {
    const r = await c.query(`select starts_at, status from appointments where title = $1 order by created_at desc limit 1`, [title]);
    return { startsAt: new Date(r.rows[0].starts_at).toISOString(), status: r.rows[0].status as string };
  } finally {
    await c.end();
  }
}
