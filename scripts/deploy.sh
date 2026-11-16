#!/bin/bash
# Production deploys run on contabo-gigacoder.
# That server runs Showrunner with systemd from /opt/showrunner/app.
# This entry point keeps the old command and delegates to the bare-metal script.
export SSH_HOST="${SSH_HOST:-contabo-gigacoder}"
export REMOTE_DIR="${REMOTE_DIR:-/opt/showrunner/app}"
exec "$(cd "$(dirname "$0")" && pwd)/deploy-bare.sh" "$@"
