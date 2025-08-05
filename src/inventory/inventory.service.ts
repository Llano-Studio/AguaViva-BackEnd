import { Injectable, InternalServerErrorException, NotFoundException, OnModuleInit, BadRequestException } from '@nestjs/common';
import { PrismaClient, Prisma, stock_movement as PrismaStockMovement, movement_type as MovementTypePrisma, inventory as PrismaInventory } from '@prisma/client';
import { CreateStockMovementDto } from './dto/create-stock-movement.dto';
import { CreateInventoryDto } from './dto/create-inventory.dto';
import { InventoryResponseDto } from './dto/inventory-response.dto';
import { Decimal } from '@prisma/client/runtime/library';
import { FilterInventoryDto, PaginatedInventoryResponseDto, InventoryDetailDto } from './dto/filter-inventory.dto';
import { parseSortByString } from '../common/utils/query-parser.utils';
import { handlePrismaError } from '../common/utils/prisma-error-handler.utils';
import { BUSINESS_CONFIG } from '../common/config/business.config';

@Injectable()
export class InventoryService extends PrismaClient implements OnModuleInit {
    private readonly entityNameInventory = 'Inventario';
    private readonly entityNameStockMovement = 'Movimiento de Stock';
    private readonly entityNameMovementType = 'Tipo de Movimiento';
    private readonly entityNameProduct = 'Producto';
    private readonly entityNameWarehouse = 'Almacén';

    // Los códigos de tipos de movimiento ahora se obtienen desde BUSINESS_CONFIG

    // Códigos de tipos de movimiento obtenidos desde BUSINESS_CONFIG
    private entryMovementTypeCodes: string[] = [
        BUSINESS_CONFIG.MOVEMENT_TYPES.INGRESO_PRODUCCION,
        BUSINESS_CONFIG.MOVEMENT_TYPES.INGRESO_COMPRA_EXTERNA,
        BUSINESS_CONFIG.MOVEMENT_TYPES.INGRESO_DEVOLUCION_COMODATO,
        BUSINESS_CONFIG.MOVEMENT_TYPES.AJUSTE_POSITIVO,
        BUSINESS_CONFIG.MOVEMENT_TYPES.TRANSFERENCIA_ENTRADA,
        BUSINESS_CONFIG.MOVEMENT_TYPES.INGRESO_DEVOLUCION_PEDIDO_CANCELADO,
        BUSINESS_CONFIG.MOVEMENT_TYPES.INGRESO_DEVOLUCION_CLIENTE,
        BUSINESS_CONFIG.MOVEMENT_TYPES.INGRESO_DEVOLUCION_VENTA_UNICA,
        BUSINESS_CONFIG.MOVEMENT_TYPES.INGRESO_DEVOLUCION_VENTA_UNICA_CANCELADA
    ];
    private exitMovementTypeCodes: string[] = [
        BUSINESS_CONFIG.MOVEMENT_TYPES.EGRESO_VENTA_PRODUCTO,
        BUSINESS_CONFIG.MOVEMENT_TYPES.EGRESO_ENTREGA_COMODATO,
        BUSINESS_CONFIG.MOVEMENT_TYPES.AJUSTE_NEGATIVO,
        BUSINESS_CONFIG.MOVEMENT_TYPES.EGRESO_VENTA_UNICA,
        BUSINESS_CONFIG.MOVEMENT_TYPES.TRANSFERENCIA_SALIDA
    ];
    // Códigos de transferencia
    private transferMovementTypeCodes = ['TRANSFERENCIA'];

    constructor() {
        super();
    }

    async onModuleInit() {
        await this.$connect();
        // Considera cargar dinámicamente los movementTypeCodes desde la BD aquí
    }

    /**
     * Obtiene el ID de un tipo de movimiento basado en su código.
     * @param code El código único del tipo de movimiento.
     * @param tx (Opcional) Un cliente de transacción Prisma.
     * @returns El ID del tipo de movimiento.
     * @throws NotFoundException si no se encuentra el tipo de movimiento.
     */
    async getMovementTypeIdByCode(code: string, tx?: Prisma.TransactionClient): Promise<number> {
        const prisma = tx || this;
        try {
            const movementType = await prisma.movement_type.findUnique({
                where: { code },
            });
            if (!movementType) {
                throw new NotFoundException(`${this.entityNameMovementType} con código '${code}' no encontrado.`);
            }
            return movementType.movement_type_id;
        } catch (error) {
            if (error instanceof NotFoundException) throw error;
            handlePrismaError(error, this.entityNameMovementType);
            throw new InternalServerErrorException(`Error al obtener ID para ${this.entityNameMovementType.toLowerCase()} con código ${code}.`);
        }
    }

