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
      '08:00-20:00'  // Franja completa de trabajo
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
    INGRESO_DEVOLUCION_CLIENTE: 'INGRESO_DEVOLUCION_CLIENTE',
    INGRESO_DEVOLUCION_PEDIDO_CANCELADO: 'INGRESO_DEVOLUCION_PEDIDO_CANCELADO',
    // Ingresos
    INGRESO_PRODUCCION: 'INGRESO_PRODUCCION',
    INGRESO_COMPRA_EXTERNA: 'INGRESO_COMPRA_EXTERNA',
    INGRESO_DEVOLUCION_COMODATO: 'INGRESO_DEVOLUCION_COMODATO',
    AJUSTE_POSITIVO: 'AJUSTE_POSITIVO',
    TRANSFERENCIA_ENTRADA: 'TRANSFERENCIA_ENTRADA',
    
    // Egresos
    EGRESO_VENTA_PRODUCTO: 'EGRESO_VENTA_PRODUCTO',
    EGRESO_ENTREGA_COMODATO: 'EGRESO_ENTREGA_COMODATO',
    AJUSTE_NEGATIVO: 'AJUSTE_NEGATIVO',
    TRANSFERENCIA_SALIDA: 'TRANSFERENCIA_SALIDA',
    
    // One-off purchases
    EGRESO_VENTA_UNICA: 'EGRESO_VENTA_UNICA',
    INGRESO_DEVOLUCION_VENTA_UNICA: 'INGRESO_DEVOLUCION_VENTA_UNICA',
    INGRESO_DEVOLUCION_VENTA_UNICA_CANCELADA: 'INGRESO_DEVOLUCION_VENTA_UNICA_CANCELADA',
  },

  // Configuración de semáforo de pagos
  PAYMENT_SEMAPHORE: {
    YELLOW_THRESHOLD_DAYS: 5, // Días para estado amarillo
    RED_THRESHOLD_DAYS: 7,    // Días para estado rojo
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