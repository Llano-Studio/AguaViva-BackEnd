FROM node:20-alpine

# Establecemos el directorio de trabajo
WORKDIR /app

# Copiamos los archivos de configuración del proyecto
COPY package*.json ./
COPY prisma ./prisma/

# Instalamos las dependencias
RUN npm install

# Generamos el cliente de Prisma
RUN npx prisma generate

# Copiamos el código fuente
COPY . .

# Compilamos la aplicación NestJS
RUN npm run build

# Exponemos el puerto en el que correrá la aplicación
EXPOSE 3000

# Instalamos curl para health checks
RUN apk add --no-cache curl

# Variables de entorno por defecto (serán sobrescritas por docker-compose)
ENV DB_HOST=sgarav-postgres
ENV DB_PORT=5432
ENV DB_NAME=sgarav_db
ENV DB_USER=postgres
ENV DB_PASSWORD=123456
ENV NODE_ENV=production

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Comando para iniciar la aplicación
CMD ["npm", "run", "start:prod"]