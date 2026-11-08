#!/usr/bin/env bash
# Runs on the VPS (called by the GitHub deploy job, or by hand):
# pull main, rebuild the container, smoke test, roll back if it does not come up.
set -euo pipefail
cd "$(dirname "$0")/.."

image=iancheung-dev-site
if docker image inspect "$image" >/dev/null 2>&1; then
  docker tag "$image" "$image:previous"
fi

git fetch -q origin main
git merge --ff-only origin/main || {
  echo "cannot fast-forward: commit or stash the local changes on the VPS (story pages?) first"
  exit 1
}

docker compose up -d --build

if scripts/smoke.sh http://localhost:8085; then
  echo "deployed $(git rev-parse --short HEAD)"
  docker image prune -f >/dev/null
  exit 0
fi

echo "smoke test failed, rolling back"
docker compose logs --tail=50 site || true
if docker image inspect "$image:previous" >/dev/null 2>&1; then
  docker tag "$image:previous" "$image"
  docker compose up -d --no-build
fi
exit 1
