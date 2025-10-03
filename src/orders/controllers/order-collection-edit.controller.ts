import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseIntPipe,
  ValidationPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiProperty,
} from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString, IsDateString } from 'class-validator';
import {
  OrderCollectionEditService,
  CollectionItemDto,
  AddCollectionResult,
} from '../../common/services/order-collection-edit.service';
import { Role } from '@prisma/client';
import { Auth } from '../../auth/decorators/auth.decorator';
import { ApiBearerAuth } from '@nestjs/swagger';
export class AddCollectionToOrderDto {
  @ApiProperty({
    description: 'ID del ciclo de suscripción',
    example: 45,
    type: 'number',
  })
  @IsNotEmpty()
  @IsNumber()
  cycle_id: number;

  @ApiProperty({
    description: 'ID de la suscripción',
    example: 12,
    type: 'number',
  })
  @IsNotEmpty()
  @IsNumber()
  subscription_id: number;

  @ApiProperty({
    description: 'ID del cliente',
    example: 1,
    type: 'number',
  })
  @IsNotEmpty()
  @IsNumber()
  customer_id: number;

  @ApiProperty({
    description: 'Saldo pendiente de pago',
    example: 250.0,
    type: 'number',
  })
  @IsNotEmpty()
  @IsNumber()
  pending_balance: number;

  @ApiProperty({
    description: 'Fecha de vencimiento del pago en formato ISO',
    example: '2024-01-10',
    type: 'string',
    format: 'date',
  })
  @IsNotEmpty()
  @IsDateString()
  payment_due_date: string;

  @ApiProperty({
    description: 'Nombre del plan de suscripción',
    example: 'Plan Familiar',
    type: 'string',
  })
  @IsNotEmpty()
  @IsString()
  subscription_plan_name: string;

  @ApiProperty({
    description: 'Nombre completo del cliente',
    example: 'Juan Pérez',
    type: 'string',
  })
  @IsNotEmpty()
  @IsString()
  customer_name: string;
}

@ApiTags('Edición de Pedidos - Cobranzas')
@Controller('orders/collection-edit')
@ApiBearerAuth()
@Auth(Role.ADMINISTRATIVE, Role.SUPERADMIN, Role.BOSSADMINISTRATIVE)
export class OrderCollectionEditController {
  constructor(
    private readonly orderCollectionEditService: OrderCollectionEditService,
  ) {}

