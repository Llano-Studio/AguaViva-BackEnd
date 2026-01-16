import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { BUSINESS_CONFIG } from '../common/config/business.config';
import { formatBATimestampISO, formatBAYMD } from '../common/utils/date.utils';
import { PrismaClient } from '@prisma/client';
import { AuditRecordDto } from '../cycle-payments/dto';

export interface CreateAuditRecordParams {
  tableName: string;
  recordId: number;
  operationType: 'CREATE' | 'UPDATE' | 'DELETE';
  oldValues?: any;
  newValues?: any;
  userId: number;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(AuditService.name);

  constructor() {
    super();
  }

  async onModuleInit() {
    await this.$connect();
  }

  /**
   * Crea un registro de auditoría para operaciones de pago
   */
  async createAuditRecord(params: CreateAuditRecordParams): Promise<number> {
    try {
      const auditRecord = await this.payment_audit.create({
        data: {
          table_name: params.tableName,
          record_id: params.recordId,
          operation_type: params.operationType,
          old_values: params.oldValues
            ? JSON.stringify(params.oldValues)
            : null,
          new_values: params.newValues
            ? JSON.stringify(params.newValues)
            : null,
          created_by: params.userId,
          reason: params.reason,
          ip_address: params.ipAddress,
          user_agent: params.userAgent,
          created_at: new Date(),
        },
      });

      this.logger.log(
        `Audit record created: ${auditRecord.audit_id} for ${params.tableName}:${params.recordId}`,
      );

      return auditRecord.audit_id;
    } catch (error) {
      this.logger.error('Error creating audit record:', error);
      throw new Error('Failed to create audit record');
    }
  }

