# Wishwell as a single container: the Next server, and a SQLite database on a
# mounted volume at /data. Nothing else — no managed database, no object store.
#
#   docker build -t wishwell .
#   docker run -p 3000:3000 -v wishwell-data:/data wishwell

FROM node:22-bookworm-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1

# ---------------------------------------------------------------- dependencies
FROM base AS deps
WORKDIR /app
# better-sqlite3 falls back to compiling from source when no prebuilt binary
# matches this platform, so the toolchain has to be here.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

# --------------------------------------------------------------------- build
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# The demo world, built once at image build time and carried along as a template.
# scripts/start.mjs copies it onto a volume that has no database yet; it is never
# written to at runtime, so the demo can always be restored from it.
RUN WISHWELL_DATA_DIR=/app/seed npx tsx scripts/seed.ts \
  && node -e "const D=require('better-sqlite3');const d=new D('/app/seed/wishwell.db');d.pragma('wal_checkpoint(TRUNCATE)');d.close()" \
  && rm -f /app/seed/wishwell.db-wal /app/seed/wishwell.db-shm

# --------------------------------------------------------------------- runtime
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    WISHWELL_DATA_DIR=/data \
    WISHWELL_UPLOAD_DIR=/data/uploads \
    WISHWELL_SEED_DB=/app/seed/wishwell.db

RUN groupadd --system --gid 1001 wishwell \
  && useradd --system --uid 1001 --gid wishwell wishwell

COPY --from=builder /app/public ./public
# The traced server bundle unpacks to /app, so server.js and the modules it kept
# land next to each other and scripts/ can resolve better-sqlite3 from /app.
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/seed ./seed
COPY --from=builder /app/scripts/start.mjs /app/scripts/reset-demo.mjs ./scripts/

RUN mkdir -p /data /data/uploads && chown -R wishwell:wishwell /data /app/seed

USER wishwell
EXPOSE 3000
CMD ["node", "scripts/start.mjs"]
