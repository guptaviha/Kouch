#!/usr/bin/env bash
set -euo pipefail

# Build and run the app locally via Docker.
# Optional env vars:
#   PLATFORM (default: linux/arm64)

PLATFORM="${PLATFORM:-linux/arm64}"
IMAGE="kouch-game:local"
CONTAINER_NAME="kouch-local"

# If the user invoked this script from inside the scripts/ folder, go up one directory
if [[ "$(pwd)" == *scripts* ]]; then
  cd ..
fi

docker context use default >/dev/null 2>&1 || true

echo "Building ${IMAGE} for ${PLATFORM}..."
docker build --platform "${PLATFORM}" -t "${IMAGE}" .

echo "Removing any existing container ${CONTAINER_NAME}..."
docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true

echo "Starting ${CONTAINER_NAME} from ${IMAGE}..."
docker run --name "${CONTAINER_NAME}" --platform "${PLATFORM}" --env-file .env.local -p 3000:3000 -p 3001:3001 "${IMAGE}"
