# Build context é a RAIZ do repositório (não esta pasta) — veja docker-compose.yml
# ou o comando de build no README — porque o server.js também serve a pasta
# /insumos (front-end), que fica fora de backend/.
FROM node:22-alpine

WORKDIR /app/backend

COPY backend/package*.json ./
RUN npm ci --omit=dev

COPY backend/ ./
COPY insumos/ /app/insumos/
RUN npx prisma generate --schema=src/db/schema.prisma

EXPOSE 3001
CMD ["sh", "-c", "npx prisma migrate deploy --schema=src/db/schema.prisma && node src/server.js"]
