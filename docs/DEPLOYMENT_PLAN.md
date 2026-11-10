# Deployment plan — `feat/phase-1-hero`

> **Status: prepared, not deployed.** Nothing in this plan has been run against
> production. Every production step waits for the owner's explicit approval.
> Written 2026-11-10 against commit `56d7589` plus the `.dockerignore` fix that
> follows it.

This release brings the hero performance work, the public-site redesign, the
Artist chapter, the Home link, and the **client portal** (accounts, email
verification, requests, appointments, aftercare) with database migrations
**0007** and **0008**.

The production stack is the one in `docker/production/` (`deploy.sh`,
`compose.example.yaml`): PostgreSQL 17 on a private network, the app on
`127.0.0.1:3001`, HTTPS from Caddy or an existing nginx. The runbook is
`server/README.md` → *Production* and *Backup and restore*.

---

## 1. What was verified (locally, never against production)

| Check | Result |
|---|---|
| Lint, typecheck | pass |
| Contract tests | 16 / 16 |
| Server tests (incl. client auth and security boundaries) | 139 / 139 |
| Browser end-to-end tests | 12 / 12 |
| Production build (`npm run build`, incl. hero pre-render) | pass |
| Docker `runtime` image | builds (453 MB) |
| Docker `tools` image | builds (945 MB) |

**Upgrade rehearsal** — a throwaway local stack built from `compose.example.yaml`'s
design, first running an image of **current `main`** (migrations 0001–0006, content
imported, a studio owner), then upgraded exactly as `deploy.sh update` does:

- backup with `pg_dump -Fc` → restored into a scratch database → row counts identical in all 30 tables;
- `migrate` with the new image **while the old app kept serving**: 0007 + 0008 applied in ~2 s, the old app answered 40 / 40 requests during it, and keeps working on the new schema afterwards (both migrations are additive);
- the new app healthy ~3 s after the switch;
- smoke tests on the new app: every public route, `/account/*`, `/portal`, `/studio`, unknown addresses; CSP present with no violations or script errors; HSTS; pages not cached; **studio sign-in** with the owner created under the old version; **client sign-up → verification email (sent by the worker, caught locally) → link → portal**; cookies `__Host-`, `Secure`, `HttpOnly`, `SameSite=Lax`;
- app runs as `node` (not root); storage volume writable;
- rollback (a) — old image on the upgraded database: works;
- rollback (b) — full database restore: works **only into a fresh database** (see §6). `pg_restore --clean` over the upgraded database **fails** (the new tables' foreign keys depend on tables in the dump);
- re-upgrading a restored database: works, new tables granted to the app role automatically.

---

## 2. Production environment variables

Names only. `production.env` on the server; never in Git. **Keep the existing
file** — its secrets protect existing data (database roles, `TOTP_ENC_KEY`).

**In `production.env`** (already present if the stack was installed with `deploy.sh init`):

| Variable | Notes |
|---|---|
| `SITE_DOMAIN` | the bare domain |
| `PUBLIC_ORIGIN` | `https://<domain>` — CSRF origin check **and** the address in every email link |
| `EXTRA_ORIGINS` | optional, comma-separated (e.g. `https://www.<domain>` if www is served rather than redirected) |
| `USE_CADDY`, `APP_PORT` | how the site is reached |
| `POSTGRES_SUPERUSER_PASSWORD`, `YOUNES_MIGRATOR_PASSWORD`, `YOUNES_APP_PASSWORD` | secrets |
| `TOTP_ENC_KEY` | secret; 32 bytes base64; must not change |
| `TWO_FACTOR` | studio sign-in second step (template default `false`; app default `true`) |
| `OWNER_SETUP_TOKEN` | optional; unset once the owner exists |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | **required for this release** (§3) |
| `AI_ENABLED`, `OPENROUTER_API_KEY` | optional; the assistant stays off unless both are set |

**Set by the image / compose — do not set:** `NODE_ENV`, `HOST`, `PORT`,
`SERVE_SITE`, `STORAGE_DIR`, `SITE_DIST_DIR`, `DATABASE_URL`,
`MIGRATION_DATABASE_URL`, `TRUST_PROXY`.

**Must stay unset in production:** `ANONYMOUS_CONSULTATIONS` (new in this
release, default off), `RATE_LIMITS` (the app refuses `false` in production),
`WORKER_ENABLED` (the email worker must run).

No other variable is new in this release.

---

## 3. Email — required before launch

This release changes how consultations arrive. With `ANONYMOUS_CONSULTATIONS`
off (the default), **a consultation can only be sent from a verified client
account**, and verification is by email. Without working SMTP:

- clients can create an account but never verify it, so **no consultation can be sent**;
- client password resets, the studio's notices and the clients' receipts are not sent (they wait in the outbox; Settings → Email shows the failures).

Needed: a transactional email provider's SMTP credentials (`SMTP_*`), a
`MAIL_FROM` address on the studio's domain, and that domain's SPF, DKIM and
DMARC DNS records as the provider specifies (a DNS change — owner's approval).
Before launch, send one verification email to an address you control and
confirm it arrives in the inbox (not spam) with a link to `PUBLIC_ORIGIN`.

---

## 4. Database migrations

| Migration | Contents | Downtime |
|---|---|---|
| `0007_client_portal` | client accounts, sessions, tokens; projects, project media, client messages, aftercare guides/plans/steps, healing photos; nullable `inquiries.account_id/kind/project_id`, `appointments.project_id` | none — additive |
| `0008_portal_refinements` | `client_uploads`, `client_account_requests` | none — additive |

Applied in order by the migration runner; already-applied ones are skipped.
Run as the **migrator** role, from the **new** image, before the app is
switched (this is what `deploy.sh update` does):

```sh
docker compose -f compose.example.yaml --env-file production.env run --rm app node server/dist/cli.js migrate
```

The old app keeps serving throughout. Do **not** use `db:rollback` in
production; restore the pre-deploy backup instead (§6).

---

## 5. Deployment steps (only after approval)

On the server, in the checkout's `docker/production/`:

1. **Decide what is deployed** (§7, decision 1): merge `feat/phase-1-hero` into `main` and pull `main`, or check out the reviewed commit directly.
2. **Email ready** (§3): `SMTP_*` and `MAIL_FROM` in `production.env`; DNS records verified.
3. **Note the running image** so it can be restored: `docker image tag younes-tattoo:latest younes-tattoo:pre-phase1`.
4. **Back up:** `./deploy.sh backup` → `backups/younes-<stamp>.dump`, `storage-<stamp>.tar.gz`, `production-<stamp>.env`. Copy all three off the server.
5. **Prove the backup restores** (into a scratch database, never the live one):
   ```sh
   C="docker compose -f compose.example.yaml --env-file production.env"
   $C exec -T postgres createdb -U postgres -O younes_migrator younes_restore_drill
   $C exec -T postgres pg_restore -U postgres -d younes_restore_drill --single-transaction --exit-on-error < backups/younes-<stamp>.dump
   $C exec -T postgres psql -U postgres -d younes_restore_drill -Atc "select count(*) from kysely_migration"   # expect 6
   $C exec -T postgres dropdb -U postgres younes_restore_drill
   ```
6. **Update the code** (`git pull` / checkout of the chosen commit).
7. **`./deploy.sh update`** — backs up again, builds the new image, migrates (0007, 0008), restarts the app, waits for `/api/health`. The build runs Vite on the server: allow ~2 GB of memory.
8. **Health:** `curl -fsS http://127.0.0.1:${APP_PORT:-3001}/api/health` → `{"status":"ok","database":"ok",...}`; `./deploy.sh status` shows the app `healthy`; `./deploy.sh logs` has no errors.
9. **Smoke tests** (§8).

`deploy.sh update` never re-imports content, so published work, words and
images are kept.

---

## 6. Rollback

**The app misbehaves, the data is fine** (most likely case) — run the previous image on the upgraded database. Rehearsed: the old version runs normally on the 0007/0008 schema; the new tables are simply unused.

```sh
docker image tag younes-tattoo:pre-phase1 younes-tattoo:latest
docker compose -f compose.example.yaml --env-file production.env up -d app
```

Then put the checkout back on the previous commit, so a later `deploy.sh update` doesn't rebuild the new version unintended.

**The data is damaged** (a failed or harmful migration) — restore the pre-deploy dump into a **fresh** database and swap it in. Never `pg_restore --clean` over the live database: it fails part-way on this upgrade.

```sh
C="docker compose -f compose.example.yaml --env-file production.env"
$C stop app
$C exec -T postgres createdb -U postgres -O younes_migrator younes_restored
$C exec -T postgres psql -U postgres -d younes_restored -c "REVOKE ALL ON DATABASE younes_restored FROM PUBLIC" -c "GRANT CONNECT ON DATABASE younes_restored TO younes_migrator, younes_app"
$C exec -T postgres pg_restore -U postgres -d younes_restored --single-transaction --exit-on-error < backups/younes-<stamp>.dump
$C exec -T postgres psql -U postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='younes' AND pid <> pg_backend_pid()" \
  -c "ALTER DATABASE younes RENAME TO younes_failed_<stamp>" -c "ALTER DATABASE younes_restored RENAME TO younes"
docker image tag younes-tattoo:pre-phase1 younes-tattoo:latest
$C up -d app
```

The failed database is kept for diagnosis; drop it only once everything is
confirmed. Anything written between the backup and the restore (new client
accounts, consultations) is lost — tell affected clients. Stored files the new
version added are left in storage, harmless; restore `storage-<stamp>.tar.gz`
only if files were damaged.

---

## 7. Decisions needed from the owner

1. **What to deploy** — merge to `main` (via a pull request) and deploy `main`, or deploy the feature branch's commit.
2. **Email provider** and the DNS records for it (§3). This is a launch blocker.
3. **Consultations without an account** — this release requires one (and therefore email). Confirm that is wanted for launch.
4. **Privacy notice** — the consent text clients agree to is `docs/PRIVACY_NOTICE_DRAFT.md`, marked draft and not legally reviewed; it now covers accounts and stored reference images. Review before real clients sign up.
5. **Studio two-factor** — `TWO_FACTOR` is `false` in the production template (a year-long session from the password alone). Recommended: `true`.
6. **When** — a quiet hour; the switch itself is a few seconds of restart.
7. Minor: `public/artist.png` (an original studio photograph, on `main` since before this release) is shipped as a public file but no longer used by the site.

---

## 8. Smoke tests after deployment

On `https://<domain>`:

- `/`, `/work`, `/journal`, `/canvas-calls` load; the hero shows immediately; the browser console has no CSP errors.
- The header shows Home · Work · Journal · Canvas calls · Account · Start a consultation; on a phone, Menu opens with Home first.
- `/studio`: sign in as the owner; the overview, Projects, Aftercare, Clients and Settings → Email pages load.
- `/account?mode=register`: create an account with an address you control → the email arrives → its link opens `https://<domain>/account/verify?...` → you land in the portal.
- From the portal, start a consultation with a reference image → it appears in the studio's inquiries with the image.
- Settings → Email shows no failed sends.
- Response headers on `/`: `Strict-Transport-Security`, `Content-Security-Policy`, `Cache-Control: no-cache`.

Afterwards, remove the test account the way a client would: Profile → request deletion in the portal, then handle the request on that client's portal card in the studio (deletion is reviewed by the studio, never automatic).
