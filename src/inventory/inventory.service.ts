import { Injectable, InternalServerErrorException, NotFoundException, OnModuleInit, BadRequestException } from '@nestjs/common';
import { PrismaClient, Prisma, stock_movement as PrismaStockMovement, movement_type as MovementTypePrisma } from '@prisma/client';
import { CreateStockMovementDto } from './dto/create-stock-movement.dto';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class InventoryService extends PrismaClient implements OnModuleInit {

    // Es VITAL que estos códigos coincidan con los de tu tabla `movement_type`
    private movementTypeCodes = {
        INGRESO_PRODUCCION: 'INGRESO_PRODUCCION',
        INGRESO_COMPRA_EXTERNA: 'INGRESO_COMPRA_EXTERNA',
        INGRESO_DEVOLUCION_COMODATO: 'INGRESO_DEVOLUCION_COMODATO',
        AJUSTE_POSITIVO: 'AJUSTE_POSITIVO',
        TRANSFERENCIA_ENTRADA: 'TRANSFERENCIA_ENTRADA', // Entrada a un almacén específico

        EGRESO_VENTA_PRODUCTO: 'EGRESO_VENTA_PRODUCTO',
        EGRESO_ENTREGA_COMODATO: 'EGRESO_ENTREGA_COMODATO',
        AJUSTE_NEGATIVO: 'AJUSTE_NEGATIVO',
        TRANSFERENCIA_SALIDA: 'TRANSFERENCIA_SALIDA', // Salida de un almacén específico
    };

    // DEBES AJUSTAR ESTOS CÓDIGOS A LOS VALORES REALES DE TU BASE DE DATOS
    private entryMovementTypeCodes = ['ENTRADA_COMPRA', 'AJUSTE_ENTRADA', 'DEVOLUCION_CLIENTE'];
    private exitMovementTypeCodes = ['SALIDA_VENTA', 'AJUSTE_SALIDA', 'MERMA', 'TRANSFER_SALIDA'];
    // No es necesario para getProductStock, pero útil para la creación de movimientos si se quiere
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
                throw new NotFoundException(`Tipo de movimiento con código '${code}' no encontrado.`);
            }
            return movementType.movement_type_id;
        } catch (error) {
            if (error instanceof NotFoundException) throw error;
            console.error(`Error buscando movement_type_id para el código ${code}:`, error);
            throw new InternalServerErrorException('Error al obtener el ID del tipo de movimiento.');
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
            const product = await prisma.product.findUnique(
                {
                    where: { product_id: productId }
                });

            if (!product) {
                throw new NotFoundException(`Producto con ID ${productId} no encontrado.`);
            }

            const queryWhere: Prisma.stock_movementWhereInput = { product_id: productId };

            if (warehouseId) {
                const warehouse = await prisma.warehouse.findUnique(
                    {
                        where: {
                            warehouse_id: warehouseId
                        }
                    });
                if (!warehouse) {
                    throw new NotFoundException(`Almacén con ID ${warehouseId} no encontrado.`);
                }
                queryWhere.OR = [
                    { destination_warehouse_id: warehouseId },
                    { source_warehouse_id: warehouseId },
                ];
            }
            // Si no se especifica warehouseId, queryWhere solo tiene product_id, 
            // por lo que se considerarán todos los movimientos de ese producto en el sistema.

            const stockMovements = await prisma.stock_movement.findMany({
                where: queryWhere,
                include: {
                    movement_type: true,
                },
            });

            let totalStock = new Decimal(0);

            for (const movement of stockMovements) {
                const quantity = new Decimal(movement.quantity);
                const movementCode = movement.movement_type.code.toUpperCase();

                if (this.entryMovementTypeCodes.includes(movementCode)) {
                    if (warehouseId === undefined || movement.destination_warehouse_id === warehouseId) {
                        totalStock = totalStock.plus(quantity);
                    }
                } else if (this.exitMovementTypeCodes.includes(movementCode)) {
                    if (warehouseId === undefined || movement.source_warehouse_id === warehouseId) {
                        totalStock = totalStock.minus(quantity);
                    }
                }
            }
            return totalStock.toNumber();
        } catch (error) {
            if (error instanceof NotFoundException) throw error;
            console.error(`Error calculando stock para producto ${productId} (almacén ${warehouseId || 'todos'}):`, error);
            throw new InternalServerErrorException('Error al calcular el stock del producto.');
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
                throw new NotFoundException(`Producto con ID ${product_id} no encontrado.`);
            }

            const movementType = await prismaClient.movement_type.findUnique({ where: { movement_type_id } });
            if (!movementType) {
                throw new NotFoundException(`Tipo de movimiento con ID ${movement_type_id} no encontrado.`);
            }

            // 2. Lógica para determinar la naturaleza del movimiento y validar almacenes
            const movementTypeCodeUpper = movementType.code.toUpperCase();
            const isEntry = this.entryMovementTypeCodes.includes(movementTypeCodeUpper);
            const isExit = this.exitMovementTypeCodes.includes(movementTypeCodeUpper);

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
            } else if (this.transferMovementTypeCodes.includes(movementTypeCodeUpper)) {
                if (!source_warehouse_id || !destination_warehouse_id) {
                    throw new BadRequestException('Para una transferencia, se requieren source_warehouse_id y destination_warehouse_id.');
                }
                if (source_warehouse_id === destination_warehouse_id) {
                    throw new BadRequestException('El almacén de origen y destino no pueden ser el mismo para una transferencia.');
                }
            } else {
                if (!source_warehouse_id && !destination_warehouse_id) {
                    console.warn(`Tipo de movimiento '${movementType.code}' no es entrada/salida/transferencia clara y no se especificaron almacenes. El inventario de almacén no se actualizará.`);
                }
            }

            if (effectiveSourceWarehouseId) {
                const sourceWarehouse = await prismaClient.warehouse.findUnique({ where: { warehouse_id: effectiveSourceWarehouseId } });
                if (!sourceWarehouse) throw new NotFoundException(`Almacén de origen con ID ${effectiveSourceWarehouseId} no encontrado.`);
            }
            if (effectiveDestinationWarehouseId) {
                const destWarehouse = await prismaClient.warehouse.findUnique({ where: { warehouse_id: effectiveDestinationWarehouseId } });
                if (!destWarehouse) throw new NotFoundException(`Almacén de destino con ID ${effectiveDestinationWarehouseId} no encontrado.`);
            }

            const stockMovement = await prismaClient.stock_movement.create({
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

            if (effectiveSourceWarehouseId && (isExit || this.transferMovementTypeCodes.includes(movementTypeCodeUpper))) {
                const currentInventorySource = await prismaClient.inventory.findUnique({
                    where: { warehouse_id_product_id: { warehouse_id: effectiveSourceWarehouseId, product_id } },
                });
                const newQuantitySourceCalc = new Decimal(currentInventorySource?.quantity || 0).minus(quantity);
                if (currentInventorySource) {
                    if (newQuantitySourceCalc.isNegative() && !product.is_returnable) {
                        throw new BadRequestException(
                            `Stock insuficiente en almacén de origen ID ${effectiveSourceWarehouseId} para producto ID ${product_id}. Cantidad actual: ${currentInventorySource.quantity}, Solicitado deducir: ${quantity}`
                        );
                    }
                    await prismaClient.inventory.update({
                        where: { warehouse_id_product_id: { warehouse_id: effectiveSourceWarehouseId, product_id } },
                        data: { quantity: newQuantitySourceCalc.toNumber() },
                    });
                } else {
                    if (newQuantitySourceCalc.isNegative() && !product.is_returnable) {
                        throw new BadRequestException(
                            `Intento de salida de producto ID ${product_id} de almacén ID ${effectiveSourceWarehouseId} donde no hay stock registrado (resultaría en stock negativo).`
                        );
                    }
                    await prismaClient.inventory.create({
                        data: { product_id, warehouse_id: effectiveSourceWarehouseId, quantity: newQuantitySourceCalc.toNumber() },
                    });
                }
            }

            if (effectiveDestinationWarehouseId && (isEntry || this.transferMovementTypeCodes.includes(movementTypeCodeUpper))) {
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
            return stockMovement;
        };

        if (tx) {
            return operations(tx);
        } else {
            return this.$transaction(operations);
        }
    }

} 