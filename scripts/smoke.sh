#!/usr/bin/env bash
# Hits the pages a deploy must serve. Usage: scripts/smoke.sh http://localhost:8085
set -u
base="${1:-http://localhost:8085}"
fail=0

expect() { # expect <status> <path>
  local want="$1" path="$2" got
  got=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$base$path")
  if [ "$got" = "$want" ]; then
    printf '  ok   %s %s\n' "$got" "$path"
  else
    printf '  FAIL %s (want %s) %s\n' "$got" "$want" "$path"
    fail=1
  fi
}

for _ in $(seq 1 30); do
  curl -s -o /dev/null --max-time 2 "$base/" && break
  sleep 1
done

expect 200 /
expect 200 /story/
expect 200 /wall/
expect 200 /class/
expect 200 /colophon/
expect 200 /css/style.css
expect 200 /api/notes
expect 200 /api/activity
expect 404 /this-page-does-not-exist

body=$(curl -s --max-time 10 "$base/")
case "$body" in
  *"Ian Cheung - Portfolio"*) printf '  ok   home title\n' ;;
  *) printf '  FAIL home title missing\n'; fail=1 ;;
esac

exit $fail