  /**
   * Obtiene el historial de auditoría para un pago específico
   */
  async getPaymentAuditHistory(
    tableName: string,
    recordId: number,
    limit: number = BUSINESS_CONFIG.PAGINATION.DEFAULT_LIMIT,
  ): Promise<AuditRecordDto[]> {
    try {
      const auditRecords = await this.payment_audit.findMany({
        where: {
          table_name: tableName,
          record_id: recordId,
        },
        include: {
          created_by_user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
        orderBy: {
          created_at: 'desc',
        },
        take: limit,
      });

      return auditRecords.map((record) => ({
        audit_id: record.audit_id,
        table_name: record.table_name,
        record_id: record.record_id,
        operation_type: record.operation_type as 'CREATE' | 'UPDATE' | 'DELETE',
        old_values: record.old_values
          ? JSON.parse(record.old_values as string)
          : null,
        new_values: record.new_values
          ? JSON.parse(record.new_values as string)
          : null,
        created_at: formatBATimestampISO(record.created_at as any),
        created_by: record.created_by,
        reason: record.reason,
        ip_address: record.ip_address,
        user_agent: record.user_agent,
        user: record.created_by_user
          ? {
              user_id: record.created_by_user.id,
              username: record.created_by_user.name,
              email: record.created_by_user.email,
              role: record.created_by_user.role,
            }
          : undefined,
      }));
    } catch (error) {
      this.logger.error('Error fetching audit history:', error);
      throw new Error('Failed to fetch audit history');
    }
  }

  /**
   * Obtiene todos los registros de auditoría con filtros opcionales
   */
  async getAllAuditRecords(
    filters?: {
      tableName?: string;
      operationType?: 'UPDATE' | 'DELETE';
      userId?: number;
      dateFrom?: Date;
      dateTo?: Date;
    },
    limit: number = 100,
    offset: number = 0,
  ): Promise<{ records: AuditRecordDto[]; total: number }> {
    try {
      const where: any = {};

      if (filters?.tableName) {
        where.table_name = filters.tableName;
      }

      if (filters?.operationType) {
        where.operation_type = filters.operationType;
      }

      if (filters?.userId) {
        where.created_by = filters.userId;
      }

      if (filters?.dateFrom || filters?.dateTo) {
        where.created_at = {};
        if (filters.dateFrom) {
          where.created_at.gte = filters.dateFrom;
        }
        if (filters.dateTo) {
          where.created_at.lte = filters.dateTo;
        }
      }

      const [auditRecords, total] = await Promise.all([
        this.payment_audit.findMany({
          where,
          include: {
            created_by_user: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
              },
            },
          },
          orderBy: {
            created_at: 'desc',
          },
          take: limit,
          skip: offset,
        }),
        this.payment_audit.count({ where }),
      ]);

      const records = auditRecords.map((record) => ({
        audit_id: record.audit_id,
        table_name: record.table_name,
        record_id: record.record_id,
        operation_type: record.operation_type as 'CREATE' | 'UPDATE' | 'DELETE',
        old_values: record.old_values
          ? JSON.parse(record.old_values as string)
          : null,
        new_values: record.new_values
          ? JSON.parse(record.new_values as string)
          : null,
        created_at: formatBATimestampISO(record.created_at as any),
        created_by: record.created_by,
        reason: record.reason,
        ip_address: record.ip_address,
        user_agent: record.user_agent,
        user: record.created_by_user
          ? {
              user_id: record.created_by_user.id,
              username: record.created_by_user.name,
              email: record.created_by_user.email,
              role: record.created_by_user.role,
            }
          : undefined,
      }));

      return { records, total };
    } catch (error) {
      this.logger.error('Error fetching all audit records:', error);
      throw new Error('Failed to fetch audit records');
    }
  }

  /**
   * Valida si un usuario tiene permisos para realizar operaciones de auditoría
   */
  async validateAuditPermissions(
    userId: number,
    operation: string,
  ): Promise<boolean> {
    try {
      const user = await this.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });

      if (!user) {
        return false;
      }

      // Roles válidos según el esquema del sistema
      const allowedRoles = [
        'SUPERADMIN',
        'BOSSADMINISTRATIVE',
        'ADMINISTRATIVE',
      ];
      return allowedRoles.includes(user.role as any);
    } catch (error) {
      this.logger.error('Error validating audit permissions:', error);
      return false;
    }
  }

  /**
   * Genera un código de confirmación para operaciones críticas
   */
  generateConfirmationCode(): string {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `CONF${timestamp}${random}`;
  }

  /**
   * Valida un código de confirmación
   */
  validateConfirmationCode(code: string): boolean {
    // Validación flexible del formato del código
    // 1) Formato generado por el sistema: CONF + 6 dígitos + 6 caracteres alfanuméricos
    // 2) Formato documentado en Swagger: CONF-YYYY-NNN (por ejemplo: CONF-2024-001)
    const patterns = [/^CONF\d{6}[A-Z0-9]{6}$/i, /^CONF-\d{4}-\d{3}$/i];
    return patterns.some((p) => p.test(code));
  }

  /**
   * Obtiene el historial general de auditoría con filtros avanzados
   */
  async getGeneralAuditHistory(
    filters: {
      operationType?: 'CREATE' | 'UPDATE' | 'DELETE';
      tableName?: 'cycle_payment' | 'payment_transaction';
      userId?: number;
      startDate?: Date;
      endDate?: Date;
    },
    limit: number = 20,
    offset: number = 0,
  ): Promise<{ records: any[]; total: number }> {
    try {
      const where: any = {};

      if (filters.operationType) {
        where.operation_type = filters.operationType;
      }

      if (filters.tableName) {
        where.table_name = filters.tableName;
      }

      if (filters.userId) {
        where.created_by = filters.userId;
      }

      if (filters.startDate || filters.endDate) {
        where.created_at = {};
        if (filters.startDate) {
          where.created_at.gte = filters.startDate;
        }
        if (filters.endDate) {
          where.created_at.lte = filters.endDate;
        }
      }

      const [auditRecords, total] = await Promise.all([
        this.payment_audit.findMany({
          where,
          include: {
            created_by_user: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
              },
            },
          },
          orderBy: {
            created_at: 'desc',
          },
          take: limit,
          skip: offset,
        }),
        this.payment_audit.count({ where }),
      ]);

      const records = auditRecords.map((record) => ({
        audit_id: record.audit_id,
        table_name: record.table_name,
        record_id: record.record_id,
        operation_type: record.operation_type,
        old_values: record.old_values
          ? JSON.parse(record.old_values as string)
          : null,
        new_values: record.new_values
          ? JSON.parse(record.new_values as string)
          : null,
        created_at: formatBATimestampISO(record.created_at as any),
        created_by: record.created_by,
        reason: record.reason,
        ip_address: record.ip_address,
        user_agent: record.user_agent,
        user_name: record.created_by_user?.name || 'Usuario desconocido',
        user_email: record.created_by_user?.email,
        user_role: record.created_by_user?.role,
      }));

      return { records, total };
    } catch (error) {
      this.logger.error('Error fetching general audit history:', error);
      throw new Error('Failed to fetch general audit history');
    }
  }

  /**
   * Obtiene estadísticas de auditoría para el período especificado
   */
  async getAuditStatistics(
    period: 'day' | 'week' | 'month' | 'year' = 'month',
  ) {
    try {
      const now = new Date();
      let startDate: Date;

      switch (period) {
        case 'day':
          startDate = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
          );
          break;
        case 'week':
          const dayOfWeek = now.getDay();
          startDate = new Date(now.getTime() - dayOfWeek * 24 * 60 * 60 * 1000);
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      }

      // Obtener estadísticas generales
      const [
        totalOperations,
        operationsByType,
        operationsByTable,
        topUsers,
        dailyActivity,
      ] = await Promise.all([
        // Total de operaciones en el período
        this.payment_audit.count({
          where: {
            created_at: {
              gte: startDate,
              lte: now,
            },
          },
        }),

        // Operaciones por tipo
        this.payment_audit.groupBy({
          by: ['operation_type'],
          where: {
            created_at: {
              gte: startDate,
              lte: now,
            },
          },
          _count: {
            operation_type: true,
          },
        }),

        // Operaciones por tabla
        this.payment_audit.groupBy({
          by: ['table_name'],
          where: {
            created_at: {
              gte: startDate,
              lte: now,
            },
          },
          _count: {
            table_name: true,
          },
        }),

        // Usuarios más activos
        this.payment_audit.groupBy({
          by: ['created_by'],
          where: {
            created_at: {
              gte: startDate,
              lte: now,
            },
          },
          _count: {
            created_by: true,
          },
          orderBy: {
            _count: {
              created_by: 'desc',
            },
          },
          take: 5,
        }),

        // Actividad diaria
        this.$queryRaw`
          SELECT 
            DATE(created_at) as date,
            COUNT(*) as operation_count
          FROM payment_audit 
          WHERE created_at >= ${startDate} AND created_at <= ${now}
          GROUP BY DATE(created_at)
          ORDER BY date DESC
          LIMIT 30
        `,
      ]);

      // Obtener información de usuarios para top_users
      const userIds = topUsers.map((u) => u.created_by);
      const users = await this.user.findMany({
        where: {
          id: {
            in: userIds,
          },
        },
        select: {
          id: true,
          name: true,
        },
      });

      const userMap = new Map(users.map((u) => [u.id, u.name]));

      // Formatear resultados
      const operationsByTypeFormatted = operationsByType.reduce(
        (acc, item) => {
          acc[item.operation_type] = item._count.operation_type;
          return acc;
        },
        {} as Record<string, number>,
      );

      const operationsByTableFormatted = operationsByTable.reduce(
        (acc, item) => {
          acc[item.table_name] = item._count.table_name;
          return acc;
        },
        {} as Record<string, number>,
      );

      const topUsersFormatted = topUsers.map((user) => ({
        user_id: user.created_by,
        user_name: userMap.get(user.created_by) || 'Usuario desconocido',
        operation_count: user._count.created_by,
      }));

      const dailyActivityFormatted = (dailyActivity as any[]).map((day) => ({
        date: formatBAYMD(new Date(day.date)),
        operation_count: Number(day.operation_count),
      }));

      return {
        summary: {
          total_operations: totalOperations,
          operations_by_type: {
            CREATE: operationsByTypeFormatted.CREATE || 0,
            UPDATE: operationsByTypeFormatted.UPDATE || 0,
            DELETE: operationsByTypeFormatted.DELETE || 0,
          },
          operations_by_table: {
            cycle_payment: operationsByTableFormatted.cycle_payment || 0,
            payment_transaction:
              operationsByTableFormatted.payment_transaction || 0,
          },
        },
        top_users: topUsersFormatted,
        daily_activity: dailyActivityFormatted,
        period_info: {
          period,
          start_date: formatBATimestampISO(startDate as any),
          end_date: formatBATimestampISO(now as any),
        },
      };
    } catch (error) {
      this.logger.error('Error fetching audit statistics:', error);
      throw new Error('Failed to fetch audit statistics');
    }
  }
}
