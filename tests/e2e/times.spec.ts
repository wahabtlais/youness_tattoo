import { expect, test } from '@playwright/test';
import { appointmentStart, clientIdFor, registerClient } from './client.ts';

/**
 * Studio time, through browsers in different time zones: Younes proposes a
 * session from a computer set to Berlin, a client reads and accepts it from
 * Tokyo, and the same client in Detroit sees just the one time. The studio's
 * time is Detroit's throughout - never the browser's.
 */

const SITE = 'http://localhost:5301';
const STUDIO = { origin: SITE, 'x-requested-with': 'younes-studio' };

test('a session proposed in Detroit time from Berlin is read correctly in Tokyo and Detroit, and accepted from the portal', async ({ browser }) => {
  const studioCtx = await browser.newContext({ baseURL: SITE, storageState: 'test-results/e2e-owner.json', timezoneId: 'Europe/Berlin' });
  const studio = await studioCtx.newPage();
  const tokyoCtx = await browser.newContext({ baseURL: SITE, storageState: { cookies: [], origins: [] }, timezoneId: 'Asia/Tokyo' });
  const tokyo = await tokyoCtx.newPage();
  await registerClient(tokyo, { name: 'Time Client', email: 'time@e2e.test' });

  // a project for them; Younes proposes 11:00-13:00 on 12 January 2027 from the project page - in Detroit time
  const clientId = await clientIdFor('time@e2e.test');
  const created = await studio.request.post('/api/studio/projects', { headers: STUDIO, data: { clientId, title: 'Time piece' } });
  const { id: projectId } = await created.json();
  await studio.goto(`/studio/projects/${projectId}`);
  await expect(studio.getByText('times in Detroit time')).toBeVisible();
  await studio.getByLabel('Day', { exact: true }).fill('2027-01-12');
  await studio.getByLabel('From', { exact: true }).fill('11:00');
  await studio.getByLabel('Until', { exact: true }).fill('13:00');
  await studio.getByRole('button', { name: /Propose this time/ }).click();
  await expect(studio.getByText(/Tuesday, January 12, 2027 at 11:00\s?AM/)).toBeVisible();
  // stored as the instant 11:00 EST is - not 11:00 in Berlin
  expect(await appointmentStart('Time piece')).toEqual({ startsAt: '2027-01-12T16:00:00.000Z', status: 'proposed' });

  // in Tokyo: the studio's time, named, and theirs (already the next day there)
  await tokyo.goto('/portal/appointments');
  await expect(tokyo.getByText('Proposed by Younes · not yet confirmed')).toBeVisible();
  await expect(tokyo.getByText(/11:00\s?AM – 1:00\s?PM · Detroit time \(EST\)/)).toBeVisible();
  await expect(tokyo.getByText(/Wednesday, January 13 · 1:00\s?AM – 3:00\s?AM · your time \(GMT\+9\)/)).toBeVisible();
  await tokyo.getByRole('button', { name: 'Accept this time' }).click();
  await expect(tokyo.getByText('Confirmed', { exact: true })).toBeVisible();
  expect((await appointmentStart('Time piece')).status).toBe('confirmed');

  // the same client in Detroit: one time, no second line
  const detroitCtx = await browser.newContext({ baseURL: SITE, storageState: await tokyoCtx.storageState(), timezoneId: 'America/Detroit' });
  const detroit = await detroitCtx.newPage();
  await detroit.goto('/portal/appointments');
  await expect(detroit.getByText(/11:00\s?AM – 1:00\s?PM · Detroit time \(EST\)/)).toBeVisible();
  await expect(detroit.getByText(/your time/)).toHaveCount(0);

  // the studio's calendar, in Berlin, shows it on the 12th at 11:00, confirmed
  await studio.goto('/studio/calendar?view=day&date=2027-01-12');
  await expect(studio.getByRole('button', { name: /11:00\s?AM–1:00\s?PM, Time Client.*Confirmed/ }).first()).toBeVisible();
  await Promise.all([studioCtx.close(), tokyoCtx.close(), detroitCtx.close()]);
});
