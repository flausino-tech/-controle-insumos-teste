# Build context é a RAIZ do repositório (não esta pasta) — veja docker-compose.yml
# ou o comando de build no README — porque o server.js também serve a pasta
# /insumos (front-end), que fica fora de backend/.
#
# node:22-slim (Debian) em vez de node:22-alpine: os binários do Prisma têm
# problema conhecido de compatibilidade com o musl/OpenSSL do Alpine
# ("Could not parse schema engine response... is not valid JSON").
FROM node:22-slim

WORKDIR /app/backend

RUN apt-get update -y && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

COPY backend/package*.json ./
RUN npm ci --omit=dev

COPY backend/ ./
COPY insumos/ /app/insumos/
RUN npx prisma generate --schema=src/db/schema.prisma

EXPOSE 3001
CMD ["sh", "-c", "npx prisma migrate deploy --schema=src/db/schema.prisma && node src/server.js"]
