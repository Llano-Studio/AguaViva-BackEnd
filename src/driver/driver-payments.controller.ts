import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role, User } from '@prisma/client';
import { Auth } from '../auth/decorators/auth.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { FormDataBody } from '../common/decorators/form-data-body.decorator';
import { CleanupFileOnErrorInterceptor } from '../common/interceptors/validate-before-upload.interceptor';
import { fileUploadConfigs } from '../common/utils/file-upload.util';
import { DriverPaymentsService } from './driver-payments.service';
import type { UploadedProofFile } from './driver-payments.service';
import {
  DriverPaymentOptionsDto,
  DriverPaymentProofDto,
  DriverPaymentResultDto,
  RegisterDeliveryPaymentDto,
  RegisterPaymentProofBodyDto,
} from './dto';

@ApiTags('🚚 Chofer - Cobros')
@ApiBearerAuth()
@Auth(Role.DRIVERS)
@Controller('driver')
export class DriverPaymentsController {
  constructor(private readonly driverPaymentsService: DriverPaymentsService) {}

  @Get('payment-options')
  @ApiOperation({
    summary: 'Métodos de pago habilitados y datos de transferencia',
    description:
      'Devuelve los métodos de pago que el chofer puede usar en la calle y, si están configurados, los datos de transferencia de la empresa. Indica qué métodos exigen referencia y cuáles exigen el efectivo recibido.',
  })
  @ApiResponse({ status: 200, type: DriverPaymentOptionsDto })
  getPaymentOptions(): Promise<DriverPaymentOptionsDto> {
    return this.driverPaymentsService.getPaymentOptions();
  }

  @Post('deliveries/:detailId/payments')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Registrar el cobro de la parada actual',
    description:
      'Registra el cobro de la parada actual imputándolo a su obligación (pedido, compra puntual o ciclo). Para efectivo se exige el efectivo recibido y el vuelto se calcula en el servidor. La clave de idempotencia evita duplicar el cobro ante reintentos: la misma clave con otro contenido se rechaza.',
  })
  @ApiParam({ name: 'detailId', type: Number })
  @ApiResponse({ status: 200, type: DriverPaymentResultDto })
  @ApiResponse({ status: 404, description: 'No existe o no es del chofer' })
  @ApiResponse({
    status: 409,
    description:
      'Parada resuelta, hoja fuera de curso, no es la parada actual, monto inválido o clave de idempotencia reutilizada',
  })
  registerPayment(
    @GetUser() user: User,
    @Param('detailId', ParseIntPipe) detailId: number,
    @Body() dto: RegisterDeliveryPaymentDto,
  ): Promise<DriverPaymentResultDto> {
    return this.driverPaymentsService.registerPayment(user.id, detailId, dto);
  }

  @Post('deliveries/:detailId/payment-proofs')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', fileUploadConfigs.paymentProofs),
    CleanupFileOnErrorInterceptor,
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Comprobante del cobro (imagen o PDF) con su tipo',
    type: RegisterPaymentProofBodyDto,
  })
  @ApiOperation({
    summary: 'Adjuntar un comprobante a la parada',
    description:
      'Carga un comprobante (foto de la transferencia, recibo, etc.) asociado a la parada. Es evidencia y no acredita el pago por sí solo. El tipo y tamaño del archivo se validan al recibirlo.',
  })
  @ApiParam({ name: 'detailId', type: Number })
  @ApiResponse({ status: 201, type: DriverPaymentProofDto })
  @ApiResponse({ status: 404, description: 'No existe o no es del chofer' })
  @ApiResponse({
    status: 409,
    description: 'Parada resuelta o hoja fuera de curso',
  })
  registerProof(
    @GetUser() user: User,
    @Param('detailId', ParseIntPipe) detailId: number,
    @FormDataBody(RegisterPaymentProofBodyDto) dto: RegisterPaymentProofBodyDto,
    @UploadedFile() file?: UploadedProofFile,
  ): Promise<DriverPaymentProofDto> {
    return this.driverPaymentsService.registerProof(
      user.id,
      detailId,
      file,
      dto,
    );
  }

  @Get('deliveries/:detailId/payment-proofs')
  @ApiOperation({
    summary: 'Comprobantes cargados para una parada',
    description:
      'Lista los comprobantes activos asociados a la parada del chofer.',
  })
  @ApiParam({ name: 'detailId', type: Number })
  @ApiResponse({ status: 200, type: [DriverPaymentProofDto] })
  @ApiResponse({ status: 404, description: 'No existe o no es del chofer' })
  findProofs(
    @GetUser() user: User,
    @Param('detailId', ParseIntPipe) detailId: number,
  ): Promise<DriverPaymentProofDto[]> {
    return this.driverPaymentsService.findProofsForDelivery(user.id, detailId);
  }
}
