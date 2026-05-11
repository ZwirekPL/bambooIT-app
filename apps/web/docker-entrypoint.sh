#!/bin/sh
set -e

BLOG_IMG_DIR="/app/apps/web/public/blog/images"
SEED_DIR="/app/seed-blog-images"

if [ -d "$SEED_DIR" ] && [ -z "$(ls -A "$BLOG_IMG_DIR" 2>/dev/null)" ]; then
  echo "Seeding blog images from build..."
  cp -a "$SEED_DIR"/. "$BLOG_IMG_DIR"/
fi

exec "$@"