  @Get('existing-orders')
  @ApiOperation({
    summary: 'Obtener pedidos existentes editables para agregar cobranzas',
    description: `Busca pedidos existentes en una fecha específica que pueden ser modificados para incluir cobranzas adicionales.

## 📝 EDICIÓN DE PEDIDOS EXISTENTES

**Funcionalidad Principal:**
- Identifica pedidos activos en fecha específica
- Permite agregar cobranzas sin crear nuevos pedidos
- Optimiza rutas consolidando entregas y cobranzas
- Mantiene eficiencia operativa

## 🎯 CRITERIOS DE ELEGIBILIDAD

**Pedidos Editables:**
- Estado: PENDING, CONFIRMED, IN_PREPARATION
- Fecha de entrega coincidente
- Mismo cliente objetivo
- Sin conflictos de programación

## 💡 BENEFICIOS OPERATIVOS

- **Consolidación de Rutas**: Menos viajes por cliente
- **Eficiencia Logística**: Optimización de recursos
- **Experiencia del Cliente**: Menos interrupciones
- **Reducción de Costos**: Menor uso de vehículos`,
  })
  @ApiQuery({
    name: 'date',
    description: 'Fecha en formato YYYY-MM-DD',
    example: '2024-01-15',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de pedidos editables encontrados',
    schema: {
      type: 'object',
      properties: {
        total_orders: { type: 'number', example: 3 },
        orders_by_customer: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              customer_id: { type: 'number', example: 1 },
              customer_name: { type: 'string', example: 'Juan Pérez' },
              order_id: { type: 'number', example: 123 },
              order_total: { type: 'string', example: '150.00' },
            },
          },
        },
      },
    },
  })
  async getEditableOrdersForDate(@Query('date') date: string) {
    const targetDate = new Date(date);
    return await this.orderCollectionEditService.getEditableOrdersSummary(
      targetDate,
    );
  }

  @Get('customer/:customerId/existing-order')
  @ApiOperation({
    summary: 'Verificar si un cliente tiene pedido existente',
    description:
      'Verifica si un cliente específico tiene un pedido existente para una fecha determinada',
  })
  @ApiParam({
    name: 'customerId',
    description: 'ID del cliente',
    example: 1,
  })
  @ApiQuery({
    name: 'date',
    description: 'Fecha en formato YYYY-MM-DD',
    example: '2024-01-15',
  })
  @ApiResponse({
    status: 200,
    description: 'Información del pedido existente o null si no existe',
    schema: {
      oneOf: [
        {
          type: 'object',
          properties: {
            order_id: { type: 'number', example: 123 },
            order_date: { type: 'string', example: '2024-01-15T10:00:00Z' },
            total_amount: { type: 'string', example: '150.00' },
            status: { type: 'string', example: 'PENDING' },
            customer: {
              type: 'object',
              properties: {
                person_id: { type: 'number', example: 1 },
                first_name: { type: 'string', example: 'Juan' },
                last_name: { type: 'string', example: 'Pérez' },
              },
            },
          },
        },
        { type: 'null' },
      ],
    },
  })
  async findExistingOrderForCustomer(
    @Param('customerId', ParseIntPipe) customerId: number,
    @Query('date') date: string,
  ) {
    const targetDate = new Date(date);
    return await this.orderCollectionEditService.findExistingOrderForDate(
      customerId,
      targetDate,
    );
  }

  @Post(':orderId/add-collection')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Agregar cobranza a pedido existente',
    description:
      'Agrega información de cobranza a un pedido existente mediante notas',
  })
  @ApiParam({
    name: 'orderId',
    description: 'ID del pedido al que se agregará la cobranza',
    example: 123,
  })
  @ApiBody({
    description: 'Datos de la cobranza a agregar',
    type: AddCollectionToOrderDto,
    examples: {
      cobranzaBasica: {
        summary: 'Agregar cobranza básica',
        value: {
          cycle_id: 45,
          subscription_id: 12,
          customer_id: 1,
          pending_balance: 250.0,
          payment_due_date: '2024-01-10',
          subscription_plan_name: 'Plan Familiar',
          customer_name: 'Juan Pérez',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Cobranza agregada exitosamente',
    schema: {
      type: 'object',
      properties: {
        order_id: { type: 'number', example: 123 },
        collection_added: { type: 'boolean', example: true },
        collection_amount: { type: 'number', example: 250.0 },
        message: {
          type: 'string',
          example: 'Cobranza de $250.00 agregada al pedido 123',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Error en los datos o estado del pedido no permite edición',
  })
  @ApiResponse({
    status: 404,
    description: 'Pedido no encontrado',
  })
  async addCollectionToOrder(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Body(ValidationPipe) collectionData: AddCollectionToOrderDto,
  ): Promise<AddCollectionResult> {
    const collectionItem: CollectionItemDto = {
      ...collectionData,
      payment_due_date: new Date(collectionData.payment_due_date),
    };

    return await this.orderCollectionEditService.addCollectionToExistingOrder(
      orderId,
      collectionItem,
    );
  }

  @Get(':orderId/has-collection/:cycleId')
  @ApiOperation({
    summary: 'Verificar si pedido ya tiene cobranza para un ciclo',
    description:
      'Verifica si un pedido ya tiene información de cobranza para un ciclo específico',
  })
  @ApiParam({
    name: 'orderId',
    description: 'ID del pedido',
    example: 123,
  })
  @ApiParam({
    name: 'cycleId',
    description: 'ID del ciclo de suscripción',
    example: 45,
  })
  @ApiResponse({
    status: 200,
    description: 'Resultado de la verificación',
    schema: {
      type: 'object',
      properties: {
        order_id: { type: 'number', example: 123 },
        cycle_id: { type: 'number', example: 45 },
        has_collection: { type: 'boolean', example: false },
      },
    },
  })
  async checkCollectionForCycle(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Param('cycleId', ParseIntPipe) cycleId: number,
  ) {
    const hasCollection =
      await this.orderCollectionEditService.hasCollectionForCycle(
        orderId,
        cycleId,
      );

    return {
      order_id: orderId,
      cycle_id: cycleId,
      has_collection: hasCollection,
    };
  }
}
