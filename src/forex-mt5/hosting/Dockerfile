# Build with the repository root as context and this Dockerfile's companion ignore file.
FROM node:24-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOST=0.0.0.0 PORT=3000
COPY --from=build --chown=node:node /app /app
RUN mkdir -p /var/lib/nugaom/forex /var/lib/nugaom/membership && chown -R node:node /var/lib/nugaom
USER node
EXPOSE 3000
CMD ["node", "src/forex-mt5/hosting/start.mjs"]
