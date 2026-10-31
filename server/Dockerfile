# The Younes Tattoo server: the API, its email worker, and the built public
# site (served with the published content written into the page) - one
# process. Build from the repository root:
#
#   docker build -f server/Dockerfile -t younes-tattoo .
#
# See docker/production/ (deploy.sh) for the stack around it
# (PostgreSQL on a private network, a reverse proxy for HTTPS) and
# server/README.md for the runbook.

# ---- build: install everything, build the site and the API ----
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/contracts/package.json packages/contracts/
COPY server/package.json server/
RUN npm ci
COPY . .
RUN npm run build && npm run build:api

# ---- tools: the full checkout, for the one-off jobs that run from source ----
# (importing the site's content: docker run --rm ... younes-tattoo-tools npm run db:seed)
FROM build AS tools
ENV NODE_ENV=production

# ---- runtime: production dependencies, the built files, nothing else ----
FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3001 \
    SERVE_SITE=true \
    STORAGE_DIR=/data/storage \
    SITE_DIST_DIR=/app/dist
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/contracts/package.json packages/contracts/
COPY server/package.json server/
RUN npm ci --omit=dev --workspace server --include-workspace-root=false && npm cache clean --force
# the shared contracts are TypeScript source, run by Node's own type stripping
COPY packages/contracts/src packages/contracts/src
COPY --from=build /app/server/dist server/dist
COPY --from=build /app/dist dist
RUN mkdir -p /data/storage && chown -R node:node /data
USER node
VOLUME ["/data/storage"]
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "server/dist/main.js"]