    /**
     * Calcula el stock actual para un producto específico, opcionalmente en un almacén específico.
     * Si no se provee warehouseId, calcula el stock total en todos los almacenes.
     * @param productId El ID del producto.
     * @param warehouseId (Opcional) El ID del almacén.
     * @returns La cantidad de stock actual.
     */
    async getProductStock(productId: number, warehouseId?: number, tx?: Prisma.TransactionClient): Promise<number> {
        const prisma = tx || this;
        try {
            const product = await prisma.product.findUnique({ where: { product_id: productId } });
            if (!product) {
                throw new NotFoundException(`${this.entityNameProduct} con ID ${productId} no encontrado.`);
            }

            if (warehouseId) {
                const inventoryRecord = await prisma.inventory.findUnique({
                    where: {
                        warehouse_id_product_id: {
                            warehouse_id: warehouseId,
                            product_id: productId,
                        },
                    },
                });
                return inventoryRecord ? inventoryRecord.quantity : 0;
            } else {
                const inventoryRecords = await prisma.inventory.findMany({
                    where: { product_id: productId },
                });
                if (!inventoryRecords || inventoryRecords.length === 0) {
                    return 0;
                }
                const totalStock = inventoryRecords.reduce((sum, record) => sum + record.quantity, 0);
                return totalStock;
            }
        } catch (error) {
            if (error instanceof NotFoundException) throw error;
            handlePrismaError(error, this.entityNameInventory);
            throw new InternalServerErrorException(`Error calculando stock para ${this.entityNameProduct.toLowerCase()} ID ${productId}.`);
        }
    }

