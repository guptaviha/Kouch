# syntax=docker/dockerfile:1.7

# -------- Base build stage (installs deps + builds Next) --------
# node:22-alpine ships multi-arch images (arm64/amd64) so this Dockerfile works on Apple Silicon.
FROM --platform=$BUILDPLATFORM node:22-alpine AS builder
WORKDIR /app

# Disable Next.js telemetry while building inside CI/container environments.
ENV NEXT_TELEMETRY_DISABLED=1

# Install dependencies using the lockfile for reproducibility.
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/package.json
COPY apps/realtime/package.json ./apps/realtime/package.json
RUN npm ci

# Bring in the source and build the Next.js app + typecheck.
COPY . .
RUN npm run build:web

# -------- Runtime stage --------
FROM --platform=$TARGETPLATFORM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy only what we need to run the built app and the legacy Socket.IO server.
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/apps/web/package.json ./apps/web/package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/web/.next ./apps/web/.next
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/server ./server
COPY --from=builder /app/apps/web/src ./apps/web/src
COPY --from=builder /app/apps/web/next.config.mjs ./apps/web/next.config.mjs
COPY --from=builder /app/apps/web/postcss.config.mjs ./apps/web/postcss.config.mjs
COPY --from=builder /app/apps/web/tailwind.config.ts ./apps/web/tailwind.config.ts
COPY --from=builder /app/apps/web/tsconfig.json ./apps/web/tsconfig.json
COPY --from=builder /app/tsconfig.base.json ./tsconfig.base.json

# Trim devDependencies to keep the image lean.
RUN npm prune --omit=dev

EXPOSE 3000 3001

# Start the web app (3000) and the legacy Socket.IO server (3001) in the same container.
CMD ["sh", "-c", "npm run start --workspace @kouch/web -- -H 0.0.0.0 -p 3000 & npm run dev:legacy-socket & wait -n"]
