# ─────────────────────────────────────────────────────────────
# Stage 1: Install dependencies
# ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# ─────────────────────────────────────────────────────────────
# Stage 2: Build the Next.js app
# ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time placeholders — real secrets are injected at runtime via env_file.
# Next.js API routes (server-side) read process.env at request time, not build time.
ENV NOTION_TOKEN=placeholder
ENV NOTION_CONTACTS_DB_ID=placeholder
ENV NOTION_COMPANIES_DB_ID=placeholder
ENV NOTION_EVENTS_DB_ID=placeholder
ENV NOTION_ATTENDANCE_DB_ID=placeholder
ENV NOTION_INTERACTIONS_DB_ID=placeholder
ENV NOTION_SPEAKERS_DB_ID=placeholder
ENV NOTION_SCREENSHOT_INBOX_DB_ID=placeholder
ENV OPENAI_API_KEY=placeholder
ENV AUTH_SECRET=placeholder_min_32_chars_xxxxxxxxxx
ENV APP_PASSWORD=placeholder

RUN npm run build

# ─────────────────────────────────────────────────────────────
# Stage 3: Slim production runtime (no node_modules needed)
# ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy only the standalone output from the build stage
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
# Event registry and team config are read at runtime
COPY --from=builder --chown=nextjs:nodejs /app/config ./config

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
