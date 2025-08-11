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
# Health check endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Copiar script de inicio
COPY start.sh ./
RUN chmod +x start.sh

# Comando para iniciar la aplicación
CMD ["./start.sh"]