    async createStockMovement(createStockMovementDto: CreateStockMovementDto, tx?: Prisma.TransactionClient): Promise<PrismaStockMovement> {
        const operations = async (prismaClient: Prisma.TransactionClient | PrismaClient) => {
            const {
                movement_type_id,
                product_id,
                quantity,
                source_warehouse_id,
                destination_warehouse_id,
                movement_date,
                remarks,
            } = createStockMovementDto;

            if (quantity <= 0) {
                throw new BadRequestException('La cantidad del movimiento debe ser mayor que cero.');
            }

            // 1. Validar Product y MovementType
            const product = await prismaClient.product.findUnique({ where: { product_id } });
            if (!product) {
                throw new NotFoundException(`${this.entityNameProduct} con ID ${product_id} no encontrado.`);
            }

            const movementType = await prismaClient.movement_type.findUnique({ where: { movement_type_id } });
            if (!movementType) {
                throw new NotFoundException(`${this.entityNameMovementType} con ID ${movement_type_id} no encontrado.`);
            }

            // 2. Lógica para determinar la naturaleza del movimiento y validar almacenes
            const movementTypeCode = movementType.code;
            const isEntry = this.entryMovementTypeCodes.includes(movementTypeCode);
            const isExit = this.exitMovementTypeCodes.includes(movementTypeCode);

            let effectiveSourceWarehouseId = source_warehouse_id || null;
            let effectiveDestinationWarehouseId = destination_warehouse_id || null;

            if (isEntry) {
                if (!destination_warehouse_id) {
                    throw new BadRequestException(`Para un movimiento de entrada (${movementType.description}), se requiere destination_warehouse_id.`);
                }
                effectiveSourceWarehouseId = null;
            } else if (isExit) {
                if (!source_warehouse_id) {
                    throw new BadRequestException(`Para un movimiento de salida (${movementType.description}), se requiere source_warehouse_id.`);
                }
                effectiveDestinationWarehouseId = null;
            } else if (this.transferMovementTypeCodes.includes(movementTypeCode)) {
                if (!source_warehouse_id || !destination_warehouse_id) {
                    throw new BadRequestException('Para una transferencia, se requieren source_warehouse_id y destination_warehouse_id.');
                }
                if (source_warehouse_id === destination_warehouse_id) {
                    throw new BadRequestException('El almacén de origen y destino no pueden ser el mismo para una transferencia.');
                }
            } else {
                if (!source_warehouse_id && !destination_warehouse_id) {
                    console.warn(`${this.entityNameStockMovement}: Tipo de movimiento '${movementType.code}' no es entrada/salida/transferencia clara y no se especificaron almacenes. El inventario no se actualizará.`);
                }
            }

            if (effectiveSourceWarehouseId) {
                const sourceWarehouse = await prismaClient.warehouse.findUnique({ where: { warehouse_id: effectiveSourceWarehouseId } });
                if (!sourceWarehouse) throw new NotFoundException(`${this.entityNameWarehouse} de origen con ID ${effectiveSourceWarehouseId} no encontrado.`);
            }
            if (effectiveDestinationWarehouseId) {
                const destWarehouse = await prismaClient.warehouse.findUnique({ where: { warehouse_id: effectiveDestinationWarehouseId } });
                if (!destWarehouse) throw new NotFoundException(`${this.entityNameWarehouse} de destino con ID ${effectiveDestinationWarehouseId} no encontrado.`);
            }

            let stockMovement: PrismaStockMovement;
            try {
                stockMovement = await prismaClient.stock_movement.create({
                    data: {
                        movement_date: movement_date || new Date(),
                        movement_type_id,
                        product_id,
                        quantity,
                        source_warehouse_id: effectiveSourceWarehouseId,
                        destination_warehouse_id: effectiveDestinationWarehouseId,
                        remarks: remarks || null,
                    },
                });
            } catch (error) {
                handlePrismaError(error, this.entityNameStockMovement);
                throw new InternalServerErrorException(`Error creando ${this.entityNameStockMovement.toLowerCase()}.`);
            }

            try {
                if (effectiveSourceWarehouseId && (isExit || this.transferMovementTypeCodes.includes(movementTypeCode))) {
                    const currentInventorySource = await prismaClient.inventory.findUnique({
                        where: { warehouse_id_product_id: { warehouse_id: effectiveSourceWarehouseId, product_id } },
                    });
                    const newQuantitySourceCalc = new Decimal(currentInventorySource?.quantity || 0).minus(quantity);
                    if (currentInventorySource) {
                        if (newQuantitySourceCalc.isNegative() && !product.is_returnable) {
                            throw new BadRequestException(
                                `Stock insuficiente en ${this.entityNameWarehouse.toLowerCase()} de origen ID ${effectiveSourceWarehouseId} para ${this.entityNameProduct.toLowerCase()} ID ${product_id}. Cantidad actual: ${currentInventorySource.quantity}, Solicitado deducir: ${quantity}`
                            );
                        }
                        await prismaClient.inventory.update({
                            where: { warehouse_id_product_id: { warehouse_id: effectiveSourceWarehouseId, product_id } },
                            data: { quantity: newQuantitySourceCalc.toNumber() },
                        });
                    } else {
                        if (newQuantitySourceCalc.isNegative() && !product.is_returnable) {
                            throw new BadRequestException(
                                `Intento de salida de ${this.entityNameProduct.toLowerCase()} ID ${product_id} de ${this.entityNameWarehouse.toLowerCase()} ID ${effectiveSourceWarehouseId} donde no hay stock registrado (resultaría en stock negativo).`
                            );
                        }
                        await prismaClient.inventory.create({
                            data: { product_id, warehouse_id: effectiveSourceWarehouseId, quantity: newQuantitySourceCalc.toNumber() },
                        });
                    }
                }
    
                if (effectiveDestinationWarehouseId && (isEntry || this.transferMovementTypeCodes.includes(movementTypeCode))) {
                    const currentInventoryDest = await prismaClient.inventory.findUnique({
                        where: { warehouse_id_product_id: { warehouse_id: effectiveDestinationWarehouseId, product_id } },
                    });
                    const newQuantityDestCalc = new Decimal(currentInventoryDest?.quantity || 0).plus(quantity);
                    if (currentInventoryDest) {
                        await prismaClient.inventory.update({
                            where: { warehouse_id_product_id: { warehouse_id: effectiveDestinationWarehouseId, product_id } },
                            data: { quantity: newQuantityDestCalc.toNumber() },
                        });
                    } else {
                        await prismaClient.inventory.create({
                            data: { product_id, warehouse_id: effectiveDestinationWarehouseId, quantity: newQuantityDestCalc.toNumber() },
                        });
                    }
                }
            } catch (error) {
                if (error instanceof BadRequestException) throw error; 
                handlePrismaError(error, this.entityNameInventory); 
                throw new InternalServerErrorException(`Error actualizando ${this.entityNameInventory.toLowerCase()}.`);
            }
            return stockMovement;
        };

        try {
            return tx ? await operations(tx) : await this.$transaction(operations);
        } catch(error) {
            // Si el error ya fue manejado y es una de nuestras excepciones, relanzarlo.
            if (error instanceof NotFoundException || error instanceof BadRequestException || error instanceof InternalServerErrorException) throw error;
            // Para otros errores de Prisma no capturados dentro de `operations` (ej. problemas de conexión al inicio de la tx)
            handlePrismaError(error, this.entityNameStockMovement);
            throw new InternalServerErrorException(`Error en la transacción al crear ${this.entityNameStockMovement.toLowerCase()}.`);
        }
    }

