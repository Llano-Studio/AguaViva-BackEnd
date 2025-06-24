# 🌊 SGARAV - Sistema de Gestión de Agua Retornable y Venta

## 📋 Descripción

**SGARAV** es una API backend robusta desarrollada con **NestJS** para la gestión integral de una empresa especializada en la distribución de agua embotellada. El sistema maneja tanto productos retornables como no retornables, proporcionando una solución completa para la administración interna de la empresa.

### 🎯 Funcionalidades Principales

- 📦 **Gestión de Productos**: Administración de planes y productos de agua embotellada
- 🔄 **Sistema Retornable**: Control de envases retornables y no retornables
- 👥 **Gestión de Clientes**: Registro y administración de clientes corporativos e individuales
- 📋 **Gestión de Pedidos**: Procesamiento y seguimiento de órdenes de compra
- 📊 **Control de Stock**: Monitoreo en tiempo real de inventarios
- 🏢 **Administración Interna**: Herramientas para la gestión operativa de la empresa

## 🛠️ Tecnologías Utilizadas

- **Backend Framework**: [NestJS](https://nestjs.com/) - Framework progresivo de Node.js
- **Base de Datos**: [PostgreSQL](https://www.postgresql.org/) - Base de datos relacional
- **ORM**: [Prisma](https://www.prisma.io/) - Next-generation ORM para Node.js y TypeScript
- **Runtime**: [Node.js 20 LTS](https://nodejs.org/) - Entorno de ejecución JavaScript
- **Contenedores**: [Docker](https://www.docker.com/) - Containerización de la aplicación
- **Lenguaje**: [TypeScript](https://www.typescriptlang.org/) - JavaScript con tipado estático

## 🚀 Instalación y Configuración

### Prerrequisitos

- Node.js 20.x o superior
- Docker y Docker Compose
- PostgreSQL (si no se usa Docker)

### 1. Clonar el Repositorio

```bash
git clone <repository-url>
cd sgarav
```

### 2. Configuración de Variables de Entorno

Crear un archivo `.env` basado en `.env.example`:

```env
# Base de Datos
DB_HOST=localhost
DB_PORT=5432
DB_NAME=sgarav_db
DB_USER=postgres
DB_PASSWORD=123456

# Aplicación
NODE_ENV=development
PORT=3000

# JWT (si se implementa autenticación)
JWT_SECRET=your-secret-key-here
```

### 3. Instalación con Docker (Recomendado)

```bash
# Construir y levantar los servicios
docker-compose up -d

# Ver logs de la aplicación
docker-compose logs -f app
```

### 4. Instalación Manual

```bash
# Instalar dependencias
npm install

# Generar cliente Prisma
npx prisma generate

# Ejecutar migraciones
npx prisma migrate dev

# Seedear datos iniciales (opcional)
npx prisma db seed
```

## 📝 Scripts Disponibles

```bash
# Desarrollo
npm run start:dev          # Ejecutar en modo desarrollo con hot-reload
npm run start:debug        # Ejecutar en modo debug

# Producción
npm run build              # Compilar aplicación
npm run start:prod         # Ejecutar en modo producción

# Base de Datos
npx prisma migrate dev     # Ejecutar migraciones en desarrollo
npx prisma migrate deploy  # Ejecutar migraciones en producción
npx prisma studio          # Abrir Prisma Studio (GUI de BD)
npx prisma generate        # Generar cliente Prisma

# Testing
npm run test               # Ejecutar tests unitarios
npm run test:e2e          # Ejecutar tests end-to-end
npm run test:cov          # Ejecutar tests con coverage

# Linting y Formateo
npm run lint              # Ejecutar ESLint
npm run format            # Formatear código con Prettier
```

## 🏗️ Estructura del Proyecto

```
src/
├── modules/              # Módulos de la aplicación
│   ├── products/        # Gestión de productos
│   ├── customers/       # Gestión de clientes
│   ├── orders/          # Gestión de pedidos
│   ├── inventory/       # Control de inventario
│   └── auth/           # Autenticación (si aplica)
├── common/              # Utilidades compartidas
│   ├── dto/            # Data Transfer Objects
│   ├── guards/         # Guards de autenticación
│   ├── decorators/     # Decoradores personalizados
│   └── filters/        # Filtros de excepción
├── database/           # Configuración de base de datos
├── config/             # Configuraciones de la app
└── main.ts            # Punto de entrada de la aplicación
```

## 🔗 Endpoints Principales

### Productos
- `GET /products` - Listar productos
- `POST /products` - Crear producto
- `GET /products/:id` - Obtener producto por ID
- `PUT /products/:id` - Actualizar producto
- `DELETE /products/:id` - Eliminar producto

### Clientes
- `GET /customers` - Listar clientes
- `POST /customers` - Crear cliente
- `GET /customers/:id` - Obtener cliente por ID
- `PUT /customers/:id` - Actualizar cliente

### Pedidos
- `GET /orders` - Listar pedidos
- `POST /orders` - Crear pedido
- `GET /orders/:id` - Obtener pedido por ID
- `PUT /orders/:id/status` - Actualizar estado del pedido

### Inventario
- `GET /inventory` - Consultar stock
- `POST /inventory/adjust` - Ajustar inventario
- `GET /inventory/movements` - Historial de movimientos

## 🐳 Docker

El proyecto incluye configuración completa de Docker para facilitar el despliegue:

```yaml
# docker-compose.yml incluye:
- Aplicación NestJS (Puerto 3000)
- Base de datos PostgreSQL (Puerto 5432)
- Volúmenes persistentes para datos
- Health checks configurados
```

### Comandos Docker Útiles

```bash
# Reconstruir la aplicación
docker-compose build app

# Ver logs en tiempo real
docker-compose logs -f

# Ejecutar comandos dentro del contenedor
docker-compose exec app npm run prisma:studio

# Limpiar volúmenes (¡CUIDADO! - Elimina datos)
docker-compose down -v
```

## 🔒 Seguridad

- ✅ Imagen base actualizada a Node.js 20 LTS
- ✅ Variables de entorno para configuración sensible
- ✅ Health checks configurados
- ✅ Usuario no-root en contenedor Docker
- ✅ Validación de datos de entrada con DTOs


## 📊 Monitoreo y Salud

La aplicación incluye un endpoint de health check:

```
GET /health
```

Respuesta:
```json
{
  "status": "ok",
  "info": {
    "database": { "status": "up" }
  }
}
```

## 🤝 Contribución

1. Fork del proyecto
2. Crear rama de feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit de cambios (`git commit -am 'Agregar nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Crear Pull Request

## 📄 Licencia

Este proyecto es de uso interno de la empresa. Todos los derechos reservados.

## 📞 Soporte

Para soporte técnico o consultas sobre el proyecto, contactar al equipo de desarrollo.

---

**Desarrollado con ❤️ para la gestión eficiente de agua embotellada**

## Mejoras Recientes en la API

### Planes de Suscripción (v2.0)

Se han agregado nuevos campos a los planes de suscripción para mejorar el control y configuración:

#### Nuevos Campos Disponibles:

- **`default_cycle_days`** (Integer): Duración por defecto del ciclo en días (ej: 30 para mensual, 15 para quincenal)
- **`default_deliveries_per_cycle`** (Integer): Número de entregas por defecto por ciclo
- **`is_active`** (Boolean): Indica si el plan está disponible para nuevas suscripciones
- **`created_at`** (DateTime): Fecha de creación del plan
- **`updated_at`** (DateTime): Fecha de última actualización

#### Endpoints Actualizados:

**POST /api/subscription-plans**
```json
{
  "name": "Plan Premium Quincenal",
  "description": "Plan premium con entregas cada 15 días",
  "price": 25000.00,
  "default_cycle_days": 15,
  "default_deliveries_per_cycle": 2,
  "is_active": true
}
```

**PATCH /api/subscription-plans/1**
```json
{
  "default_cycle_days": 30,
  "default_deliveries_per_cycle": 1,
  "is_active": false
}
```

**GET /api/subscription-plans?is_active=true**
- Nuevo filtro por estado de activación
- Filtros disponibles: `search`, `name`, `is_active`
- Ordenamiento disponible: `name`, `price`, `default_cycle_days`, `default_deliveries_per_cycle`, `is_active`, `created_at`, `updated_at`

#### Compatibilidad:

✅ **Retrocompatible**: Los endpoints existentes siguen funcionando
✅ **Campos opcionales**: Los nuevos campos tienen valores por defecto
✅ **Base de datos**: Migración automática aplicada

#### Documentación Swagger:

Accede a `/api/docs` para ver la documentación completa con:
- Ejemplos de requests/responses
- Casos de uso detallados  
- Códigos de error explicados
- Filtros y ordenamiento disponibles
