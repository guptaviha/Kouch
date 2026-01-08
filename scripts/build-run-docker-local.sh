#!/usr/bin/env bash
set -euo pipefail

# Build and run the app locally via Docker.
# Optional env vars:
#   PLATFORM (default: linux/arm64)

PLATFORM="${PLATFORM:-linux/arm64}"
IMAGE="kouch-game:local"
CONTAINER_NAME="kouch-local"

# Keep everything on the local daemon to avoid pulls from remote contexts.
docker context use default >/dev/null 2>&1 || true

echo "Building ${IMAGE} for ${PLATFORM}..."
docker build --platform "${PLATFORM}" -t "${IMAGE}" .

echo "Removing any existing container ${CONTAINER_NAME}..."
docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true

echo "Starting ${CONTAINER_NAME} from ${IMAGE}..."
docker run --name "${CONTAINER_NAME}" --platform "${PLATFORM}" -p 3000:3000 -p 3001:3001 "${IMAGE}"
