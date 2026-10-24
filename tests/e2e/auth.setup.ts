import { expect, test } from '@playwright/test';
import { OWNER, saveSecret, SETUP_TOKEN, signIn, STATE, totp } from './owner.ts';

test('first run: the owner is created, two-factor is required and enrolled, then sign-in needs both', async ({ page, context }) => {
  // two authenticator codes must come from different 30-second steps
  test.setTimeout(120_000);
  // the studio, unclaimed, offers only setup
  await page.goto('/studio');
  await expect(page.getByRole('heading', { name: 'Set up the studio' })).toBeVisible();

  // a wrong setup token is refused
  await page.getByLabel('Setup token').fill('not-the-token-at-all-0000000');
  await page.getByLabel('Your name').fill(OWNER.name);
  await page.getByLabel('Email').fill(OWNER.email);
  await page.getByLabel('Password').fill(OWNER.password);
  await page.getByRole('button', { name: 'Create the owner account' }).click();
  await expect(page.getByRole('heading', { name: 'Set up the studio' })).toBeVisible();
  await expect(page.locator('[role=alert]').first()).toBeVisible();

  await page.getByLabel('Setup token').fill(SETUP_TOKEN);
  await page.getByRole('button', { name: 'Create the owner account' }).click();

  // two-factor before anything else
  await expect(page.getByRole('heading', { name: 'Set up two-factor sign-in' })).toBeVisible();
  await page.getByText('Can’t scan it? Enter this key instead').click();
  const secret = (await page.locator('details p').textContent())!.trim();
  expect(secret).toMatch(/^[A-Z2-7]{16,}$/);
  saveSecret(secret);
  await page.getByLabel('Code from the app').fill('000000');
  await page.getByRole('button', { name: 'Turn on two-factor sign-in' }).click();
  await expect(page.locator('[role=alert]').first()).toBeVisible();
  await page.getByLabel('Code from the app').fill(await totp(secret));
  await page.getByRole('button', { name: 'Turn on two-factor sign-in' }).click();

  await expect(page.getByRole('heading', { name: 'Keep these recovery codes' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Recovery codes' }).getByRole('listitem')).toHaveCount(10);
  await page.getByLabel('I’ve saved them').check();
  await page.getByRole('button', { name: 'Open the studio' }).click();
  await expect(page.getByRole('navigation', { name: 'Studio' })).toBeVisible();

  // a fresh browser: the password alone isn't enough
  await context.clearCookies();
  await page.goto('/studio');
  await page.getByLabel('Email').fill(OWNER.email);
  await page.getByLabel('Password').fill('a wrong password entirely');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.locator('[role=alert]').first()).toBeVisible();
  await page.getByLabel('Password').fill(OWNER.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Enter your code' })).toBeVisible();
  // the private API stays closed (403: signed in, second step not done)
  const half = await page.evaluate(() => fetch('/api/studio/overview').then((r) => r.status));
  expect(half).toBe(403);

  await context.clearCookies();
  await signIn(page);
  await context.storageState({ path: STATE });
});
