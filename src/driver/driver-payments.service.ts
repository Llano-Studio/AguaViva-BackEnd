import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import {
  CustomerCurrentAccountType,
  Prisma,
  RouteSheetExecutionStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DriverCreditService } from '../driver-credit/driver-credit.service';
import {
  DELIVERY_SEQUENCE_ORDER_BY,
  RESOLVED_DELIVERY_STATUSES,
  isCurrentDelivery,
} from '../route-sheet/delivery-locks';
import { formatBATimestampISO } from '../common/utils/date.utils';
import { buildImageUrl } from '../common/utils/file-upload.util';
import {
  CombinedPaymentLineResultDto,
  DriverCombinedPaymentResultDto,
  DriverDeliveryPaymentOptionsDto,
  DriverPaymentOptionDto,
  DriverPaymentOptionsDto,
  DriverPaymentProofDto,
  DriverPaymentProofKind,
  DriverPaymentResultDto,
  DriverTransferDataDto,
  RegisterCombinedPaymentDto,
  RegisterDeliveryPaymentDto,
  RegisterPaymentProofBodyDto,
} from './dto';
import {
  DriverRouteSheetsService,
  buildDeliveryVersion,
} from './driver-route-sheets.service';

const CASH_METHOD_CODE = 'EFECTIVO';
const TRANSFER_METHOD_CODE = 'TRANSFERENCIA';
const MERCADOPAGO_METHOD_CODE = 'MERCADOPAGO';
/** El cliente paga con la cuenta corriente del chofer: la deuda pasa al chofer. */
const DRIVER_ACCOUNT_METHOD_CODE = 'CTA_CTE_CHOFER';
/** El cliente deja la deuda en su cuenta corriente propia: no hay cobro. */
const CUSTOMER_ACCOUNT_METHOD_CODE = 'CTA_CTE_CLIENTE';

/** Cuenta corriente que puede usar el cliente según su configuración. */
const ACCOUNT_METHOD_BY_TYPE: Record<
  CustomerCurrentAccountType,
  string | null
> = {
  [CustomerCurrentAccountType.NONE]: null,
  [CustomerCurrentAccountType.OWN]: CUSTOMER_ACCOUNT_METHOD_CODE,
  [CustomerCurrentAccountType.DRIVER]: DRIVER_ACCOUNT_METHOD_CODE,
};

/**
 * Métodos con los que el chofer cobra en la calle. MercadoPago queda oculto
 * hasta que exista la integración (`MERCADOPAGO_ENABLED=true` lo habilita).
 */
function baseMethodCodes(): string[] {
  const codes = [CASH_METHOD_CODE, TRANSFER_METHOD_CODE];
  if (process.env.MERCADOPAGO_ENABLED === 'true') {
    codes.push(MERCADOPAGO_METHOD_CODE);
  }
  return codes;
}

/** Datos de una parte del cobro ya validada, lista para grabarse. */
interface PreparedLine {
  index: number;
  methodId: number;
  methodCode: string;
  amount: Prisma.Decimal;
  amountReceived: Prisma.Decimal;
  changeAmount: Prisma.Decimal;
  reference: string | null;
  notes: string | null;
}

/** Archivo ya validado por el multer, tal como llega al servicio. */
export interface UploadedProofFile {
  filename: string;
  mimetype: string;
  size: number;
}

/** Obligación que cubre un cobro en ruta. */
interface PaymentObligation {
  type: 'ORDER' | 'ONE_OFF' | 'COLLECTION';
  referenceId: number;
  customerId: number;
  /** Deuda pendiente: máximo cobrable de una vez. */
  debt: Prisma.Decimal;
}

const PAYMENT_DETAIL_INCLUDE = {
  route_sheet: {
    select: {
      route_sheet_id: true,
      driver_id: true,
      is_active: true,
      execution_status: true,
    },
  },
  order_header: {
    select: {
      order_id: true,
      status: true,
      customer_id: true,
      total_amount: true,
      paid_amount: true,
    },
  },
  one_off_purchase: {
    select: {
      purchase_id: true,
      person_id: true,
      total_amount: true,
      paid_amount: true,
    },
  },
  one_off_purchase_header: {
    select: {
      purchase_header_id: true,
      person_id: true,
      total_amount: true,
      paid_amount: true,
    },
  },
  cycle_payment: {
    select: {
      payment_id: true,
      cycle_id: true,
      subscription_cycle: {
        select: {
          total_amount: true,
          paid_amount: true,
          pending_balance: true,
          customer_subscription: { select: { customer_id: true } },
        },
      },
    },
  },
} satisfies Prisma.route_sheet_detailInclude;

type PaymentDetailRow = Prisma.route_sheet_detailGetPayload<{
  include: typeof PAYMENT_DETAIL_INCLUDE;
}>;

const PAYMENT_TRANSACTION_SELECT = {
  transaction_id: true,
  transaction_date: true,
  transaction_amount: true,
  amount_received: true,
  change_amount: true,
  document_number: true,
  receipt_number: true,
  idempotency_hash: true,
  payment_method: { select: { code: true } },
} satisfies Prisma.payment_transactionSelect;

