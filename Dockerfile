# ==========================================
# NEXORA Backend - Production Dockerfile
# (Used when Root Directory is set to apps/backend)
# ==========================================

# --- Stage 1: Build & TypeScript Compilation ---
FROM node:20-alpine AS builder

WORKDIR /app

# Install native compilation dependencies
RUN apk add --no-cache python3 make g++

# Copy dependency manifests
COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Copy source and configurations
COPY tsconfig.json ./
COPY src/ ./src/

# Compile TypeScript to dist
RUN npm run build

# Remove development dependencies
RUN npm prune --omit=dev

# --- Stage 2: Minimal Production Runtime ---
FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Install curl for container health check
RUN apk add --no-cache curl

# Create non-root system user and group
RUN addgroup -S nexoragroup && adduser -S nexorauser -G nexoragroup

# Copy production node_modules, compiled artifacts, and manifest
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json

# Create uploads directory with non-root ownership
RUN mkdir -p /app/uploads && chown -R nexorauser:nexoragroup /app/uploads

USER nexorauser

EXPOSE 5000

HEALTHCHECK --interval=20s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:5000/health || exit 1

CMD ["node", "dist/server.js"]
