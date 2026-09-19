FROM node:20-alpine AS base

# Step 1: Dependencies
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

RUN npm ci --workspace=backend

# Step 2: Builder
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/backend/node_modules ./backend/node_modules
COPY package.json ./
COPY backend ./backend

WORKDIR /app/backend
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npx prisma generate
RUN npm run build

# Step 3: Runner
FROM base AS runner
WORKDIR /app/backend

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3001
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/backend/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/backend/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/backend/.next/static ./.next/static
COPY --from=builder /app/backend/prisma ./prisma

USER nextjs

EXPOSE 3001

CMD ["node", "server.js"]
