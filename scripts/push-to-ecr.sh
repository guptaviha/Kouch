#!/usr/bin/env bash
set -euo pipefail

# Simple helper to build (ARM-friendly) and push the game image to AWS ECR.
# Required env vars:
#   AWS_ACCOUNT_ID, AWS_REGION, ECR_REPO
# Optional env vars:
#   IMAGE_TAG (default: latest), PLATFORM (default: linux/arm64)

: "${AWS_ACCOUNT_ID?Set AWS_ACCOUNT_ID}"  # 12-digit AWS account id
: "${AWS_REGION?Set AWS_REGION}"          # e.g. us-east-1
: "${ECR_REPO?Set ECR_REPO}"              # existing ECR repo name

IMAGE_TAG="${IMAGE_TAG:-latest}"
PLATFORM="${PLATFORM:-linux/arm64}"
REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
IMAGE="${REGISTRY}/${ECR_REPO}:${IMAGE_TAG}"

aws ecr get-login-password --region "${AWS_REGION}" | docker login --username AWS --password-stdin "${REGISTRY}"

echo "Building ${IMAGE} for ${PLATFORM}..."
docker buildx build --platform "${PLATFORM}" -t "${IMAGE}" .

echo "Pushing ${IMAGE}..."
docker push "${IMAGE}"

echo "Done."
