#!/usr/bin/env bash
# The Younes Tattoo production stack, by hand. Run from this folder, on the
# server, as a user who can run docker (or with sudo):
#
#   ./deploy.sh init your.domain   write production.env with fresh secrets (once)
#   ./deploy.sh install            first time: build, start, migrate, import the content
#   ./deploy.sh owner              create the studio owner (asks for a password)
#   ./deploy.sh update             after `git pull`: back up, rebuild, migrate, restart
#   ./deploy.sh backup             database + images + settings into ./backups
#   ./deploy.sh demo-add           sample dashboard records (flagged demo; backs up first)
#   ./deploy.sh demo-remove        take the sample records out again (backs up first)
#   ./deploy.sh status | logs      what's running / the app's log
#
# Secrets are generated here and written only to production.env; nothing is
# printed. See server/README.md (Production).
set -euo pipefail
cd "$(dirname "$0")"

ENV_FILE=production.env
COMPOSE=(docker compose -f compose.example.yaml --env-file "$ENV_FILE")

die() { echo "deploy: $*" >&2; exit 1; }
# a value from production.env, without sourcing it (MAIL_FROM has <> in it)
setting() { grep -E "^$1=" "$ENV_FILE" | tail -1 | cut -d= -f2- || true; }
need_env() { [[ -f $ENV_FILE ]] || die "no $ENV_FILE yet - run: ./deploy.sh init your.domain"; }
profiles() { [[ $(setting USE_CADDY) == true ]] && echo --profile caddy || true; }
up() { "${COMPOSE[@]}" $(profiles) up -d "$@"; }

wait_healthy() {
  local port; port=$(setting APP_PORT); port=${port:-3001}
  for _ in $(seq 1 60); do
    if curl -fsS "http://127.0.0.1:$port/api/health" >/dev/null 2>&1; then echo "The app answers on 127.0.0.1:$port."; return; fi
    sleep 2
  done
  die "the app didn't come up - see: ./deploy.sh logs"
}

backup() {
  need_env
  local stamp dir; stamp=$(date +%F-%H%M); dir=backups; mkdir -p "$dir"; chmod 700 "$dir"
  "${COMPOSE[@]}" exec -T postgres pg_dump -U postgres -Fc younes > "$dir/younes-$stamp.dump"
  docker run --rm -v younes-tattoo-prod_storage:/s:ro -v "$PWD/$dir":/b alpine tar -czf "/b/storage-$stamp.tar.gz" -C /s .
  # TOTP_ENC_KEY lives here: without it, two-factor must be set up again
  cp "$ENV_FILE" "$dir/production-$stamp.env"; chmod 600 "$dir"/*
  echo "Backed up to $dir/*-$stamp.* - copy them off this server."
}

case "${1:-}" in
  init)
    domain=${2:-}; [[ -n $domain ]] || die "usage: ./deploy.sh init your.domain"
    [[ -f $ENV_FILE ]] && die "$ENV_FILE already exists - edit it instead (its secrets protect existing data)"
    command -v openssl >/dev/null || die "openssl is needed to generate the secrets"
    umask 077
    sed -e "s|^SITE_DOMAIN=.*|SITE_DOMAIN=$domain|" \
        -e "s|^PUBLIC_ORIGIN=.*|PUBLIC_ORIGIN=https://$domain|" \
        -e "s|^POSTGRES_SUPERUSER_PASSWORD=.*|POSTGRES_SUPERUSER_PASSWORD=$(openssl rand -hex 24)|" \
        -e "s|^YOUNES_MIGRATOR_PASSWORD=.*|YOUNES_MIGRATOR_PASSWORD=$(openssl rand -hex 24)|" \
        -e "s|^YOUNES_APP_PASSWORD=.*|YOUNES_APP_PASSWORD=$(openssl rand -hex 24)|" \
        -e "s|^TOTP_ENC_KEY=.*|TOTP_ENC_KEY=$(openssl rand -base64 32)|" \
        -e "s|^MAIL_FROM=.*|MAIL_FROM=Younes Tattoo <studio@$domain>|" \
        production.env.example > "$ENV_FILE"
    echo "Wrote $ENV_FILE for $domain (secrets generated). Next: fill the SMTP_* lines, check USE_CADDY, then ./deploy.sh install"
    ;;
  install)
    need_env
    "${COMPOSE[@]}" --profile tools build
    up
    "${COMPOSE[@]}" run --rm app node server/dist/cli.js migrate
    # the site's portfolio, words and images; then a restart, so the app drops
    # the empty content it cached before the import
    "${COMPOSE[@]}" --profile tools run --rm tools npm run db:seed
    "${COMPOSE[@]}" restart app
    wait_healthy
    echo "Installed. Next: ./deploy.sh owner, then point the domain's web server at it (nginx.example.conf) if USE_CADDY=false."
    ;;
  owner)
    need_env
    "${COMPOSE[@]}" exec app node server/dist/cli.js owner:create
    ;;
  update)
    need_env
    backup
    "${COMPOSE[@]}" build app
    "${COMPOSE[@]}" run --rm app node server/dist/cli.js migrate
    up
    wait_healthy
    ;;
  demo-add | demo-remove)
    need_env
    backup
    # the tools image is the source checkout: rebuilt so it matches this checkout
    "${COMPOSE[@]}" --profile tools build tools
    "${COMPOSE[@]}" --profile tools run --rm tools npm run "${1/-/:}" -- --production
    ;;
  backup) backup ;;
  status) need_env; "${COMPOSE[@]}" $(profiles) ps ;;
  logs) need_env; "${COMPOSE[@]}" logs --tail 100 -f app ;;
  *) sed -n '2,14p' "$0"; exit 1 ;;
esac
