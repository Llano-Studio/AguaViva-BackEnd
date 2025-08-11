FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/
RUN npm install
RUN npx prisma generate

COPY . .
RUN npm run build

EXPOSE 3000

# curl + bash (bash para start.sh)
RUN apk add --no-cache curl bash

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

COPY start.sh ./
RUN sed -i 's/\r$//' start.sh && chmod +x start.sh

CMD ["./start.sh"]