    async getFullStockWithDetails(filters: FilterInventoryDto): Promise<PaginatedInventoryResponseDto> {
        const { page = 1, limit = 10, sortBy, warehouse_id, product_id, product_description, category_id, min_quantity, max_quantity } = filters;
        const skip = (Math.max(1, page) - 1) * Math.max(1, limit);
        const take = Math.max(1, limit);

        const where: Prisma.inventoryWhereInput = {};
        if (warehouse_id) where.warehouse_id = warehouse_id;
        if (product_id) where.product_id = product_id;
        
        let productWhere: Prisma.productWhereInput = {};
        if (product_description) {
            productWhere.description = { contains: product_description, mode: 'insensitive' };
        }
        if (category_id) {
            productWhere.category_id = category_id;
        }
        if (Object.keys(productWhere).length > 0) {
            where.product = productWhere;
        }

        let quantityWhere: Prisma.IntFilter = {}; 
        if (min_quantity !== undefined) {
            quantityWhere.gte = min_quantity;
        }
        if (max_quantity !== undefined) {
            quantityWhere.lte = max_quantity;
        }
        if (Object.keys(quantityWhere).length > 0) {
            where.quantity = quantityWhere;
        } 

        const orderBy = parseSortByString(sortBy, [{ product: { description: 'asc' } }]);

        try {
            const totalItems = await this.inventory.count({ where });
            const inventoryItems = await this.inventory.findMany({
                where,
                include: {
                    product: { include: { product_category: true } },
                    warehouse: { include: { locality: true } },
                },
                orderBy,
                skip,
                take,
            });

            const data: InventoryDetailDto[] = inventoryItems.map(item => ({
                warehouse_id: item.warehouse_id,
                product_id: item.product_id,
                quantity: item.quantity,
                product_description: item.product.description,
                product_category: item.product.product_category.name,
                warehouse_name: item.warehouse.name,
                warehouse_locality: item.warehouse.locality?.name || 'N/A',
            }));

            return {
                data,
                total: totalItems,
                page,
                limit: take,
                totalPages: Math.ceil(totalItems / take),
            };
        } catch (error) {
            handlePrismaError(error, this.entityNameInventory);
            throw new InternalServerErrorException(`Error obteniendo el stock detallado del ${this.entityNameInventory.toLowerCase()}.`);
        }
    }

    async getStockInWarehouse(productId: number, warehouseId: number): Promise<{ productId: number, warehouseId: number, quantity: number, productDescription: string, warehouseName: string }> {
        try {
            const inventoryItem = await this.inventory.findUnique({
                where: { warehouse_id_product_id: { warehouse_id: warehouseId, product_id: productId } },
                include: {
                    product: true,
                    warehouse: true,
                },
            });

            if (!inventoryItem) {
                throw new NotFoundException(`${this.entityNameInventory} no encontrado para ${this.entityNameProduct.toLowerCase()} ID ${productId} en ${this.entityNameWarehouse.toLowerCase()} ID ${warehouseId}.`);
            }

            return {
                productId: inventoryItem.product_id,
                warehouseId: inventoryItem.warehouse_id,
                quantity: inventoryItem.quantity,
                productDescription: inventoryItem.product.description,
                warehouseName: inventoryItem.warehouse.name,
            };
        } catch (error) {
            if (error instanceof NotFoundException) throw error;
            handlePrismaError(error, this.entityNameInventory);
            throw new InternalServerErrorException(
                `Error obteniendo stock para ${this.entityNameProduct.toLowerCase()} ID ${productId} en ${this.entityNameWarehouse.toLowerCase()} ID ${warehouseId}.`
            );
        }
    }

