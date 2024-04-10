# Base
FROM node:18-alpine AS base
ENV NEXT_TELEMETRY_DISABLED 1


# Dependencies
FROM base AS deps
WORKDIR /app

# Dependency files
COPY package*.json ./
COPY src/server/prisma ./src/server/prisma

# Install dependencies, including dev (release builds should use npm ci)
ENV NODE_ENV development
RUN npm ci


# Builder
FROM base AS builder
WORKDIR /app

# Optional argument to configure GA4 at build time (see: docs/deploy-analytics.md)
ARG NEXT_PUBLIC_GA4_MEASUREMENT_ID
ENV NEXT_PUBLIC_GA4_MEASUREMENT_ID=${NEXT_PUBLIC_GA4_MEASUREMENT_ID}

# Copy development deps and source
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build the application
ENV NODE_ENV production
RUN npm run build

# Reduce installed packages to production-only
RUN npm prune --production


# Runner
FROM base AS runner
WORKDIR /app

# As user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy Built app
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/src/server/prisma ./src/server/prisma

# Minimal ENV for production
ENV NODE_ENV production
ENV PATH $PATH:/app/node_modules/.bin

# Run as non-root user
USER nextjs

# Expose port 3000 for the application to listen on
EXPOSE 3000

# Start the application
CMD ["next", "start"]