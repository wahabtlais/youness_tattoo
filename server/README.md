# Younes Tattoo — server

The studio's own backend: one Node.js process (Fastify 5, TypeScript) over
PostgreSQL 17. It receives consultations from the website, runs the private
studio (`/studio`): inquiries, clients, calendar, portfolio, publishing, website
content and settings. It sends the studio's email, and in production it serves
the built public site with the published content written into the page.

There's no managed backend, no paid database and no outside sign-in provider.
The only optional outside service is OpenRouter for the assistant, and it's off
unless configured.

- [Layout](#layout)
- [Local setup](#local-setup)
- [Commands](#commands)
- [Configuration](#configuration)
- [Tests](#tests)
- [How it works](#how-it-works)
- [Security model](#security-model)
- [Backup and restore](#backup-and-restore)
- [Recovery](#recovery)
- [Production](#production)

## Layout

```
packages/contracts/   @younes/contracts - zod schemas and types shared by the site, the studio and the API
server/
├── src/
│   ├── main.ts       the process: HTTP server + a small worker (email every 15 s, housekeeping hourly)
│   ├── app.ts        buildApp(): plugins, the session hook, the CSRF check, errors, route registration
│   ├── config.ts     every environment variable, validated (zod); problems are named, values never printed
│   ├── cli.ts        setup | migrate | rollback | seed [--demo] | reset [--demo] | owner:create
│   ├── db/           Kysely over pg; types.ts (the schema), migrations/ (SQL, in order), seed/ (imports src/data)
│   ├── lib/          errors, http (session cookie, permissions, requireUser), storage (disk), crypto
│   └── modules/      one folder per area: auth, audit, inquiries, clients, calendar, content, media,
│                     portfolio, notify (email outbox), ai (OpenRouter), public (website API), studio (private API)
└── test/             Vitest integration tests against the real test database; e2e-server.ts for Playwright
docker/compose.yaml   local PostgreSQL + Mailpit, bound to 127.0.0.1 only
docker/production/    an example production stack (prepared only)
tests/e2e/            Playwright browser tests (site + studio, end to end)
```

## Local setup

You need Node.js 22.18 or newer (24 recommended) and Docker Desktop.

```bash
npm install
npm run setup          # writes docker/.env and server/.env with fresh random secrets (never overwrites a value)
npm run db:up          # PostgreSQL 17 on 127.0.0.1:55432, Mailpit on 127.0.0.1:51025 (UI http://127.0.0.1:58025)
npm run db:migrate
npm run db:seed        # imports the site's own content (works, journal, calls, testimonials, home-page words)
npm run db:seed:demo   # optional: the sample studio records (inquiries, clients, appointments), marked "Sample"
npm run dev:api        # the API on http://127.0.0.1:3001
npm run dev            # the site on http://localhost:5201 (proxies /api and /media to the API)
```

Then open http://localhost:5201/studio. On first visit it asks for the setup
token (`OWNER_SETUP_TOKEN` in `server/.env`) and creates the single owner
account, then requires two-factor sign-in (any authenticator app) and shows ten
recovery codes once. You can also create the owner from the command line:
`npm run owner:create`.

Email never leaves the machine: everything goes to Mailpit. To open the site
through a tunnel (such as the Cloudflare host in `vite.config.ts`), add that
origin to `EXTRA_ORIGINS` in `server/.env`, or state-changing requests from it
are refused.

## Commands

| Command (from the repo root) | What it does |
|---|---|
| `npm run setup` | Creates or fills `docker/.env` and `server/.env`. Existing values are kept. |
| `npm run db:up` / `db:down` | Starts or stops the local containers. The data stays in the named volume. |
| `npm run db:migrate` | Applies new migrations (as the schema-owner role). |
| `npm run db:rollback` | Undoes the latest migration. |
| `npm run db:seed` | Imports the site's content. Idempotent: an existing record is left as it is. |
| `npm run db:seed:demo` | Adds the sample studio records, each marked `demo`. |
| `npm run db:reset` | **Development only** (refused unless `NODE_ENV=development` and the database is `*_dev`): migrates down to nothing, up again, re-seeds. Stored files are kept. |
| `npm run owner:create` | Creates the owner (once; a second is refused). Reads `OWNER_NAME`, `OWNER_EMAIL`, `OWNER_PASSWORD` or asks. |
| `npm run dev:api` | The API with reload on change. |
| `npm run build:api` | Bundles `server/dist/main.js` and `server/dist/cli.js`. The built CLI migrates, rolls back and creates the owner. Seeding runs from source, because it imports `src/data`. |
| `npm test` | Contracts and server tests (Vitest, real PostgreSQL). |
| `npm run test:e2e` | Browser tests (Playwright, installed Chrome). |
| `npm run typecheck` / `lint` / `build` | Site, server and contracts. |

## Configuration

`server/.env` is read first, then the root `.env`. A variable already set in the
environment wins. Every variable is validated at start-up, and a missing or
malformed one stops the server with its name (never its value).

| Variable | Default | Meaning |
|---|---|---|
| `NODE_ENV` | `development` | `development`, `test` or `production`. |
| `HOST`, `PORT` | `127.0.0.1`, `3001` | Where the API listens. |
| `DATABASE_URL` | — | The runtime role (`younes_app`): reads and writes data, can't change the schema. |
| `MIGRATION_DATABASE_URL` | — | The schema owner (`younes_migrator`), used by migrations only. |
| `TEST_DATABASE_URL`, `TEST_MIGRATION_DATABASE_URL` | — | The same for `younes_test`. Tests refuse any database not named `*_test`. |
| `PUBLIC_ORIGIN` | `http://localhost:5201` | Where the site is visited from. State-changing requests must come from it. Also used in email links. |
| `EXTRA_ORIGINS` | — | Further allowed origins, comma-separated (a tunnel host, `www.`). |
| `TRUST_PROXY` | `false` | Set `true` only behind a reverse proxy that is the API's sole entry point. |
| `RATE_LIMITS` | `true` | Per-address limits on sign-in, the consultation form, uploads and the assistant. Can only be turned off in tests. |
| `STORAGE_DIR` | `storage/` | Uploaded and imported images: `public/` (portfolio, served at `/media/public/…`) and `private/` (references, studio-only). |
| `SERVE_SITE`, `SITE_DIST_DIR` | on in production, `dist/` | Serve the built site with the published content injected. |
| `TOTP_ENC_KEY` | — | 32 random bytes, base64. Encrypts authenticator secrets at rest. **Back it up with the database.** |
| `TWO_FACTOR` | `true` | The authenticator step at sign-in. `false`: the password alone signs in, for a year per browser (production.env.example sets `false` for now). Restart after changing it. |
| `OWNER_SETUP_TOKEN` | — | Lets the first owner be created from the browser. If unset, only the CLI can create one. Remove it after setup. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Mailpit | Outgoing email. |
| `WORKER_ENABLED` | on (off in tests) | The email and housekeeping worker. |
| `AI_ENABLED`, `OPENROUTER_API_KEY` | off | The assistant runs only when both are set. |
| `AI_MODEL_DEFAULT`, `AI_MODEL_SUMMARY`, `AI_TIMEOUT_MS`, `OPENROUTER_BASE_URL` | see `config.ts` | Assistant tuning. |
| `LOG_LEVEL` | `info` | Pino level. Logs never include passwords, tokens, cookies or message bodies. |

Studio settings that the owner changes in `/studio/settings` live in the
database (`studio_settings`), not in the environment. These are the studio
name, time zone, the address for new-inquiry notices, the retention period
(24 months by default) and the assistant's daily and monthly spending limits.

## Tests

```bash
npm run db:up
npm test           # 9 contract tests + the server's integration tests
npm run test:e2e   # 9 browser tests
```

- **Server tests** (Vitest, `server/test/`) run the real app (`buildApp`) on
  the real `younes_test` database. They migrate it once, then empty it before
  each file. Nothing stands in for PostgreSQL. They cover:
  - sign-in, two-factor, lockout, sessions and every studio route refusing
    anyone signed out;
  - consultations (validation, honeypot, idempotency, contact details);
  - the inquiry workflow;
  - content drafts, publishing and rollback;
  - calendar overlaps, including concurrent bookings;
  - media checks and variants;
  - the email outbox (including a real send to Mailpit);
  - the assistant, with its HTTP client mocked so no request leaves the
    machine.
- **Browser tests** (Playwright, `tests/e2e/`) start their own API on port
  3101 against `younes_test` (emptied and seeded by `server/test/e2e-server.ts`)
  and their own Vite on 5301. A running dev setup on 3001/5201 is left alone.
  They cover:
  - first-run setup with two-factor and recovery codes;
  - a consultation sent from the site arriving in the studio with its contact
    details;
  - status and notes persisting;
  - a client follow-up;
  - a content draft staying private, then being published and rolled back;
  - an overlapping booking being refused;
  - an upload starting private and then being published;
  - settings;
  - sign-out;
  - every studio page loading without a script error.

  The two test suites share `younes_test`, so don't run them at the same time.

## How it works

**Consultations.** `POST /api/public/consultations` takes the reviewed draft
(contract: `consultationSubmissionSchema`):

- name and email are required;
- phone and Instagram are optional;
- consent is required, recorded with the privacy notice version;
- a hidden honeypot field and a minimum fill time catch bots;
- an idempotency key from the browser means a retried send never creates a
  second inquiry.

The client record (matched by email), the inquiry, its references and the
activity entry are written in one transaction. The browser shows "received"
only after the server answers `201` with the reference (`YT-XXXXXXXX`), which
happens after the database commit. The studio's notice and the visitor's receipt
are queued in the same transaction, never sent inline.

**Studio data.** `GET /api/studio/overview` returns what the dashboard pages
draw (inquiries, upcoming appointments, open follow-ups, recent activity). Each
page then reads and writes its own records through `/api/studio/*`. Every
change is recorded in `activity_log`, which is append-only: the app role can't
update or delete it, and a trigger refuses it too. The log stores ids and field
names, never contact details or free text.

**Website content.** The home page's words and which sections show are one
document (`siteContentSchema`):

- The draft is saved on the server and seen only in the studio (and in its
  preview, `/?sitePreview`).
- Publishing writes a new, numbered, immutable version.
- Rollback publishes an old version again as a new one, so history is never
  rewritten.
- The published bundle (content plus the published works, posts, calls and
  testimonials) is written into the page as
  `<script id="younes-content" type="application/json">`. The API does this
  in production; in development the Vite plugin in `vite.config.ts` does it.
- If the API is unreachable, the site falls back to its bundled content.

**Media.**

- An upload's type is read from its bytes, not its name or header.
- It's decoded and re-encoded with Sharp, which drops all metadata: location,
  camera details, and so on.
- It's resized into WebP variants and stored under a random name. Its
  content hash is recorded, so the same file isn't stored twice.
- `/media/public/…` serves only the files of a **published** piece (cached for
  a day). An upload that isn't a piece yet, or an unpublished piece, answers
  404 to everyone, even at its exact address. Unpublishing takes effect at
  once on the server (browsers may keep a copy for up to a day).
- The studio shows every piece, published or not, through
  `/api/studio/media/:id`, which needs the signed-in owner and sends
  `no-store`. Private images (a client's references) are served only there.
- A new portfolio piece starts private and appears on the site once published.

**Calendar.** An exclusion constraint (`appointments_no_overlap`, `tstzrange &&`
over proposed and confirmed appointments) means the database itself refuses
overlaps, even with two requests at the same moment. The API answers `409`.

**Email.** Three kinds exist: a notice to the studio about a new inquiry (when an address is set in Settings), the receipt a visitor gets for their own consultation (its reference, and that nothing is booked), and password resets. Messages go into `email_outbox` and the worker sends them. Rows are
claimed with `FOR UPDATE SKIP LOCKED`, so they're never sent twice. Retries use
backoff (1, 4, 16, 64 minutes), up to 5 attempts. A failed message shows in
Settings → Email with its error and a Retry button. Apart from that receipt,
nothing is emailed to a client automatically: replies are written by Younes in his own email.

**Assistant (optional).** In an inquiry, Summarise or Draft a reply:

- sends OpenRouter the brief only: the answers and where the inquiry started,
  never the name or contact details;
- has a timeout and one retry;
- has its cost tracked and is held to the daily and monthly limits.

The result is a *proposal*. Approving it keeps it as a private note, rejecting
it discards it, and nothing is sent or changed otherwise.

**Retention.** Hourly, a client whose inquiries are all closed (declined or
completed) and older than the retention period is anonymised in place. Contact
details and the free text of their ideas are cleared, and the counts remain.

## Security model

- **One owner.** The `users_single_owner` index means a second owner can't
  exist. Roles and permissions are in `lib/http.ts` (`PERMISSIONS`), ready for
  staff later.
- **Passwords.** Argon2id; 12–128 characters. Reset links are single-use,
  valid for 30 minutes, and stored hashed. A change or reset signs out every
  other session.
- **Lockout without self-lockout.** Failed sign-ins are counted per address
  and per account. Each counter allows 5 failures in 15 minutes, then locks
  for 1, 2, 4… minutes, up to an hour. Anyone who knows the owner's email
  could trip the per-account lock, so a browser that has completed a full
  sign-in (password and second step) becomes a *trusted device*:
  - It gets its own cookie, `__Host-younes-device`: random, stored hashed,
    HttpOnly, Secure, SameSite=Strict, valid 180 days.
  - At sign-in it's judged by its own failure counter instead of the
    account's, so a stranger's guesses can't lock the owner out of their own
    browser, while unknown browsers stay locked.
  - It still has to pass the password and two-factor steps.
  - A password reset forgets every trusted device.
  - Real and unknown emails are counted and answered identically, so nothing
    reveals whether an account exists.
  - The per-address and per-route limits (10 a minute) still apply to
    everyone.
- **Sessions.**
  - The token is random (32 bytes) and only its SHA-256 is stored.
  - The cookie is `__Host-younes-session`: HttpOnly, Secure, SameSite=Lax,
    path `/`.
  - Sessions expire after 12 hours idle or 30 days at most. The token is
    rotated when the second step completes.
  - Signed-in devices can be listed and signed out in Settings.
- **Two-factor.**
  - **Currently switchable, and off in production for now** (`TWO_FACTOR=false`):
    the password alone signs in, and the session lasts a year (idle and
    absolute), so the artist signs in once per browser. The lockout, rate
    limits and trusted devices still apply. All the two-factor code stays in
    place. Set `TWO_FACTOR=true` and restart to bring it back: sessions made
    while it was off were never marked as having passed the second step, so
    each one is sent to it (or to setting it up) on its next request.
  - With it on, TOTP is required before any studio data is reachable (`403` until then).
    The secret is encrypted with AES-256-GCM (`TOTP_ENC_KEY`).
  - A code can't be used twice.
  - There are ten single-use recovery codes, stored hashed.
- **Cross-site requests.** Unsafe methods need an allowed `Origin` (or
  `Referer`). The studio's API also requires `X-Requested-With: younes-studio`.
- **Default deny.** One hook guards the whole `/api/studio` tree. A test walks
  every registered studio route and checks it refuses anyone not fully signed
  in.
- **Headers.** helmet sets a strict CSP, HSTS (in production), the frame and
  referrer policies, and no `x-powered-by`.
- **Secrets.** These are never sent to the browser: database URLs, SMTP
  details, the OpenRouter key and `TOTP_ENC_KEY` exist only in the server's
  environment. PostgreSQL is never published beyond `127.0.0.1` locally, and
  has no port at all in the production example.

## Backup and restore

What must be backed up together:

1. **The database.**
2. **`STORAGE_DIR`** (the images).
3. **`TOTP_ENC_KEY`.** Without it, two-factor must be set up again. Everything
   else still works.

Local example (adapt the container and paths in production):

```bash
# back up
docker compose -f docker/compose.yaml exec -T postgres pg_dump -U postgres -Fc younes_dev > backup-$(date +%F).dump
tar -czf storage-$(date +%F).tar.gz storage/

# check a backup can be read (lists its contents without restoring)
docker compose -f docker/compose.yaml exec -T postgres pg_restore -l < backup-YYYY-MM-DD.dump | head

# restore into an EMPTY database (never over the live one): create it, restore, check, then switch
docker compose -f docker/compose.yaml exec -T postgres createdb -U postgres -O younes_migrator younes_restore
docker compose -f docker/compose.yaml exec -T postgres pg_restore -U postgres -d younes_restore --no-owner --role=younes_migrator < backup-YYYY-MM-DD.dump
tar -xzf storage-YYYY-MM-DD.tar.gz   # into a fresh folder, then point STORAGE_DIR at it
```

After restoring, run `migrate`; it applies anything newer than the backup.
Check the new database before pointing `DATABASE_URL` at it. The dump carries
the app role's table grants, so `younes_app` can use the restored copy as it
is. To lock the new database down like the original, revoke `CONNECT` from
`PUBLIC` and grant it to the two roles, as `docker/postgres/init/` does. Keep at
least one recent copy off the server, and test a restore occasionally: a backup
that has never been restored isn't known to work.

**Rehearsed (2026-10-24, locally).** This procedure was run against a separate
database, `younes_restore_drill`, created for the drill and dropped afterwards.
The development database was only read, by `pg_dump`. Results:

- All 29 tables came back with identical row counts.
- The overlap constraint and the history's append-only trigger were present.
- The owner's authenticator secret decrypted with `TOTP_ENC_KEY`, and not with
  any other key.
- The built server, pointed at the restored database and the restored storage
  folder, served the published content and all 15 images.
- `migrate` was a clean no-op.

## Recovery

| Situation | What to do |
|---|---|
| Phone lost, recovery codes at hand | Sign in with a recovery code (the code screen accepts one), then set up two-factor again from a new phone. |
| Phone and recovery codes lost | On the server: `psql` as the migrator and `update users set totp_secret_enc = null, totp_enabled_at = null, totp_last_step = null where role = 'owner';` (column names: `db/types.ts`). The next sign-in asks to set up two-factor again. Record why you did it. |
| Password forgotten | "Forgot password" on the sign-in screen sends a reset link (locally it lands in Mailpit; in production it needs working SMTP). There is no command-line password reset: never edit a hash by hand. |
| A failed email | Settings → Email shows the error. Fix the SMTP settings, then Retry. |
| The site shows the bundled content, not the published | The API isn't reachable from where the page is built (`/api/public/content`). Check `/api/health`. |
| `409 slot_taken` | Another proposed or confirmed appointment overlaps. Move or cancel one. |
| A bad migration | `npm run db:rollback` undoes the latest. In production, restore the pre-deploy backup instead of improvising. |

## Production

Everything runs in Docker on one Linux server: PostgreSQL (private network, no
published port), the app (the API plus the built site), and optionally Caddy
for HTTPS. `docker/production/deploy.sh` does each step; it was run end to end
locally (2026-10-30): install, content import, update and backup.

What's there:

- `server/Dockerfile`: multi-stage.
  - The `runtime` image has production dependencies, `server/dist` and the
    built site, runs as the unprivileged `node` user, and has a health check.
  - The `tools` stage is the full checkout, for `npm run db:seed`.
- `docker/production/compose.example.yaml`: `postgres`, `app` (on
  `127.0.0.1:APP_PORT` only), `tools` (one-off jobs) and `caddy` (only with
  `USE_CADDY=true`).
- `docker/production/production.env.example`: every setting.
- `docker/production/nginx.example.conf`: for a server whose nginx (or Caddy)
  already serves another site.
- `docker/production/deploy.sh`: the steps below.

**First install.** On the server, with Docker installed, a firewall allowing
only SSH, 80 and 443 (`sudo ufw allow OpenSSH && sudo ufw allow 80 && sudo ufw
allow 443 && sudo ufw enable`), and the domain's A record pointing at it:

```bash
git clone -b <branch> git@github.com:wahabtlais/youness_tattoo.git ~/younes
cd ~/younes/docker/production
./deploy.sh init your.domain     # production.env, with every secret generated
nano production.env              # the SMTP_* lines; USE_CADDY (see below)
./deploy.sh install              # build, start, migrate, import the content
./deploy.sh owner                # the studio owner (asks for email and password)
```

Then the web server:

- **Another site already uses 80/443** (`USE_CADDY=false`, the default): add
  `nginx.example.conf` with your domain to that nginx, reload it, and run
  `sudo certbot --nginx -d your.domain` for HTTPS. The other site isn't
  touched. Sign-in needs HTTPS (its cookies are `Secure`).
- **Nothing else on 80/443**: set `USE_CADDY=true` before `install`; Caddy
  gets and renews the certificate itself.

Then sign in at `https://your.domain/studio` and set up two-factor.

**Updating:** `git pull`, then `./deploy.sh update`. It backs up first, then
rebuilds, migrates and restarts.

**Backups:** `./deploy.sh backup` writes the database dump, the images and
`production.env` (it holds `TOTP_ENC_KEY`) into `docker/production/backups/`.
Run it nightly from cron and copy the folder off the server. Restore as in
[Backup and restore](#backup-and-restore), using this stack's containers.

Before telling people about the site:

- Set up a transactional email provider's SMTP. Until then the site works but
  nothing is sent.
- Have the privacy notice reviewed (`docs/PRIVACY_NOTICE_DRAFT.md`).
- Replace or unpublish the demo content (`docs/ROADMAP.md`, Before
  publishing). The import includes the three demo testimonials.
- Remove `OWNER_SETUP_TOKEN` if you set one.
- Do a restore drill.

Note: the app container is given both database URLs, because migrations run
from the same image. If you'd rather keep the migrator password off the running
app, run migrations from a separate one-off container and give the app only
`DATABASE_URL`. That needs `MIGRATION_DATABASE_URL` made optional for the
server process (`config.ts`).
