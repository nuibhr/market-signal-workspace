FROM node:24-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS=--max-old-space-size=1024
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build
FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000
COPY --from=build --chown=node:node /app /app
RUN mkdir -p /var/lib/nugaom/forex && chown -R node:node /var/lib/nugaom
USER node
EXPOSE 3000
CMD ["node","deploy/web-vps/start.mjs"]
