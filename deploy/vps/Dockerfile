FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --include=dev --ignore-scripts
COPY src ./src
COPY scripts/build-vps-scanner.mjs scripts/vps-signal-worker.mjs ./scripts/
RUN node scripts/build-vps-scanner.mjs

FROM node:24-bookworm-slim
WORKDIR /app
COPY --from=build --chown=node:node /app/dist/scanner.mjs ./scanner.mjs
USER node
ENV NODE_ENV=production STORAGE_PROVIDER=scanner-http
CMD ["node","scanner.mjs"]
