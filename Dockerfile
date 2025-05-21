# Usamos una imagen base oficial de Node.js
FROM node:18-alpine

# Establecemos el directorio de trabajo
WORKDIR /app

# Copiamos los archivos de configuración del proyecto
COPY package*.json ./

# Instalamos las dependencias
RUN npm install

# Copiamos el código fuente
COPY . .

# Exponemos el puerto en el que correrá la aplicación
EXPOSE 3000

# Variables de entorno para la conexión a PostgreSQL
ENV DB_HOST=postgres_database
ENV DB_PORT=5432
ENV DB_NAME=postgres
ENV DB_USER=postgres
ENV DB_PASSWORD=123456

# Comando para iniciar la aplicación
CMD ["npm", "start"] 