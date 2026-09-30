# ---- Build stage ----
FROM node:22-bookworm AS builder

WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build && npm prune --omit=dev

# ---- Runtime stage ----
FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production PORT=4000
WORKDIR /app

RUN groupadd --gid 10001 app && useradd --uid 10001 --gid app --home /app app && \
    mkdir -p /app/data /app/dist-server /data && chown -R app:app /app /data

COPY --from=builder --chown=app:app /app/node_modules ./node_modules
COPY --from=builder --chown=app:app /app/dist ./dist
COPY --from=builder --chown=app:app /app/dist-server ./dist-server
COPY --from=builder --chown=app:app /app/package.json ./

USER app
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4000/api/health').then(r=>{if(!r.ok)process.exit(1);return r.json()}).then(j=>process.exit(j.db==='ok'?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist-server/server.js"]