type PaymentTransactionRow = Prisma.payment_transactionGetPayload<{
  select: typeof PAYMENT_TRANSACTION_SELECT;
}>;

@Injectable()
export class DriverPaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly driverRouteSheetsService: DriverRouteSheetsService,
    private readonly driverCreditService: DriverCreditService,
  ) {}

  /**
   * Métodos de pago generales y datos de transferencia de la empresa. No
   * incluye las cuentas corrientes: dependen del cliente (ver la variante por
   * parada).
   */
  async getPaymentOptions(): Promise<DriverPaymentOptionsDto> {
    return new DriverPaymentOptionsDto({
      methods: await this.listMethods(baseMethodCodes()),
      transfer: this.getTransferData(),
    });
  }

  /**
   * Métodos de pago para una parada: los generales más la única cuenta
   * corriente que le corresponde al cliente (la propia o la del chofer).
   */
  async getPaymentOptionsForDelivery(
    driverId: number,
    detailId: number,
  ): Promise<DriverDeliveryPaymentOptionsDto> {
    const detail = await this.loadPaymentDetail(driverId, detailId);
    const obligation = this.resolveObligation(detail);
    const accountType = await this.customerAccountType(obligation.customerId);
    const codes = baseMethodCodes();
    const accountCode = ACCOUNT_METHOD_BY_TYPE[accountType];
    if (accountCode) codes.push(accountCode);
    return new DriverDeliveryPaymentOptionsDto({
      methods: await this.listMethods(codes),
      transfer: this.getTransferData(),
      customer_id: obligation.customerId,
      current_account_type: accountType,
      pending_amount: obligation.debt.toFixed(2),
    });
  }

  /**
   * Registra el cobro de la parada actual. El monto se imputa a la obligación
   * de la parada (pedido, compra puntual o ciclo), nunca se reparte a ciegas.
   * Para efectivo se exige el efectivo recibido y se calcula el vuelto.
   * La clave de idempotencia evita duplicar el cobro ante reintentos.
   */
  async registerPayment(
    driverId: number,
    detailId: number,
    dto: RegisterDeliveryPaymentDto,
  ): Promise<DriverPaymentResultDto> {
    const detail = await this.loadPaymentDetail(driverId, detailId);
    const sheet = detail.route_sheet;
    if (!sheet) {
      throw new NotFoundException(`Parada ${detailId} no encontrada`);
    }

    if (
      detail.delivery_status &&
      RESOLVED_DELIVERY_STATUSES.has(detail.delivery_status)
    ) {
      throw new ConflictException('La parada ya está resuelta');
    }
    await this.assertIsCurrentStop(
      sheet.route_sheet_id,
      detailId,
      sheet.execution_status,
    );

    if (dto.version && dto.version !== buildDeliveryVersion(detail)) {
      throw new ConflictException(
        'La parada cambió desde la última consulta. Actualizá e intentá de nuevo.',
      );
    }

    const method = await this.prisma.payment_method.findUnique({
      where: { payment_method_id: dto.payment_method_id },
    });
    if (!method) {
      throw new BadRequestException(
        `El método de pago ${dto.payment_method_id} no es válido`,
      );
    }
    if (method.code === CUSTOMER_ACCOUNT_METHOD_CODE) {
      throw new BadRequestException(
        'La cuenta corriente del cliente se registra con el cobro combinado (POST /driver/deliveries/:detailId/payments/combined)',
      );
    }

    const obligation = this.resolveObligation(detail);
    this.assertMethodAllowed(
      method.code,
      await this.customerAccountType(obligation.customerId),
    );
    const amount = new Prisma.Decimal(dto.amount);
    if (obligation.debt.lte(0) || amount.gt(obligation.debt)) {
      throw new ConflictException(
        `El monto a cobrar debe ser mayor a 0 y no superar el saldo pendiente (${obligation.debt.toFixed(2)})`,
      );
    }

    const { amountReceived, changeAmount } = this.resolveCash(
      method.code,
      amount,
      dto.amount_received,
    );

    const idempotencyHash = this.hashRequest({
      route_sheet_detail_id: detailId,
      obligation,
      amount,
      payment_method_id: dto.payment_method_id,
      transaction_reference: dto.transaction_reference ?? null,
      amount_received: amountReceived,
    });

    const replay = await this.findReplay(dto.idempotency_key, idempotencyHash);
    if (replay) {
      return this.buildResult(
        replay,
        true,
        driverId,
        sheet.route_sheet_id,
        detailId,
      );
    }

    let created: PaymentTransactionRow;
    try {
      created = await this.prisma.$transaction((tx) =>
        this.recordLine(
          tx,
          {
            driverId,
            routeSheetId: sheet.route_sheet_id,
            detailId,
            obligation,
            previousDebt: obligation.debt,
            idempotencyKey: dto.idempotency_key,
            idempotencyHash,
          },
          {
            index: 0,
            methodId: dto.payment_method_id,
            methodCode: method.code,
            amount,
            amountReceived,
            changeAmount,
            reference: dto.transaction_reference ?? null,
            notes: dto.notes ?? null,
          },
        ),
      );
    } catch (error) {
      // Carrera de reintentos: otra petición creó la misma clave primero.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const raced = await this.findReplay(
          dto.idempotency_key,
          idempotencyHash,
        );
        if (raced) {
          return this.buildResult(
            raced,
            true,
            driverId,
            sheet.route_sheet_id,
            detailId,
          );
        }
        throw new ConflictException(
          'La clave de idempotencia ya fue usada con otro contenido',
        );
      }
      throw error;
    }

    return this.buildResult(
      created,
      false,
      driverId,
      sheet.route_sheet_id,
      detailId,
    );
  }

  /**
   * Cobro combinado de la parada actual: varios métodos en una sola operación
   * (por ejemplo, mitad en efectivo, una parte por transferencia y el resto a
   * cuenta corriente). Se graba todo o nada y es idempotente por
   * `idempotency_key`. Lo que va a la cuenta corriente del cliente no genera
   * cobro: la parada queda con ese saldo pendiente.
   */
  async registerCombinedPayment(
    driverId: number,
    detailId: number,
    dto: RegisterCombinedPaymentDto,
  ): Promise<DriverCombinedPaymentResultDto> {
    const detail = await this.loadPaymentDetail(driverId, detailId);
    const sheet = detail.route_sheet;
    const obligation = this.resolveObligation(detail);

    const methodIds = dto.payments.map((line) => line.payment_method_id);
    if (new Set(methodIds).size !== methodIds.length) {
      throw new BadRequestException(
        'Cada método de pago puede aparecer una sola vez en el cobro',
      );
    }
    const methods = await this.prisma.payment_method.findMany({
      where: { payment_method_id: { in: methodIds } },
    });
    const methodById = new Map(methods.map((m) => [m.payment_method_id, m]));
    const accountType = await this.customerAccountType(obligation.customerId);

    const lines: PreparedLine[] = dto.payments.map((line, index) => {
      const method = methodById.get(line.payment_method_id);
      if (!method) {
        throw new BadRequestException(
          `El método de pago ${line.payment_method_id} no es válido`,
        );
      }
      this.assertMethodAllowed(method.code, accountType);
      const amount = new Prisma.Decimal(line.amount);
      const { amountReceived, changeAmount } = this.resolveCash(
        method.code,
        amount,
        line.amount_received,
      );
      return {
        index,
        methodId: method.payment_method_id,
        methodCode: method.code,
        amount,
        amountReceived,
        changeAmount,
        reference: line.transaction_reference ?? null,
        notes: line.notes ?? null,
      };
    });

    const idempotencyHash = this.hashCombined(detailId, obligation, lines);
    const replay = await this.findCombinedReplay(
      dto.idempotency_key,
      idempotencyHash,
    );
    if (replay) {
      return this.buildCombinedResult(
        replay,
        true,
        driverId,
        sheet.route_sheet_id,
        detailId,
      );
    }

    if (
      detail.delivery_status &&
      RESOLVED_DELIVERY_STATUSES.has(detail.delivery_status)
    ) {
      throw new ConflictException('La parada ya está resuelta');
    }
    await this.assertIsCurrentStop(
      sheet.route_sheet_id,
      detailId,
      sheet.execution_status,
    );
    if (dto.version && dto.version !== buildDeliveryVersion(detail)) {
      throw new ConflictException(
        'La parada cambió desde la última consulta. Actualizá e intentá de nuevo.',
      );
    }

    const total = lines.reduce(
      (sum, line) => sum.plus(line.amount),
      new Prisma.Decimal(0),
    );
    if (obligation.debt.lte(0) || total.gt(obligation.debt)) {
      throw new ConflictException(
        `La suma del cobro debe ser mayor a 0 y no superar el saldo pendiente (${obligation.debt.toFixed(2)})`,
      );
    }
    const customerAccountAmount = lines
      .filter((line) => line.methodCode === CUSTOMER_ACCOUNT_METHOD_CODE)
      .reduce((sum, line) => sum.plus(line.amount), new Prisma.Decimal(0));

    let batchId: number;
    try {
      batchId = await this.prisma.$transaction(async (tx) => {
        const batch = await tx.delivery_payment_batch.create({
          data: {
            route_sheet_detail_id: detailId,
            idempotency_key: dto.idempotency_key,
            request_hash: idempotencyHash,
            customer_account_amount: customerAccountAmount.toFixed(2),
            created_by: driverId,
          },
        });
        let previousDebt = obligation.debt;
        for (const line of lines) {
          if (line.methodCode === CUSTOMER_ACCOUNT_METHOD_CODE) continue;
          await this.recordLine(
            tx,
            {
              driverId,
              routeSheetId: sheet.route_sheet_id,
              detailId,
              obligation,
              previousDebt,
              idempotencyKey: this.lineKey(dto.idempotency_key, line.index),
              idempotencyHash,
            },
            line,
          );
          previousDebt = previousDebt.minus(line.amount);
        }
        return batch.batch_id;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const raced = await this.findCombinedReplay(
          dto.idempotency_key,
          idempotencyHash,
        );
        if (raced) {
          return this.buildCombinedResult(
            raced,
            true,
            driverId,
            sheet.route_sheet_id,
            detailId,
          );
        }
        throw new ConflictException(
          'La clave de idempotencia ya fue usada con otro contenido',
        );
      }
      throw error;
    }

    const batch = await this.findCombinedReplay(
      dto.idempotency_key,
      idempotencyHash,
    );
    if (!batch || batch.batch_id !== batchId) {
      throw new ConflictException('No se pudo leer el cobro registrado');
    }
    return this.buildCombinedResult(
      batch,
      false,
      driverId,
      sheet.route_sheet_id,
      detailId,
    );
  }

  /**
   * Adjunta un comprobante a la parada. Es evidencia: no acredita el pago por sí
   * solo. El tipo y tamaño ya se validan al recibir el archivo.
   */
  async registerProof(
    driverId: number,
    detailId: number,
    file: UploadedProofFile | undefined,
    dto: RegisterPaymentProofBodyDto,
  ): Promise<DriverPaymentProofDto> {
    const detail = await this.loadPaymentDetail(driverId, detailId);
    const sheet = detail.route_sheet;
    if (!sheet) {
      throw new NotFoundException(`Parada ${detailId} no encontrada`);
    }
    if (sheet.execution_status !== RouteSheetExecutionStatus.IN_PROGRESS) {
      throw new ConflictException('La hoja de ruta no está en curso');
    }
    if (RESOLVED_DELIVERY_STATUSES.has(detail.delivery_status)) {
      throw new ConflictException('La parada ya está resuelta');
    }
    await this.assertIsCurrentStop(
      sheet.route_sheet_id,
      detailId,
      sheet.execution_status,
    );

    if (!file) {
      throw new BadRequestException('Falta el archivo del comprobante');
    }

    if (dto.payment_transaction_id) {
      const transaction = await this.prisma.payment_transaction.findFirst({
        where: {
          transaction_id: dto.payment_transaction_id,
          route_sheet_detail_id: detailId,
          is_active: true,
        },
        select: { transaction_id: true },
      });
      if (!transaction) {
        throw new BadRequestException(
          'El cobro indicado no corresponde a esta parada',
        );
      }
    }

    const proof = await this.prisma.payment_proof.create({
      data: {
        route_sheet_detail_id: detailId,
        payment_transaction_id: dto.payment_transaction_id ?? null,
        kind: dto.kind,
        file_name: file.filename,
        mime_type: file.mimetype,
        size_bytes: file.size,
        notes: dto.notes ?? null,
        uploaded_by: driverId,
      },
    });
    return this.toProofDto(proof);
  }

  /** Comprobantes cargados para una parada del chofer. */
  async findProofsForDelivery(
    driverId: number,
    detailId: number,
  ): Promise<DriverPaymentProofDto[]> {
    const detail = await this.loadPaymentDetail(driverId, detailId);
    const proofs = await this.prisma.payment_proof.findMany({
      where: {
        route_sheet_detail_id: detail.route_sheet_detail_id,
        is_active: true,
      },
      orderBy: { created_at: 'asc' },
    });
    return proofs.map((proof) => this.toProofDto(proof));
  }

  /** Carga la parada validando que la hoja sea del chofer y esté en curso. */
  private async loadPaymentDetail(
    driverId: number,
    detailId: number,
  ): Promise<
    PaymentDetailRow & { route_sheet: PaymentDetailRow['route_sheet'] }
  > {
    const detail = await this.prisma.route_sheet_detail.findUnique({
      where: { route_sheet_detail_id: detailId },
      include: PAYMENT_DETAIL_INCLUDE,
    });
    const sheet = detail?.route_sheet;
    if (!detail || !sheet || !sheet.is_active || sheet.driver_id !== driverId) {
      throw new NotFoundException(`Parada ${detailId} no encontrada`);
    }
    if (sheet.execution_status !== RouteSheetExecutionStatus.IN_PROGRESS) {
      throw new ConflictException('La hoja de ruta no está en curso');
    }
    return detail;
  }

  private async assertIsCurrentStop(
    routeSheetId: number,
    detailId: number,
    executionStatus: RouteSheetExecutionStatus,
  ): Promise<void> {
    const siblings = await this.prisma.route_sheet_detail.findMany({
      where: { route_sheet_id: routeSheetId },
      select: { route_sheet_detail_id: true, delivery_status: true },
      orderBy: DELIVERY_SEQUENCE_ORDER_BY,
    });
    if (!isCurrentDelivery(siblings, detailId, executionStatus)) {
      throw new ConflictException(
        'Solo se puede cobrar la parada actual del recorrido',
      );
    }
  }

  /**
   * Graba una parte del cobro: el movimiento de pago, su imputación a la
   * obligación y, si se pagó con la cuenta corriente del chofer, el cargo que
   * pasa a deber el chofer.
   */
  private async recordLine(
    tx: Prisma.TransactionClient,
    context: {
      driverId: number;
      routeSheetId: number;
      detailId: number;
      obligation: PaymentObligation;
      previousDebt: Prisma.Decimal;
      idempotencyKey: string;
      idempotencyHash: string;
    },
    line: PreparedLine,
  ): Promise<PaymentTransactionRow> {
    const { obligation } = context;
    const documentNumber = this.buildDocumentNumber(
      context.routeSheetId,
      context.detailId,
    );
    const now = new Date();
    const transaction = await tx.payment_transaction.create({
      data: {
        transaction_date: now,
        customer_id: obligation.customerId,
        order_id: obligation.type === 'ORDER' ? obligation.referenceId : null,
        route_sheet_detail_id: context.detailId,
        document_number: documentNumber,
        receipt_number: line.reference,
        transaction_type: 'PAYMENT',
        previous_balance: context.previousDebt.toFixed(2),
        transaction_amount: line.amount.toFixed(2),
        total: line.amount.toFixed(2),
        amount_received: line.amountReceived.toFixed(2),
        change_amount: line.changeAmount.toFixed(2),
        idempotency_key: context.idempotencyKey,
        idempotency_hash: context.idempotencyHash,
        payment_method_id: line.methodId,
        user_id: context.driverId,
        notes: line.notes,
      },
      select: PAYMENT_TRANSACTION_SELECT,
    });
    await this.applyObligation(tx, obligation, line.amount, {
      paymentMethodCode: line.methodCode,
      reference: line.reference,
      notes: line.notes,
      driverId: context.driverId,
    });
    if (line.methodCode === DRIVER_ACCOUNT_METHOD_CODE) {
      await this.driverCreditService.createCharge(tx, {
        driverId: context.driverId,
        customerId: obligation.customerId,
        routeSheetId: context.routeSheetId,
        detailId: context.detailId,
        transactionId: transaction.transaction_id,
        amount: line.amount,
        chargedAt: now,
        reference: documentNumber,
      });
    }
    return transaction;
  }

  private async listMethods(
    codes: string[],
  ): Promise<DriverPaymentOptionDto[]> {
    const methods = await this.prisma.payment_method.findMany({
      where: { code: { in: codes } },
      orderBy: { payment_method_id: 'asc' },
    });
    return methods.map((method) => ({
      payment_method_id: method.payment_method_id,
      code: method.code,
      description: method.description,
      requires_reference:
        method.code === TRANSFER_METHOD_CODE ||
        method.code === MERCADOPAGO_METHOD_CODE,
      requires_amount_received: method.code === CASH_METHOD_CODE,
      is_current_account:
        method.code === DRIVER_ACCOUNT_METHOD_CODE ||
        method.code === CUSTOMER_ACCOUNT_METHOD_CODE,
    }));
  }

  private async customerAccountType(
    customerId: number,
  ): Promise<CustomerCurrentAccountType> {
    const person = await this.prisma.person.findUnique({
      where: { person_id: customerId },
      select: { current_account_type: true },
    });
    return person?.current_account_type ?? CustomerCurrentAccountType.NONE;
  }

  /** Rechaza métodos que el chofer no usa o la cuenta que no le toca al cliente. */
  private assertMethodAllowed(
    code: string,
    accountType: CustomerCurrentAccountType,
  ): void {
    if (code === MERCADOPAGO_METHOD_CODE && !baseMethodCodes().includes(code)) {
      throw new BadRequestException(
        'MercadoPago todavía no está habilitado: la integración no está hecha',
      );
    }
    if (
      code === DRIVER_ACCOUNT_METHOD_CODE ||
      code === CUSTOMER_ACCOUNT_METHOD_CODE
    ) {
      if (ACCOUNT_METHOD_BY_TYPE[accountType] !== code) {
        throw new BadRequestException(
          code === DRIVER_ACCOUNT_METHOD_CODE
            ? 'Este cliente no puede pagar con la cuenta corriente del chofer'
            : 'Este cliente no tiene cuenta corriente propia',
        );
      }
      return;
    }
    if (!baseMethodCodes().includes(code)) {
      throw new BadRequestException(
        `El método de pago ${code} no está habilitado para el cobro en ruta`,
      );
    }
  }

  private lineKey(idempotencyKey: string, index: number): string {
    return `${idempotencyKey}#${index}`;
  }

  private hashCombined(
    detailId: number,
    obligation: PaymentObligation,
    lines: PreparedLine[],
  ): string {
    const payload = [
      'COMBINED',
      detailId,
      obligation.type,
      obligation.referenceId,
      ...lines.map((line) =>
        [
          line.methodId,
          line.amount.toFixed(2),
          line.amountReceived.toFixed(2),
          line.reference ?? '',
        ].join(':'),
      ),
    ].join('|');
    return createHash('sha256').update(payload).digest('hex');
  }

  private async findCombinedReplay(
    idempotencyKey: string,
    idempotencyHash: string,
  ) {
    const batch = await this.prisma.delivery_payment_batch.findUnique({
      where: { idempotency_key: idempotencyKey },
    });
    if (!batch) return null;
    if (batch.request_hash !== idempotencyHash) {
      throw new ConflictException(
        'La clave de idempotencia ya fue usada con otro contenido',
      );
    }
    return batch;
  }

  private async buildCombinedResult(
    batch: {
      batch_id: number;
      idempotency_key: string;
      customer_account_amount: Prisma.Decimal;
    },
    idempotentReplay: boolean,
    driverId: number,
    routeSheetId: number,
    detailId: number,
  ): Promise<DriverCombinedPaymentResultDto> {
    const transactions = await this.prisma.payment_transaction.findMany({
      where: { idempotency_key: { startsWith: `${batch.idempotency_key}#` } },
      select: { ...PAYMENT_TRANSACTION_SELECT, idempotency_key: true },
    });
    const byIndex = new Map(
      transactions.map((t) => [Number(t.idempotency_key.split('#').pop()), t]),
    );
    const customerAccount = new Prisma.Decimal(batch.customer_account_amount);

    const payments: CombinedPaymentLineResultDto[] = [...byIndex.entries()]
      .sort(([left], [right]) => left - right)
      .map(([, t]) => ({
        payment_method: t.payment_method.code,
        transaction_id: t.transaction_id,
        amount_applied: t.transaction_amount.toFixed(2),
        amount_received: (t.amount_received ?? t.transaction_amount).toFixed(2),
        change_amount: (t.change_amount ?? new Prisma.Decimal(0)).toFixed(2),
        document_number: t.document_number,
        receipt_number: t.receipt_number ?? null,
      }));
    if (customerAccount.gt(0)) {
      payments.push({
        payment_method: CUSTOMER_ACCOUNT_METHOD_CODE,
        transaction_id: null,
        amount_applied: customerAccount.toFixed(2),
        amount_received: '0.00',
        change_amount: '0.00',
        document_number: null,
        receipt_number: null,
      });
    }

    const totalApplied = transactions
      .reduce((sum, t) => sum.plus(t.transaction_amount), new Prisma.Decimal(0))
      .plus(customerAccount);
    const change = transactions.reduce(
      (sum, t) => sum.plus(t.change_amount ?? 0),
      new Prisma.Decimal(0),
    );

    return {
      batch_id: batch.batch_id,
      total_applied: totalApplied.toFixed(2),
      customer_account_amount: customerAccount.toFixed(2),
      change_amount: change.toFixed(2),
      payments,
      idempotent_replay: idempotentReplay,
      delivery: await this.driverRouteSheetsService.findDeliveryForDriver(
        driverId,
        routeSheetId,
        detailId,
      ),
    };
  }

  /** Determina la obligación que cubre el cobro según el tipo de parada. */
  private resolveObligation(detail: PaymentDetailRow): PaymentObligation {
    const order = detail.order_header;
    if (order) {
      return {
        type: 'ORDER',
        referenceId: order.order_id,
        customerId: order.customer_id,
        debt: this.pending(order.total_amount, order.paid_amount),
      };
    }
    const purchaseHeader = detail.one_off_purchase_header;
    if (purchaseHeader) {
      return {
        type: 'ONE_OFF',
        referenceId: purchaseHeader.purchase_header_id,
        customerId: purchaseHeader.person_id,
        debt: this.pending(
          purchaseHeader.total_amount,
          purchaseHeader.paid_amount,
        ),
      };
    }
    const purchase = detail.one_off_purchase;
    if (purchase) {
      return {
        type: 'ONE_OFF',
        referenceId: purchase.purchase_id,
        customerId: purchase.person_id,
        debt: this.pending(purchase.total_amount, purchase.paid_amount),
      };
    }
    const cyclePayment = detail.cycle_payment;
    if (cyclePayment) {
      const cycle = cyclePayment.subscription_cycle;
      const pending = new Prisma.Decimal(cycle.pending_balance ?? 0);
      return {
        type: 'COLLECTION',
        referenceId: cyclePayment.cycle_id,
        customerId: cycle.customer_subscription.customer_id,
        debt: pending.gt(0)
          ? pending
          : this.pending(cycle.total_amount, cycle.paid_amount),
      };
    }
    throw new ConflictException('Esta parada no admite cobros');
  }

  private pending(
    total: Prisma.Decimal | null,
    paid: Prisma.Decimal | null,
  ): Prisma.Decimal {
    const totalAmount = new Prisma.Decimal(total ?? 0);
    const paidAmount = new Prisma.Decimal(paid ?? 0);
    const debt = totalAmount.minus(paidAmount);
    return debt.gt(0) ? debt : new Prisma.Decimal(0);
  }

  /** Valida el efectivo recibido y calcula el vuelto. */
  private resolveCash(
    methodCode: string,
    amount: Prisma.Decimal,
    amountReceivedInput: number | undefined,
  ): { amountReceived: Prisma.Decimal; changeAmount: Prisma.Decimal } {
    const isCash = methodCode === CASH_METHOD_CODE;
    if (isCash) {
      if (amountReceivedInput === undefined) {
        throw new BadRequestException(
          'Para efectivo hay que informar el efectivo recibido',
        );
      }
      const received = new Prisma.Decimal(amountReceivedInput);
      if (received.lt(amount)) {
        throw new BadRequestException(
          'El efectivo recibido no puede ser menor al monto imputado',
        );
      }
      return { amountReceived: received, changeAmount: received.minus(amount) };
    }
    if (
      amountReceivedInput !== undefined &&
      !new Prisma.Decimal(amountReceivedInput).equals(amount)
    ) {
      throw new BadRequestException('Solo el efectivo admite vuelto');
    }
    return {
      amountReceived: amount,
      changeAmount: new Prisma.Decimal(0),
    };
  }

  /** Aplica el cobro a la obligación concreta. */
  private async applyObligation(
    tx: Prisma.TransactionClient,
    obligation: PaymentObligation,
    amount: Prisma.Decimal,
    context: {
      paymentMethodCode: string;
      reference: string | null;
      notes: string | null;
      driverId: number;
    },
  ): Promise<void> {
    if (obligation.type === 'ORDER') {
      await this.applyOrderPayment(tx, obligation.referenceId, amount);
      return;
    }
    if (obligation.type === 'ONE_OFF') {
      await this.applyOneOffPayment(tx, obligation, amount);
      return;
    }
    await this.applyCyclePayment(tx, obligation.referenceId, amount, context);
  }

  private async applyOrderPayment(
    tx: Prisma.TransactionClient,
    orderId: number,
    amount: Prisma.Decimal,
  ): Promise<void> {
    const order = await tx.order_header.findUnique({
      where: { order_id: orderId },
      select: { total_amount: true, paid_amount: true },
    });
    if (!order) {
      throw new NotFoundException(`Pedido ${orderId} no encontrado`);
    }
    const total = new Prisma.Decimal(order.total_amount);
    const newPaid = new Prisma.Decimal(order.paid_amount).plus(amount);
    await tx.order_header.update({
      where: { order_id: orderId },
      data: {
        paid_amount: newPaid.toFixed(2),
        payment_status: this.paymentStatusFor(total, newPaid),
      },
    });
  }

  private async applyOneOffPayment(
    tx: Prisma.TransactionClient,
    obligation: PaymentObligation,
    amount: Prisma.Decimal,
  ): Promise<void> {
    const header = await tx.one_off_purchase_header.findUnique({
      where: { purchase_header_id: obligation.referenceId },
      select: { paid_amount: true },
    });
    if (header) {
      const newPaid = new Prisma.Decimal(header.paid_amount ?? 0).plus(amount);
      await tx.one_off_purchase_header.update({
        where: { purchase_header_id: obligation.referenceId },
        data: { paid_amount: newPaid.toFixed(2) },
      });
      return;
    }
    const purchase = await tx.one_off_purchase.findUnique({
      where: { purchase_id: obligation.referenceId },
      select: { paid_amount: true },
    });
    if (!purchase) {
      throw new NotFoundException(
        `Compra puntual ${obligation.referenceId} no encontrada`,
      );
    }
    const newPaid = new Prisma.Decimal(purchase.paid_amount ?? 0).plus(amount);
    await tx.one_off_purchase.update({
      where: { purchase_id: obligation.referenceId },
      data: { paid_amount: newPaid.toFixed(2) },
    });
  }

  /**
   * Aplica el cobro a un ciclo de suscripción: primero a la deuda pendiente y
   * el excedente como crédito. Registra el movimiento en cycle_payment.
   */
  private async applyCyclePayment(
    tx: Prisma.TransactionClient,
    cycleId: number,
    amount: Prisma.Decimal,
    context: {
      paymentMethodCode: string;
      reference: string | null;
      notes: string | null;
      driverId: number;
    },
  ): Promise<void> {
    const cycle = await tx.subscription_cycle.findUnique({
      where: { cycle_id: cycleId },
      select: {
        paid_amount: true,
        pending_balance: true,
        credit_balance: true,
      },
    });
    if (!cycle) {
      throw new NotFoundException(`Ciclo ${cycleId} no encontrado`);
    }

    let remaining = amount;
    let pending = new Prisma.Decimal(cycle.pending_balance ?? 0);
    let credit = new Prisma.Decimal(cycle.credit_balance ?? 0);
    let paid = new Prisma.Decimal(cycle.paid_amount ?? 0);

    if (remaining.gt(0) && pending.gt(0)) {
      const applied = Prisma.Decimal.min(remaining, pending);
      pending = pending.minus(applied);
      paid = paid.plus(applied);
      remaining = remaining.minus(applied);
    }
    if (remaining.gt(0)) {
      credit = credit.plus(remaining);
    }

    let paymentStatus: 'PAID' | 'PARTIAL' | 'CREDITED' = 'PARTIAL';
    if (pending.lte(0)) {
      paymentStatus = credit.gt(0) ? 'CREDITED' : 'PAID';
    } else if (paid.lte(0)) {
      paymentStatus = 'PARTIAL';
    }

    await tx.subscription_cycle.update({
      where: { cycle_id: cycleId },
      data: {
        paid_amount: paid.toFixed(2),
        pending_balance: pending.toFixed(2),
        credit_balance: credit.toFixed(2),
        payment_status: paymentStatus,
      },
    });
    await tx.cycle_payment.create({
      data: {
        cycle_id: cycleId,
        payment_date: new Date(),
        amount: amount.toFixed(2),
        payment_method: context.paymentMethodCode,
        reference: context.reference,
        notes: context.notes,
        created_by: context.driverId,
      },
    });
  }

  private paymentStatusFor(
    total: Prisma.Decimal,
    paid: Prisma.Decimal,
  ): string {
    if (paid.gte(total)) return 'PAID';
    if (paid.lte(0)) return 'PENDING';
    return 'PARTIAL';
  }

  private async findReplay(
    idempotencyKey: string,
    idempotencyHash: string,
  ): Promise<PaymentTransactionRow | null> {
    const existing = await this.prisma.payment_transaction.findUnique({
      where: { idempotency_key: idempotencyKey },
      select: PAYMENT_TRANSACTION_SELECT,
    });
    if (!existing) return null;
    if (existing.idempotency_hash !== idempotencyHash) {
      throw new ConflictException(
        'La clave de idempotencia ya fue usada con otro contenido',
      );
    }
    return existing;
  }

  private async buildResult(
    transaction: PaymentTransactionRow,
    idempotentReplay: boolean,
    driverId: number,
    routeSheetId: number,
    detailId: number,
  ): Promise<DriverPaymentResultDto> {
    const delivery = await this.driverRouteSheetsService.findDeliveryForDriver(
      driverId,
      routeSheetId,
      detailId,
    );
    const amountReceived =
      transaction.amount_received ?? transaction.transaction_amount;
    return {
      transaction_id: transaction.transaction_id,
      transaction_date: formatBATimestampISO(transaction.transaction_date),
      amount_applied: transaction.transaction_amount.toFixed(2),
      amount_received: amountReceived.toFixed(2),
      change_amount: (
        transaction.change_amount ?? new Prisma.Decimal(0)
      ).toFixed(2),
      payment_method: transaction.payment_method.code,
      document_number: transaction.document_number,
      receipt_number: transaction.receipt_number ?? null,
      idempotent_replay: idempotentReplay,
      delivery,
    };
  }

  private toProofDto(proof: {
    proof_id: number;
    kind: string;
    file_name: string;
    mime_type: string;
    size_bytes: number;
    notes: string | null;
    uploaded_by: number | null;
    created_at: Date;
  }): DriverPaymentProofDto {
    return {
      proof_id: proof.proof_id,
      kind: proof.kind as DriverPaymentProofKind,
      file_name: proof.file_name,
      mime_type: proof.mime_type,
      size_bytes: proof.size_bytes,
      notes: proof.notes,
      url: buildImageUrl(proof.file_name, 'payment-proofs'),
      uploaded_by: proof.uploaded_by,
      created_at: formatBATimestampISO(proof.created_at),
    };
  }

  private buildDocumentNumber(routeSheetId: number, detailId: number): string {
    return `RS-${routeSheetId}-D${detailId}`;
  }

  private hashRequest(input: {
    route_sheet_detail_id: number;
    obligation: PaymentObligation;
    amount: Prisma.Decimal;
    payment_method_id: number;
    transaction_reference: string | null;
    amount_received: Prisma.Decimal;
  }): string {
    const payload = [
      input.route_sheet_detail_id,
      input.obligation.type,
      input.obligation.referenceId,
      input.amount.toFixed(2),
      input.payment_method_id,
      input.transaction_reference ?? '',
      input.amount_received.toFixed(2),
    ].join('|');
    return createHash('sha256').update(payload).digest('hex');
  }

  private getTransferData(): DriverTransferDataDto | null {
    const cbu = process.env.TRANSFER_CBU?.trim() || null;
    const alias = process.env.TRANSFER_ALIAS?.trim() || null;
    const holder = process.env.TRANSFER_HOLDER?.trim() || null;
    const bank = process.env.TRANSFER_BANK?.trim() || null;
    if (!cbu && !alias && !holder && !bank) {
      return null;
    }
    return { cbu, alias, holder, bank };
  }
}
