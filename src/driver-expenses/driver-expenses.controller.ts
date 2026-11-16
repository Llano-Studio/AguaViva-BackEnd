import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role, User } from '@prisma/client';
import { Auth } from '../auth/decorators/auth.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { DriverExpensesService } from './driver-expenses.service';
import {
  CreateDriverExpenseDto,
  DriverExpenseDto,
  DriverExpenseListDto,
  FilterDriverExpensesDto,
  VoidDriverExpenseDto,
} from './dto/driver-expense.dto';

@ApiTags('🚚 Chofer - Gastos')
@ApiBearerAuth()
@Auth(Role.DRIVERS)
@Controller('driver/route-sheets/:id/expenses')
export class DriverExpensesController {
  constructor(private readonly driverExpensesService: DriverExpensesService) {}

  @Post()
  @ApiOperation({
    summary: 'Registrar un gasto de la hoja de ruta',
    description:
      'Combustible, gomería, etc. Se descuenta del efectivo a rendir. Solo mientras la hoja no esté rendida. Idempotente por `idempotency_key`.',
  })
  @ApiParam({ name: 'id', description: 'ID de la hoja de ruta', type: Number })
  @ApiResponse({ status: 201, type: DriverExpenseDto })
  @ApiResponse({ status: 409, description: 'La hoja ya fue rendida' })
  create(
    @GetUser() user: User,
    @Param('id', ParseIntPipe) routeSheetId: number,
    @Body() dto: CreateDriverExpenseDto,
  ): Promise<DriverExpenseDto> {
    return this.driverExpensesService.create(user.id, routeSheetId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Gastos de la hoja de ruta' })
  @ApiParam({ name: 'id', description: 'ID de la hoja de ruta', type: Number })
  @ApiResponse({ status: 200, type: DriverExpenseListDto })
  list(
    @GetUser() user: User,
    @Param('id', ParseIntPipe) routeSheetId: number,
  ): Promise<DriverExpenseListDto> {
    return this.driverExpensesService.listForSheet(user.id, routeSheetId);
  }

  @Post(':expenseId/void')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Anular un gasto',
    description: 'Solo mientras la hoja no esté rendida.',
  })
  @ApiParam({ name: 'id', description: 'ID de la hoja de ruta', type: Number })
  @ApiParam({ name: 'expenseId', type: Number })
  @ApiResponse({ status: 200, type: DriverExpenseDto })
  @ApiResponse({
    status: 409,
    description: 'Ya anulado o la hoja ya fue rendida',
  })
  void(
    @GetUser() user: User,
    @Param('id', ParseIntPipe) routeSheetId: number,
    @Param('expenseId', ParseIntPipe) expenseId: number,
    @Body() dto: VoidDriverExpenseDto,
  ): Promise<DriverExpenseDto> {
    return this.driverExpensesService.void(
      user.id,
      routeSheetId,
      expenseId,
      dto,
    );
  }
}

@ApiTags('💰 Administración - Gastos de choferes')
@ApiBearerAuth()
@Auth(Role.ADMINISTRATIVE, Role.SUPERADMIN, Role.BOSSADMINISTRATIVE)
@Controller('driver-expenses')
export class DriverExpensesAdminController {
  constructor(private readonly driverExpensesService: DriverExpensesService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar gastos de choferes',
    description: 'Filtra por chofer, hoja de ruta, rubro y fecha de carga.',
  })
  @ApiResponse({ status: 200, type: DriverExpenseListDto })
  findAll(
    @Query() filters: FilterDriverExpensesDto,
  ): Promise<DriverExpenseListDto> {
    return this.driverExpensesService.findAll(filters);
  }
}
