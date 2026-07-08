#!/usr/bin/env bash
set -euo pipefail

log() {
  printf '[setup] %s\n' "$*"
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    printf '[setup] missing required command: %s\n' "$1" >&2
    exit 1
  }
}

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  if command -v sudo >/dev/null 2>&1; then
    SUDO=sudo
  else
    printf '[setup] this script needs root access or sudo\n' >&2
    exit 1
  fi
else
  SUDO=""
fi

require_cmd apt-get
require_cmd curl
require_cmd dpkg
require_cmd tee

if [[ -r /etc/os-release ]]; then
  . /etc/os-release
else
  printf '[setup] cannot read /etc/os-release\n' >&2
  exit 1
fi

case "${ID:-}" in
  ubuntu)
    docker_repo_base="https://download.docker.com/linux/ubuntu"
    distro_codename="${UBUNTU_CODENAME:-${VERSION_CODENAME:-}}"
    ;;
  debian)
    docker_repo_base="https://download.docker.com/linux/debian"
    distro_codename="${VERSION_CODENAME:-}"
    ;;
  *)
    printf '[setup] unsupported distro: %s\n' "${ID:-unknown}" >&2
    exit 1
    ;;
esac

if [[ -z "$distro_codename" ]]; then
  printf '[setup] cannot determine distro codename\n' >&2
  exit 1
fi

target_user="${SUDO_USER:-${USER:-}}"

log "updating apt"
$SUDO apt-get update

log "installing prerequisites"
$SUDO apt-get install -y ca-certificates curl

log "adding docker apt key"
$SUDO install -m 0755 -d /etc/apt/keyrings
$SUDO curl -fsSL "${docker_repo_base}/gpg" -o /etc/apt/keyrings/docker.asc
$SUDO chmod a+r /etc/apt/keyrings/docker.asc

log "writing docker apt source"
$SUDO rm -f /etc/apt/sources.list.d/docker.list
$SUDO tee /etc/apt/sources.list.d/docker.sources >/dev/null <<EOF
Types: deb
URIs: ${docker_repo_base}
Suites: ${distro_codename}
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF

log "installing docker engine"
$SUDO apt-get update
$SUDO apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

log "enabling docker service"
$SUDO systemctl enable --now docker

if [[ -n "$target_user" && "$target_user" != "root" ]]; then
  if getent group docker >/dev/null 2>&1; then
    log "adding ${target_user} to docker group"
    $SUDO usermod -aG docker "$target_user"
  else
    log "docker group missing; skipping usermod"
  fi
fi

cat <<EOF
[setup] done
[setup] restart your SSH session so the docker group membership takes effect
[setup] verify with:
[setup]   docker --version
[setup]   docker compose version
EOF
