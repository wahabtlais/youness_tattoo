import { buildApp } from './app.ts';
import { loadConfig, loadEnvFiles } from './config.ts';
import { createDb, type DB } from './db/index.ts';
import { diskStorage } from './lib/storage.ts';
import type { Deps } from './lib/http.ts';
import { openRouter } from './modules/ai/openrouter.ts';
import { applyRetention } from './modules/inquiries/service.ts';
import { cleanupMedia } from './modules/media/service.ts';
import { processOutbox, releaseStuck, smtpMailer } from './modules/notify/service.ts';

/**
 * The API process: the HTTP server, and a small worker in the same process
 * (one server, no queue service): it sends due emails every 15 seconds and,
 * hourly, applies the retention policy, cleans up orphaned media and old
 * sessions. Each job runs one at a time and logs, never throws.
 */

loadEnvFiles();
const config = loadConfig();
const db = createDb(config.DATABASE_URL);
const deps: Deps = {
  db,
  config,
  storage: diskStorage(config.STORAGE_DIR),
  mailer: smtpMailer(config),
  ai: config.aiConfigured ? openRouter(config) : null,
  now: () => new Date(),
};
const app = await buildApp(deps);

function every(ms: number, name: string, job: () => Promise<unknown>) {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const r = await job();
      if (r && typeof r === 'object' && Object.values(r).some((v) => typeof v === 'number' && v > 0)) app.log.info({ job: name, ...r }, 'worker');
    } catch (err) {
      app.log.error({ err, job: name }, 'worker job failed');
    } finally {
      running = false;
    }
  };
  setTimeout(tick, 2000);
  return setInterval(tick, ms);
}

async function housekeeping(d: DB) {
  const anonymised = await applyRetention(d);
  const media = await cleanupMedia(d, deps.storage);
  const expired = await d
    .deleteFrom('sessions')
    .where((eb) => eb.or([eb('absolute_expires_at', '<', new Date(Date.now() - 7 * 86_400_000)), eb('revoked_at', '<', new Date(Date.now() - 7 * 86_400_000))]))
    .executeTakeFirst();
  await d.deleteFrom('auth_attempts').where('window_start', '<', new Date(Date.now() - 86_400_000)).execute();
  await d.deleteFrom('password_resets').where('expires_at', '<', new Date(Date.now() - 86_400_000)).execute();
  return { anonymised, mediaRemoved: media.removed, strays: media.strays, sessionsPurged: Number(expired.numDeletedRows) };
}

const timers: NodeJS.Timeout[] = [];
if (config.workerEnabled) {
  timers.push(
    every(15_000, 'outbox', async () => {
      await releaseStuck(db);
      return processOutbox(db, deps.mailer);
    }),
  );
  timers.push(every(60 * 60_000, 'housekeeping', () => housekeeping(db)));
}

const shutdown = async (signal: string) => {
  app.log.info({ signal }, 'shutting down');
  timers.forEach(clearInterval);
  await app.close();
  await db.destroy();
  process.exit(0);
};
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

await app.listen({ host: config.HOST, port: config.PORT });
app.log.info(`API on http://${config.HOST}:${config.PORT} · site ${config.serveSite ? 'served here' : 'served by Vite (dev)'} · AI ${deps.ai ? 'on' : 'off'} · worker ${config.workerEnabled ? 'on' : 'off'}`);
