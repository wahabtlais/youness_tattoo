import { expect, test, type Page } from '@playwright/test';
import { signIn } from './owner.ts';

const consultationDialog = (page: Page) => page.locator('dialog[open][aria-labelledby="consultationTitle"]');

test('a consultation sent from the website arrives in the studio, with its contact details', async ({ browser, page }) => {
  // the public site, in a separate visitor's browser (no studio session)
  const visitor = await browser.newContext({ baseURL: 'http://localhost:5301', storageState: { cookies: [], origins: [] } });
  const site = await visitor.newPage();
  await site.goto('/');
  await site.locator('#book').getByRole('button', { name: /Start a consultation/ }).click();
  const c = consultationDialog(site);
  await c.getByLabel(/What would you like to get tattooed/).fill('An e2e heron in the reeds');
  const next = () => c.getByRole('button', { name: /^(Continue|Back to review)$/ }).click();
  await next();
  await next();
  await next();
  // the contact step: name and email required, consent required
  await expect(c.getByText(/Your email/)).toBeVisible();
  await next();
  await expect(c.locator('[aria-invalid=true]').first()).toBeVisible();
  await c.getByLabel(/Your name/).fill('E2E Visitor');
  await c.getByLabel(/Your email/).fill('visitor@e2e.test');
  await c.getByLabel(/Instagram/).fill('@e2e.visitor');
  await c.getByLabel(/I’ve read how my details are used/).check();
  await next();
  await expect(c.getByText('An e2e heron in the reeds')).toBeVisible();
  await c.getByRole('button', { name: 'Send to Younes' }).click();
  await expect(c.getByText('Thank you — I’ve received your idea.')).toBeVisible();
  const ref = (await c.getByText(/YT-[A-Z0-9]{8}/).first().textContent())!.match(/YT-[A-Z0-9]{8}/)![0];
  await visitor.close();

  // in the studio: listed as new, with the reference, contact and consent
  await page.goto('/studio/inquiries/new');
  await page.getByRole('link', { name: /E2E Visitor/ }).first().click();
  await expect(page.getByRole('heading', { name: 'E2E Visitor' })).toBeVisible();
  await expect(page.getByText(ref)).toBeVisible();
  await expect(page.getByRole('link', { name: 'visitor@e2e.test' })).toBeVisible();
  await expect(page.getByText('@e2e.visitor')).toBeVisible();

  // a status change and a private note are saved - still there after a reload
  await page.getByLabel('Move to a stage').first().selectOption('under-review');
  await expect(page.getByText(/Saved: now/)).toBeVisible();
  await page.getByRole('button', { name: 'Add a private note' }).click();
  await page.getByRole('textbox', { name: 'Private note' }).fill('Call back about the reeds');
  await page.getByRole('button', { name: 'Add note' }).click();
  await expect(page.getByText('Call back about the reeds')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Call back about the reeds')).toBeVisible();
  await expect(page.getByLabel('Move to a stage').first()).toHaveValue('under-review');
});

test('clients: the record shows the contact details, and a follow-up can be added and done', async ({ page }) => {
  await page.goto('/studio/clients');
  await page.getByRole('link', { name: /E2E Visitor/ }).first().click();
  await expect(page.getByRole('link', { name: 'visitor@e2e.test' })).toBeVisible();
  await page.getByRole('button', { name: 'Add a follow-up' }).click();
  const due = new Date(Date.now() + 2 * 86_400_000);
  await page.getByLabel('Due').fill(`${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(due.getDate()).padStart(2, '0')}`);
  await page.getByLabel('What for').fill('Send the e2e sketch');
  await page.getByRole('button', { name: 'Add follow-up' }).click();
  await expect(page.getByText('Send the e2e sketch')).toBeVisible();
  await page.getByRole('listitem').filter({ hasText: 'Send the e2e sketch' }).getByRole('button', { name: 'Done' }).click();
  await expect(page.getByText('Send the e2e sketch')).toHaveCount(0);
});

test('website content: a draft is saved and stays private, then published, then rolled back', async ({ page, browser }) => {
  const visitor = await browser.newContext({ baseURL: 'http://localhost:5301', storageState: { cookies: [], origins: [] } });
  const site = await visitor.newPage();
  const edited = 'Every line here is his own (e2e).';

  await page.goto('/studio/website');
  await page.getByRole('button', { name: /^The artist/ }).click();
  const headline = page.getByRole('textbox', { name: 'Headline', exact: true });
  const before = await headline.inputValue();
  await headline.fill(edited);
  await page.getByRole('button', { name: 'Save to draft' }).click();
  await expect(page.getByText('The artist: saved to the draft. Visitors still see the published version until you publish.')).toBeVisible();

  // a saved draft is the studio's alone - and survives a reload
  await site.goto('/');
  await expect(site.getByText(before).first()).toBeVisible();
  await expect(site.getByText(edited)).toHaveCount(0);
  await page.reload();
  await page.getByRole('button', { name: /^The artist/ }).click();
  await expect(page.getByRole('textbox', { name: 'Headline', exact: true })).toHaveValue(edited);

  // publish: the next page load shows it to everyone
  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(page.getByText(/Published as version 2\. Visitors see it on their next page load\./)).toBeVisible();
  await site.goto('/');
  await expect(site.getByText(edited).first()).toBeVisible();

  // roll back: version 1 is published again (as version 3)
  await page.getByRole('list', { name: 'Versions' }).getByRole('button', { name: 'Restore' }).first().click();
  await expect(page.getByText(/version 3/i).first()).toBeVisible();
  await site.goto('/');
  await expect(site.getByText(before).first()).toBeVisible();
  await expect(site.getByText(edited)).toHaveCount(0);
  await visitor.close();
});

test('the calendar books an appointment and refuses an overlapping one', async ({ page }) => {
  const day = new Date(Date.now() + 20 * 86_400_000);
  const date = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
  await page.goto(`/studio/calendar?view=day&date=${date}`);

  const book = async (time: string) => {
    await page.getByRole('button', { name: 'New appointment' }).click();
    const form = page.getByRole('region', { name: 'New appointment' });
    await form.getByLabel('Date').fill(date);
    await form.getByLabel('Starts').fill(time);
    await form.getByLabel(/Length/).fill('60');
    await form.getByRole('button', { name: 'Book it' }).click();
    return form;
  };
  const first = await book('11:00');
  await expect(first).toHaveCount(0);
  await expect(page.getByRole('button', { name: /11:00/ }).first()).toBeVisible();

  const second = await book('11:30');
  await expect(second.getByRole('alert')).toContainText(/overlaps another appointment/);
  await second.getByRole('button', { name: 'Cancel', exact: true }).click();
});

test.describe('a separate session', () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test('signing out ends that session only', async ({ page }) => {
    test.setTimeout(90_000);
    await signIn(page);
    await page.getByRole('button', { name: 'Account' }).click();
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    expect(await page.evaluate(() => fetch('/api/studio/overview').then((r) => r.status))).toBe(401);
  });
});
