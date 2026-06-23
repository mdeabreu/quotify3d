# To use this Dockerfile, you have to set `output: 'standalone'` in your next.config.js file.
# From https://github.com/vercel/next.js/blob/canary/examples/with-docker/Dockerfile

FROM --platform=$TARGETPLATFORM node:22.18.0-trixie-slim AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* pnpm-workspace.yaml* ./
RUN \
  if [ -f yarn.lock ]; then yarn --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm ci; \
  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm i --frozen-lockfile; \
  else echo "Lockfile not found." && exit 1; \
  fi


# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
ARG NEXT_PUBLIC_SERVER_URL
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_SERVER_URL=${NEXT_PUBLIC_SERVER_URL}
ENV NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=${NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY}
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN mkdir -p data

# Next.js collects completely anonymous telemetry data about general usage.
# Learn more here: https://nextjs.org/telemetry
# Uncomment the following line in case you want to disable telemetry during the build.
# ENV NEXT_TELEMETRY_DISABLED 1

RUN \
  if [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm --filter @payloadcms/plugin-ecommerce build; \
  fi

# The production SQLite database is included in the build context only. It is never copied
# into the runner image; this temporary builder-stage copy is deleted after prerendering.
RUN \
  set -eu; \
  trap 'rm -f data/ecommerce.db data/ecommerce.db-shm data/ecommerce.db-wal' EXIT; \
  if [ -f yarn.lock ]; then PAYLOAD_SECRET=build-time-payload-secret DATABASE_URL=file:./data/ecommerce.db PAYLOAD_MIGRATE_DURING_BUILD=true yarn run build; \
  elif [ -f package-lock.json ]; then PAYLOAD_SECRET=build-time-payload-secret DATABASE_URL=file:./data/ecommerce.db PAYLOAD_MIGRATE_DURING_BUILD=true npm run build; \
  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && CI=true PAYLOAD_SECRET=build-time-payload-secret DATABASE_URL=file:./data/ecommerce.db PAYLOAD_MIGRATE_DURING_BUILD=true pnpm run build; \
  else echo "Lockfile not found." && exit 1; \
  fi

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ARG ORCASLICER_VERSION=v2.3.2
ARG ORCASLICER_SHA256=c64336ceec37d941766e675cbaaaf5124e184402bf18177fbf81ba5102734ad8
ARG TARGETARCH

ENV NODE_ENV=production
ENV DATABASE_URL=file:./data/ecommerce.db
ENV SLICER_BINARY_PATH=/opt/orcaslicer/AppRun
# Uncomment the following line in case you want to disable telemetry during runtime.
# ENV NEXT_TELEMETRY_DISABLED 1

RUN groupadd --system --gid 1001 nodejs
RUN useradd --system --uid 1001 --gid nodejs --home-dir /app --shell /usr/sbin/nologin nextjs
RUN if [ "${TARGETARCH}" != "amd64" ]; then \
    echo "OrcaSlicer AppImage install currently supports linux/amd64 only; got linux/${TARGETARCH}." >&2; \
    exit 1; \
  fi
RUN apt-get update && \
  DEBIAN_FRONTEND=noninteractive apt-get install --no-install-recommends -y \
    ca-certificates \
    curl \
    gosu \
    gstreamer1.0-gl \
    gstreamer1.0-gtk3 \
    gstreamer1.0-libav \
    gstreamer1.0-plugins-bad \
    gstreamer1.0-plugins-base \
    gstreamer1.0-plugins-good \
    gstreamer1.0-plugins-ugly \
    gstreamer1.0-pulseaudio \
    gstreamer1.0-qt5 \
    gstreamer1.0-tools \
    gstreamer1.0-x \
    libgtk-3-0 \
    libglu1-mesa \
    libmspack0 \
    libopengl0 \
    libwebkit2gtk-4.1-0 \
    libwxgtk3.2-1t64 \
    locales \
    squashfs-tools && \
  rm -rf /var/lib/apt/lists/*
RUN ORCASLICER_DOWNLOAD_URL="https://github.com/OrcaSlicer/OrcaSlicer/releases/download/${ORCASLICER_VERSION}/OrcaSlicer_Linux_AppImage_Ubuntu2404_V${ORCASLICER_VERSION#v}.AppImage" && \
  curl -fsSL "${ORCASLICER_DOWNLOAD_URL}" -o /tmp/orca.app && \
  echo "${ORCASLICER_SHA256}  /tmp/orca.app" | sha256sum -c - && \
  ORCASLICER_SQUASHFS_OFFSET="$(grep -aobU 'hsqs' /tmp/orca.app | tail -n1 | cut -d: -f1)" && \
  test -n "${ORCASLICER_SQUASHFS_OFFSET}" && \
  tail -c +"$((ORCASLICER_SQUASHFS_OFFSET + 1))" /tmp/orca.app > /tmp/orca.squashfs && \
  unsquashfs -q -d /opt/orcaslicer /tmp/orca.squashfs && \
  test -x /opt/orcaslicer/AppRun && \
  rm -rf /tmp/orca.app /tmp/orca.squashfs && \
  localedef -i en_US -f UTF-8 en_US.UTF-8

# Remove this line if you do not have this folder
COPY --from=builder /app/public ./public
COPY docker-entrypoint.sh ./docker-entrypoint.sh

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next
RUN mkdir -p data/media data/models data/tmp/slicing
RUN chown -R nextjs:nodejs data docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

VOLUME ["/app/data"]

EXPOSE 3000

ENV PORT=3000

# server.js is created by next build from the standalone output
# https://nextjs.org/docs/pages/api-reference/next-config-js/output
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]

FROM runner AS importer

ENV ORCASLICER_PROFILES_DIR=/opt/orcaslicer/resources/profiles
ENV COREPACK_HOME=/app/.cache/node/corepack

RUN mkdir -p "${COREPACK_HOME}" && \
  corepack enable pnpm && \
  corepack prepare pnpm@11.7.0 --activate && \
  chown nextjs:nodejs /app && \
  chown -R nextjs:nodejs /app/.cache && \
  test -d "${ORCASLICER_PROFILES_DIR}"

COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml /app/tsconfig.json ./
COPY --from=builder --chown=nextjs:nodejs /app/src ./src
COPY --from=builder --chown=nextjs:nodejs /app/emails ./emails
COPY --from=builder --chown=nextjs:nodejs /app/packages ./packages

ENTRYPOINT ["./docker-entrypoint.sh", "node_modules/.bin/payload", "import-configs"]
CMD []
