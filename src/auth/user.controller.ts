import {
  Controller,
  Post,
  Body,
  Get,
  Delete,
  Param,
  ParseIntPipe,
  Query,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  ApiQuery,
} from '@nestjs/swagger';
import { Role, User } from '@prisma/client';
import { AuthService } from './auth.service';
import {
  AssignVehiclesToUserDto,
  UserVehicleResponseDto,
} from './dto/';
import { GetUser } from './decorators/get-user.decorator';
import { Auth } from './decorators/auth.decorator';

@ApiTags('🔐 Autenticación/Usuarios')
@Controller('users')
export class UserController {
  constructor(private readonly authService: AuthService) {}

  @Post(':id/vehicles')
  @Auth(
    Role.SUPERADMIN,
    Role.ADMINISTRATIVE,
    Role.BOSSADMINISTRATIVE,
    Role.DRIVERS,
  )
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Asignar vehículos a un usuario',
    description: `🆕 LÓGICA ADITIVA: Asigna uno o más vehículos a un usuario SIN eliminar asignaciones previas.

## Comportamiento Mejorado:

**Asignaciones Aditivas:**
- Si el usuario ya tiene vehículos asignados, los nuevos se AGREGAN a la lista existente
- NO se eliminan ni desactivan las asignaciones previas
- Los vehículos se acumulan progresivamente

**Prevención de Duplicados:**
- Si el vehículo ya está asignado al usuario y activo, NO se duplica
- Se mantiene la fecha de asignación original (\`assigned_at\`)
- Solo se actualizan las notas si son diferentes

**Reactivación Inteligente:**
- Si existe una asignación inactiva, se reactiva en lugar de crear una nueva
- Al reactivar, SÍ se actualiza la fecha de asignación

## Ejemplo:
- Usuario tiene vehículo #1 asignado
- Se envía POST con vehículo #2
- Resultado: Usuario tiene vehículos #1 y #2 asignados`,
  })
  @ApiParam({ name: 'id', description: 'ID del usuario', type: Number })
  @ApiResponse({
    status: 201,
    description: 'Vehículos asignados correctamente de forma aditiva.',
    type: [UserVehicleResponseDto],
  })
  @ApiResponse({
    status: 400,
    description: 'Datos de entrada inválidos o vehículos no encontrados.',
  })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({
    status: 403,
    description: 'Prohibido - El usuario no tiene permisos suficientes.',
  })
  assignVehiclesToUser(
    @Param('id', ParseIntPipe) userId: number,
    @Body(ValidationPipe) dto: AssignVehiclesToUserDto,
    @GetUser() actingUser: User,
  ): Promise<UserVehicleResponseDto[]> {
    return this.authService.assignVehiclesToUser(userId, dto, actingUser);
  }

  @Get(':id/vehicles')
  @Auth(
    Role.SUPERADMIN,
    Role.ADMINISTRATIVE,
    Role.BOSSADMINISTRATIVE,
    Role.DRIVERS,
  )
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Obtener vehículos asignados a un usuario',
    description:
      'Lista todos los vehículos que puede manejar un usuario específico.',
  })
  @ApiParam({ name: 'id', description: 'ID del usuario', type: Number })
  @ApiQuery({
    name: 'activeOnly',
    required: false,
    type: Boolean,
    description: 'Solo mostrar asignaciones activas',
    example: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de vehículos del usuario.',
    type: [UserVehicleResponseDto],
  })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  getUserVehicles(
    @Param('id', ParseIntPipe) userId: number,
    @Query('activeOnly') activeOnly?: boolean,
  ): Promise<UserVehicleResponseDto[]> {
    return this.authService.getUserVehicles(userId, activeOnly ?? true);
  }

  @Delete(':userId/vehicles/:vehicleId')
  @Auth(
    Role.SUPERADMIN,
    Role.ADMINISTRATIVE,
    Role.BOSSADMINISTRATIVE,
    Role.DRIVERS,
  )
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Remover vehículo de un usuario',
    description:
      'Desactiva la asignación de un vehículo específico a un usuario.',
  })
  @ApiParam({ name: 'userId', description: 'ID del usuario', type: Number })
  @ApiParam({ name: 'vehicleId', description: 'ID del vehículo', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Vehículo removido correctamente.',
    schema: {
      properties: {
        message: { type: 'string' },
        removed: { type: 'boolean' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Usuario o asignación no encontrada.',
  })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({
    status: 403,
    description: 'Prohibido - El usuario no tiene rol de SUPERADMIN.',
  })
  removeVehicleFromUser(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('vehicleId', ParseIntPipe) vehicleId: number,
    @GetUser() actingUser: User,
  ): Promise<{ message: string; removed: boolean }> {
    return this.authService.removeVehicleFromUser(userId, vehicleId, actingUser);
  }
}
