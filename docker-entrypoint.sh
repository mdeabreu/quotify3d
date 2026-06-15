#!/bin/sh
set -e

mkdir -p /app/data/media /app/data/models /app/data/tmp/slicing
chown -R nextjs:nodejs /app/data

export HOSTNAME="${HOSTNAME:-0.0.0.0}"

exec su-exec nextjs:nodejs "$@"