    /**
     * Crea un registro de inventario inicial para un producto en un almacén específico.
     * @param createInventoryDto Datos para crear el inventario inicial
     * @param tx (Opcional) Cliente de transacción Prisma
     * @returns Información del inventario creado
     */
    async createInitialInventory(createInventoryDto: CreateInventoryDto, tx?: Prisma.TransactionClient): Promise<InventoryResponseDto> {
        const operations = async (prismaClient: Prisma.TransactionClient | PrismaClient) => {
            const { product_id, warehouse_id, quantity, remarks } = createInventoryDto;

            // 1. Validar que el producto existe
            const product = await prismaClient.product.findUnique({ 
                where: { product_id },
                include: { product_category: true }
            });
            if (!product) {
                throw new NotFoundException(`${this.entityNameProduct} con ID ${product_id} no encontrado.`);
            }

            // 2. Validar que el almacén existe
            const warehouse = await prismaClient.warehouse.findUnique({ 
                where: { warehouse_id: warehouse_id },
                include: { locality: true }
            });
            if (!warehouse) {
                throw new NotFoundException(`${this.entityNameWarehouse} con ID ${warehouse_id} no encontrado.`);
            }

            // 3. Verificar que no existe inventario previo para este producto en este almacén
            const existingInventory = await prismaClient.inventory.findUnique({
                where: { 
                    warehouse_id_product_id: { 
                        warehouse_id: warehouse_id, 
                        product_id: product_id 
                    } 
                }
            });

            if (existingInventory) {
                throw new BadRequestException(
                    `Ya existe inventario para el ${this.entityNameProduct.toLowerCase()} '${product.description}' en el ${this.entityNameWarehouse.toLowerCase()} '${warehouse.name}'. Use el endpoint de movimientos de stock para ajustar cantidades.`
                );
            }

            // 4. Crear el registro de inventario inicial
            let inventoryRecord: PrismaInventory;
            try {
                inventoryRecord = await prismaClient.inventory.create({
                    data: {
                        product_id,
                        warehouse_id,
                        quantity,
                    },
                });
            } catch (error) {
                handlePrismaError(error, this.entityNameInventory);
                throw new InternalServerErrorException(`Error creando ${this.entityNameInventory.toLowerCase()} inicial.`);
            }

            // 5. Crear un movimiento de stock asociado para trazabilidad (opcional)
            if (quantity > 0) {
                try {
                    // Buscar el tipo de movimiento para inventario inicial
                    const movementType = await prismaClient.movement_type.findFirst({
                        where: { 
                            OR: [
                                { code: 'INVENTARIO_INICIAL' },
                                { code: BUSINESS_CONFIG.MOVEMENT_TYPES.AJUSTE_POSITIVO },
                                { code: BUSINESS_CONFIG.MOVEMENT_TYPES.INGRESO_PRODUCCION }
                            ]
                        }
                    });

                    if (movementType) {
                        await prismaClient.stock_movement.create({
                            data: {
                                movement_date: new Date(),
                                movement_type_id: movementType.movement_type_id,
                                product_id,
                                destination_warehouse_id: warehouse_id,
                                quantity,
                                remarks: remarks || `Inventario inicial - ${product.description}`,
                            },
                        });
                    }
                } catch (error) {
                    // No fallar si no se puede crear el movimiento, solo logear
                    console.warn(`No se pudo crear movimiento de stock para inventario inicial: ${error.message}`);
                }
            }

            // 6. Preparar respuesta
            return {
                product_id: inventoryRecord.product_id,
                warehouse_id: inventoryRecord.warehouse_id,
                quantity: inventoryRecord.quantity,
                product_description: product.description,
                warehouse_name: warehouse.name,
                created_at: new Date().toISOString(),
            };
        };

        try {
            return tx ? await operations(tx) : await this.$transaction(operations);
        } catch (error) {
            if (error instanceof NotFoundException || error instanceof BadRequestException || error instanceof InternalServerErrorException) {
                throw error;
            }
            handlePrismaError(error, this.entityNameInventory);
            throw new InternalServerErrorException(`Error en la transacción al crear ${this.entityNameInventory.toLowerCase()} inicial.`);
        }
    }
}