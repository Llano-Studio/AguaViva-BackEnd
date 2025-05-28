export const BUSINESS_CONFIG = {
  // Configuración de inventario
  INVENTORY: {
    DEFAULT_WAREHOUSE_ID: 1, // ID del almacén principal
  },

  // Códigos de tipos de movimiento de stock
  MOVEMENT_TYPES: {
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