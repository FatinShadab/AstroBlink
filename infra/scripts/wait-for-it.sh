#!/usr/bin/env bash
# wait-for-it.sh — Wait for a TCP host:port to become available.
# Usage: ./wait-for-it.sh host:port [-t timeout] [-- command]
#
# Included as a convenience for custom entrypoint scripts.
# In this project, Docker Compose healthchecks + depends_on handle
# service ordering, so this script is rarely needed directly.

set -e

TIMEOUT=30
HOST=""
PORT=""
CMD=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    *:* )
      HOST="${1%%:*}"
      PORT="${1##*:}"
      shift
      ;;
    -t)
      TIMEOUT="$2"
      shift 2
      ;;
    --)
      shift
      CMD="$@"
      break
      ;;
    *)
      echo "Unknown argument: $1"
      exit 1
      ;;
  esac
done

if [[ -z "$HOST" || -z "$PORT" ]]; then
  echo "Usage: $0 host:port [-t timeout] [-- command]"
  exit 1
fi

echo "Waiting for $HOST:$PORT (timeout: ${TIMEOUT}s)..."

START=$(date +%s)
while ! (echo > /dev/tcp/$HOST/$PORT) 2>/dev/null; do
  NOW=$(date +%s)
  ELAPSED=$((NOW - START))
  if [[ $ELAPSED -ge $TIMEOUT ]]; then
    echo "Timeout waiting for $HOST:$PORT after ${TIMEOUT}s"
    exit 1
  fi
  sleep 1
done

echo "$HOST:$PORT is available."

if [[ -n "$CMD" ]]; then
  exec $CMD
fi
