import { expect, test, type Browser } from '@playwright/test';
import sharp from 'sharp';
import { registerClient } from './client.ts';

/**
 * The client portal, through the browser: a client sends an idea from their
 * account, Younes answers it in the studio and starts a project, the client
 * sees both - and another client, given the same address, sees nothing.
 */

const fresh = (browser: Browser) => browser.newContext({ baseURL: 'http://localhost:5301', storageState: { cookies: [], origins: [] } });

test('the portal: a request answered in the studio becomes a project the client follows, and only they can see it', async ({ browser, page }) => {
  // a client sends an idea from the portal's own "Start a new idea"
  const ctx = await fresh(browser);
  const client = await ctx.newPage();
  await registerClient(client, { name: 'Portal Client', email: 'portal@e2e.test' });
  await expect(client.getByText('Nothing here yet')).toBeVisible();
  await client.getByRole('button', { name: /Start a new idea/ }).first().click();
  const c = client.locator('dialog[open][aria-labelledby="consultationTitle"]');
  await c.getByLabel(/What would you like to get tattooed/).fill('A portal moth on the shoulder');
  // a reference image, private, sent with the request
  const png = await sharp({ create: { width: 400, height: 300, channels: 3, background: '#5a4a6a' } }).png().toBuffer();
  await c.locator('#consultationReferences').setInputFiles({ name: 'moth.png', mimeType: 'image/png', buffer: png });
  await expect(c.getByRole('img', { name: 'Your reference image 1' })).toBeVisible();
  const next = () => c.getByRole('button', { name: /^(Continue|Back to review)$/ }).click();
  await next();
  await next();
  await next();
  await c.getByLabel(/I’ve read how my details are used/).check();
  await next();
  await c.getByRole('button', { name: 'Send to Younes' }).click();
  await c.getByRole('link', { name: /Follow it in your account/ }).click();
  await expect(client.getByRole('heading', { name: 'A portal moth on the shoulder' })).toBeVisible();
  await expect(client.getByText('Pending').first()).toBeVisible();
  const requestUrl = client.url();

  // Younes, in the studio: writes to them and starts a project from the request
  await page.goto('/studio/inquiries/new');
  await page.getByRole('link', { name: /Portal Client/ }).first().click();
  await expect(page.getByText('Client account · verified')).toBeVisible();
  await expect(page.getByText('Sent with the request · 1')).toBeVisible();
  await page.getByLabel(/Write to Portal/).fill('Lovely idea - which shoulder?');
  await page.getByRole('button', { name: 'Send to client' }).click();
  await expect(page.getByText('Lovely idea - which shoulder?')).toBeVisible();
  await page.getByLabel('Start a project from this request').fill('Moth on the shoulder');
  await page.getByRole('button', { name: 'Start the project' }).click();
  await expect(page.getByRole('heading', { name: 'Moth on the shoulder' })).toBeVisible();
  const projectId = page.url().split('/').pop()!;

  // the client sees the message and the project
  await client.goto(requestUrl);
  await expect(client.getByText('Lovely idea - which shoulder?')).toBeVisible();
  await client.getByLabel('Write to Younes').fill('The left one, please.');
  await client.getByRole('button', { name: 'Send' }).click();
  await expect(client.getByText('The left one, please.')).toBeVisible();
  await client.goto('/portal/projects');
  await client.getByRole('link', { name: /Moth on the shoulder/ }).click();
  await expect(client.getByText('A portal moth on the shoulder')).toBeVisible();

  // and their reply reaches the studio's inbox
  await page.goto('/studio/projects');
  await expect(page.getByText(/Portal Client wrote/)).toBeVisible();

  // another client, with the same addresses, sees nothing of it
  const other = await fresh(browser);
  const stranger = await other.newPage();
  await registerClient(stranger, { name: 'Someone Else', email: 'else@e2e.test' });
  await stranger.goto(`/portal/projects/${projectId}`);
  await expect(stranger.getByText('That project doesn’t exist.')).toBeVisible();
  await stranger.goto(requestUrl.replace(/^https?:\/\/[^/]+/, ''));
  await expect(stranger.getByText('That request doesn’t exist.')).toBeVisible();
  await ctx.close();
  await other.close();
});
