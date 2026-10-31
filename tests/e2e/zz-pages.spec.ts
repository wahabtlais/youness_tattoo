import { expect, test } from '@playwright/test';

test('every studio page loads from the API without a script error', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const [path, heading] of [
    ['/studio', null],
    ['/studio/inquiries', 'Inquiries'],
    ['/studio/clients', 'Clients'],
    ['/studio/calendar', 'Calendar'],
    ['/studio/portfolio', 'Portfolio'],
    ['/studio/publishing/journal', 'Journal & Canvas Calls'],
    ['/studio/website', 'Website Management'],
    ['/studio/assistant', 'Assistant'],
    ['/studio/settings', 'Settings'],
  ] as const) {
    await page.goto(path);
    await expect(page.getByRole('navigation', { name: 'Studio' })).toBeVisible();
    if (heading) await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    await expect(page.getByText(/couldn’t be loaded/)).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});

test('portfolio: an uploaded piece starts private, and publishing puts it on the site', async ({ page, browser }) => {
  await page.goto('/studio/portfolio');
  await page.getByRole('button', { name: 'Add a piece' }).click();
  await page.getByLabel(/Photograph/).setInputFiles('public/youness_tattoo_logo_dark.png');
  await page.getByLabel(/Describe the photograph/).fill('E2E upload: the studio logo');
  await page.getByLabel(/^Title/).fill('E2E piece');
  await page.getByRole('button', { name: 'Upload' }).click();
  await expect(page.getByRole('heading', { name: /E2E piece/ })).toBeVisible();
  await expect(page.getByText('Private', { exact: true })).toBeVisible();
  // the studio shows the unpublished photograph (through its signed-in route), and visitors can't fetch it
  const img = page.getByRole('article').locator('img').first();
  await expect.poll(() => img.evaluate((i) => (i as unknown as { complete: boolean; naturalWidth: number }).complete && (i as unknown as { naturalWidth: number }).naturalWidth)).toBeGreaterThan(0);
  const src = (await img.getAttribute('src'))!;
  expect(src).toMatch(/^\/api\/studio\/media\//);
  expect((await browser.newContext({ baseURL: 'http://localhost:5301', storageState: { cookies: [], origins: [] } }).then((v) => v.request.get(src))).status()).toBe(401);
  const number = (await page.getByText(/^Piece \d\d$/).first().textContent())!.slice(-2);

  const visitor = await browser.newContext({ baseURL: 'http://localhost:5301', storageState: { cookies: [], origins: [] } });
  const site = await visitor.newPage();
  expect((await site.request.get(`/api/public/content`)).ok()).toBe(true);
  const live = async () => ((await (await site.request.get('/api/public/content')).json()) as { works: { id: string }[] }).works.some((w) => w.id === number);
  expect(await live()).toBe(false);

  await page.getByRole('button', { name: 'Publish to the site' }).click();
  await expect(page.getByText('On the site', { exact: true })).toBeVisible();
  expect(await live()).toBe(true);
  await visitor.close();
});

test('settings: the studio settings save, and devices are listed', async ({ page }) => {
  await page.goto('/studio/settings');
  await page.getByLabel(/Keep closed clients for/).fill('18');
  await page.getByRole('button', { name: 'Save settings' }).click();
  await expect(page.getByRole('status').filter({ hasText: /^Saved.$/ })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel(/Keep closed clients for/)).toHaveValue('18');
  await expect(page.getByText('This device')).toBeVisible();
});
