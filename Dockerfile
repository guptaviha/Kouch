# syntax=docker/dockerfile:1.7

# -------- Base build stage (installs deps + builds Next) --------
# node:22-alpine ships multi-arch images (arm64/amd64) so this Dockerfile works on Apple Silicon.
FROM --platform=$BUILDPLATFORM node:22-alpine AS builder
WORKDIR /app

# Disable Next.js telemetry while building inside CI/container environments.
ENV NEXT_TELEMETRY_DISABLED=1

# Install dependencies using the lockfile for reproducibility.
COPY package.json package-lock.json ./
RUN npm ci

# Bring in the source and build the Next.js app + typecheck.
COPY . .
RUN npm run build

# -------- Runtime stage --------
FROM --platform=$TARGETPLATFORM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy only what we need to run the built app and the Socket.IO server.
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/server ./server
COPY --from=builder /app/src ./src
COPY --from=builder /app/next.config.mjs ./next.config.mjs
COPY --from=builder /app/postcss.config.mjs ./postcss.config.mjs
COPY --from=builder /app/tailwind.config.ts ./tailwind.config.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Trim devDependencies to keep the image lean.
RUN npm prune --omit=dev

EXPOSE 3000 3001

# Start Next.js (3000) and the Socket.IO server (3001) in the same container.
CMD ["npm", "run", "start:docker"]
