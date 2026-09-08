# ScanForge API Server — auto-start setup
#
# This script installs the ScanForge FastAPI server as an auto-start service.
#
# Two backends are supported:
#   1. systemd (proot Ubuntu / desktop Linux) — primary
#   2. termux-services (Termux, no proot)   — fallback
#
# Usage:
#   bash scripts/server-autostart.sh install        # install + enable + start
#   bash scripts/server-autostart.sh status         # show service status
#   bash scripts/server-autostart.sh logs           # follow service logs
#   bash scripts/server-autostart.sh uninstall      # stop + disable + remove
#
# Environment (optional):
#   SF_HOST      — bind address   (default 0.0.0.0)
#   SF_PORT      — port           (default 8765)
#   SF_PYTHON    — python binary  (default: tries venv, then python3)

set -euo pipefail

SERVICE_NAME="scanforge-server"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="${SCRIPT_DIR}/../server"
VENV_DIR="${SERVER_DIR}/.venv"
PYTHON_BIN="${SF_PYTHON:-}"
HOST="${SF_HOST:-0.0.0.0}"
PORT="${SF_PORT:-8765}"

log()  { printf '\033[1;36m[sf-server]\033[0m %s\n' "$*"; }
err()  { printf '\033[1;31m[sf-server]\033[0m %s\n' "$*" >&2; }

resolve_python() {
  if [ -n "$PYTHON_BIN" ]; then
    echo "$PYTHON_BIN"; return
  fi
  if [ -x "${VENV_DIR}/bin/python" ]; then
    echo "${VENV_DIR}/bin/python"; return
  fi
  if command -v python3 >/dev/null 2>&1; then
    echo "$(command -v python3)"; return
  fi
  err "Python 3 not found. Install it or set SF_PYTHON."
  exit 1
}

ensure_deps() {
  local py; py="$(resolve_python)"
  if "${py}" -c "import fastapi, uvicorn" 2>/dev/null; then
    return
  fi
  log "Installing dependencies into ${VENV_DIR}..."
  "${py}" -m venv "${VENV_DIR}"
  "${VENV_DIR}/bin/pip" install --upgrade pip >/dev/null
  "${VENV_DIR}/bin/pip" install -r "${SERVER_DIR}/requirements.txt"
}

install_systemd() {
  ensure_deps
  local py; py="$(resolve_python)"
  local unit="/etc/systemd/system/scanforge-server.service"
  log "Writing systemd unit: ${unit}"
  sudo tee "${unit}" >/dev/null <<EOF
[Unit]
Description=ScanForge FastAPI processing server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=${SERVER_DIR}
ExecStart=${py} -m uvicorn main:app --host ${HOST} --port ${PORT}
Restart=on-failure
RestartSec=3
Environment=PYTHONUNBUFFERED=1

[Install]
WantedBy=multi-user.target
EOF
  sudo systemctl daemon-reload
  sudo systemctl enable scanforge-api.service
  sudo systemctl restart scanforge-api.service
  sudo systemctl --no-pager --lines=15 status scanforge-api.service || true
  log "Done. Server listening on http://${HOST}:${PORT}"
}

install_termux() {
  ensure_deps
  local py; py="$(resolve_python)"
  local svc_file="${PREFIX:-/data/data/com.termux/files/usr}/var/service/scanforge-api/run"
  log "Writing termux-service: ${svc_file}"
  mkdir -p "$(dirname "$svc_file")"
  cat > "$svc_file" <<EOF
#!/data/data/com.termux/files/usr/bin/sh
exec ${py} -m uvicorn main:app --host ${HOST} --port ${PORT}
EOF
  chmod +x "$svc_file"
  log "Done. Enable with: sv-enable scanforge-api && sv up scanforge-api"
}

uninstall_systemd() {
  sudo systemctl disable --now scanforge-api.service || true
  sudo rm -f /etc/systemd/system/scanforge-api.service
  sudo systemctl daemon-reload
  log "Removed systemd service."
}

uninstall_termux() {
  local svc_file="${HOME:-/data/data/com.termux/files/usr}/var/service/scanforge-api/run"
  rm -f "$svc_file" 2>/dev/null || true
  log "Removed termux-service run script."
}

case "${1:-install}" in
  install)
    if command -v systemctl >/dev/null 2>&1 && [ -d /run/systemd/system ]; then
      install_systemd
    else
      install_termux
    fi
    ;;
  uninstall)
    if command -v systemctl >/dev/null 2>&1; then
      uninstall_systemd
    else
      uninstall_termux
    fi
    ;;
  status)
    if command -v systemctl >/dev/null 2>&1; then
      systemctl --no-pager --full status scanforge-api.service || true
    else
      echo "No systemd detected — run 'sv status scanforge-api' in Termux"
    fi
    ;;
  logs)
    if command -v journalctl >/dev/null 2>&1; then
      sudo journalctl -u scanforge-api.service -f
    else
      tail -f "${HOME:-/data/data/com.termux/files/usr}/var/service/scanforge-api/log" 2>/dev/null || echo "No logs available"
    fi
    ;;
  *)
    err "Unknown command: $1 (use install | uninstall | status | logs)"
    exit 1
    ;;
esac