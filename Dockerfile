# Stage 1: Build frontend bundle
FROM node:24-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY index.html tsconfig.json vite.config.ts ./
COPY src ./src
RUN npm run build

# Stage 2: Lean production runtime
FROM node:24-alpine AS runtime
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm install -g tsx

ENV NODE_ENV=production
ENV PORT=3001
ENV DB_PATH=/app/data/47cities.db
ENV ENABLE_DEV_INBOX=true

COPY --from=builder /app/dist ./dist
COPY server ./server
COPY src/shared ./src/shared

RUN mkdir -p /app/data /app/uploads/voice /app/uploads/chat-images /app/uploads/avatars

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3001/api/auth/me > /dev/null || exit 1

CMD ["tsx", "server/index.ts"]
