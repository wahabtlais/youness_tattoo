import { readFileSync, writeFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';
import * as OTPAuth from 'otpauth';

/** the owner the first-run test creates (test database only) */
export const OWNER = { name: 'Younes', email: 'owner@e2e.test', password: 'a long e2e password 123' };
export const SETUP_TOKEN = 'e2e-setup-token-0123456789abcdef';
export const STATE = 'test-results/e2e-owner.json';
const SECRET_FILE = 'test-results/e2e-totp.txt';

export const saveSecret = (s: string) => writeFileSync(SECRET_FILE, s);
export const savedSecret = () => readFileSync(SECRET_FILE, 'utf8').trim();

/** a code the server hasn't seen yet: it refuses a step twice, so wait for the next one if needed */
let lastStep = 0;
export async function totp(secret: string) {
  let step = Math.floor(Date.now() / 30_000);
  if (step <= lastStep) {
    await new Promise((r) => setTimeout(r, (lastStep + 1) * 30_000 - Date.now() + 250));
    step = Math.floor(Date.now() / 30_000);
  }
  lastStep = step;
  return new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret), digits: 6, period: 30, algorithm: 'SHA1' }).generate();
}

/** sign in from the studio's front door: password, then the authenticator code */
export async function signIn(page: Page) {
  await page.goto('/studio');
  await page.getByLabel('Email').fill(OWNER.email);
  await page.getByLabel('Password').fill(OWNER.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('textbox', { name: 'Code' }).fill(await totp(savedSecret()));
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('navigation', { name: 'Studio' })).toBeVisible();
}
