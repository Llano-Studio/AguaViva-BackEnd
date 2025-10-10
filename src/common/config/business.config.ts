export const BUSINESS_CONFIG = {
  // Configuración de inventario
  INVENTORY: {
    DEFAULT_WAREHOUSE_ID: 1, // ID del almacén principal
  },

  // Configuración de precios
  PRICING: {
    DEFAULT_PRICE_LIST_ID: 1, // ID de la lista de precios estándar/general
    STANDARD_PRICE_LIST_NAME: 'Lista General/Estándar',
  },

  // Configuración de horarios de entrega
  DELIVERY_SCHEDULE: {
    // Horarios disponibles de entrega - Cualquier franja permitida
    AVAILABLE_TIME_SLOTS: [
      '08:00-20:00', // Franja completa de trabajo
    ],
    // Días de la semana (0=Domingo, 6=Sábado)
    WORKING_DAYS: [1, 2, 3, 4, 5, 6], // Lunes a Sábado
    // Tiempo mínimo de anticipación para pedidos (horas)
    MINIMUM_ADVANCE_HOURS: 0, // Cambiado de 24 a 0 para permitir pedidos inmediatos
    // Tiempo máximo de anticipación para pedidos (días)
    MAXIMUM_ADVANCE_DAYS: 30,
  },

  // Códigos de tipos de movimiento de stock
  MOVEMENT_TYPES: {
    // Egresos (Salidas de inventario)
    EGRESO_VENTA_PRODUCTO: 'EGR_VENTA', // Egreso por venta de producto
    EGRESO_VENTA_UNICA: 'EGR_V_UNI', // Egreso por venta única
    EGRESO_ENTREGA_COMODATO: 'EGR_COMOD', // Egreso por entrega en comodato
    AJUSTE_NEGATIVO: 'AJ_NEG', // Ajuste negativo de inventario
    TRANSFERENCIA_SALIDA: 'TRANS_SAL', // Transferencia de salida

    // Ingresos (Entradas de inventario)
    INGRESO_DEVOLUCION_PEDIDO_CANCELADO: 'ING_DEV_PC', // Ingreso por devolución de pedido cancelado
    INGRESO_DEVOLUCION_CLIENTE: 'ING_DEV_CL', // Ingreso por devolución de cliente
    INGRESO_DEVOLUCION_VENTA_UNICA: 'ING_DV_VU', // Ingreso por devolución de venta única
    INGRESO_DEVOLUCION_VENTA_UNICA_CANCELADA: 'ING_DV_VUC', // Ingreso por devolución de venta única cancelada
    INGRESO_DEVOLUCION_CANCELACION_SUSCRIPCION: 'ING_DEV_CS', // Ingreso por devolución de cancelación de suscripción
    // Tipos adicionales con códigos de base de datos
    INGRESO_PRODUCCION: 'ING_PROD',
    INGRESO_COMPRA_EXTERNA: 'ING_COMP_EXT',
    INGRESO_DEVOLUCION_COMODATO: 'ING_DEV_COM',
    AJUSTE_POSITIVO: 'AJ_POS',
    TRANSFERENCIA_ENTRADA: 'TRANS_ENT',
  },

  // Configuración de semáforo de pagos
  PAYMENT_SEMAPHORE: {
    YELLOW_THRESHOLD_DAYS: 5, // Días para estado amarillo
    RED_THRESHOLD_DAYS: 10, // Días para estado rojo
  },

  // Configuración de paginación por defecto
  PAGINATION: {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 10,
    MAX_LIMIT: 100,
  },
} as const;

// Tipos para mejor type safety
export type MovementTypeCode = keyof typeof BUSINESS_CONFIG.MOVEMENT_TYPES;
export type PaymentSemaphoreStatus = 'NONE' | 'GREEN' | 'YELLOW' | 'RED';
