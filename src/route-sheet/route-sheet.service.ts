import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import {
  CreateRouteSheetDto,
  UpdateRouteSheetDto,
  FilterRouteSheetsDto,
  RouteSheetResponseDto,
  RouteSheetDetailResponseDto,
  OrderDto,
  CustomerDto,
  ProductDto,
  OrderItemDto,
  DriverDto,
  VehicleDto,
  ZoneDto,
  ReconcileRouteSheetDto,
  RecordPaymentDto,
  SkipDeliveryDto,
  UpdateDeliveryTimeDto,
} from './dto';
import * as fs from 'fs-extra';
import { join } from 'path';
import { Decimal } from '@prisma/client/runtime/library';
import { parseSortByString } from '../common/utils/query-parser.utils';
import { handlePrismaError } from '../common/utils/prisma-error-handler.utils';
import {
  PdfGeneratorService,
  RouteSheetPdfData,
} from '../common/services/pdf-generator.service';
import { RouteSheetGeneratorService } from '../common/services/route-sheet-generator.service';
import { SubscriptionQuotaService } from '../common/services/subscription-quota.service';
import {
  formatBAYMD,
  formatBATimestampISO,
  parseYMD,
  formatUTCYMD,
} from '../common/utils/date.utils';
import { DeliveryStatus } from '../common/constants/enums';
import { OrdersService } from '../orders/orders.service';

type RouteSheetWithDetails = Prisma.route_sheetGetPayload<{
  include: {
    driver: true;
    vehicle: {
      include: {
        vehicle_zone: {
          where: { is_active: true };
          include: {
            zone: {
              include: {
                locality: {
                  include: {
                    province: {
                      include: {
                        country: true;
                      };
                    };
                  };
                };
              };
            };
          };
        };
      };
    };
    route_sheet_detail: {
      include: {
        order_header: {
          include: {
            customer: true;
            order_item: {
              include: {
                product: true;
              };
            };
          };
        };
        one_off_purchase: {
          include: {
            person: true;
            product: true;
          };
        };
        one_off_purchase_header: {
          include: {
            person: true;
            purchase_items: {
              include: {
                product: true;
              };
            };
          };
        };
        cancellation_order: {
          include: {
            customer_subscription: {
              include: {
                person: true;
              };
            };
          };
        };
        cycle_payment: {
          include: {
            subscription_cycle: {
              include: {
                customer_subscription: {
                  include: {
                    person: true;
                  };
                };
              };
            };
          };
        };
      };
    };
  };
}>;

@Injectable()
export class RouteSheetService extends PrismaClient implements OnModuleInit {
  constructor(
    private readonly pdfGeneratorService: PdfGeneratorService,
    private readonly routeSheetGeneratorService: RouteSheetGeneratorService,
    private readonly ordersService: OrdersService,
    private readonly subscriptionQuotaService: SubscriptionQuotaService,
  ) {
    super();
  }

  private readonly entityName = 'Hoja de Ruta';
  private readonly logger = new Logger(RouteSheetService.name);
  private readonly reconciliationSignaturesPath = join(
    process.cwd(),
    'public',
    'uploads',
    'reconciliations',
    'driver_signatures',
  );
  private readonly deliveryEvidencePath = join(
    process.cwd(),
    'public',
    'uploads',
    'delivery_evidence',
  );

  async onModuleInit() {
    await this.$connect();
    await this.ensurePdfDirectoryExists();
    await fs.ensureDir(this.reconciliationSignaturesPath);
    await fs.ensureDir(this.deliveryEvidencePath);
  }

  private async ensurePdfDirectoryExists() {
    const pdfDir = join(process.cwd(), 'public', 'pdfs');
    await fs.ensureDir(pdfDir);
    return pdfDir;
  }

  private async saveFile(
    dataUri: string,
    targetPath: string,
    baseFileName: string,
  ): Promise<string> {
    try {
      if (!dataUri.startsWith('data:')) {
        throw new BadRequestException(
          'Formato de datos inválido para el archivo.',
        );
      }

      const matches = dataUri.match(/^data:([A-Za-z-+\\/]+);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        throw new BadRequestException('Formato de datos URI inválido.');
      }

      const mimeType = matches[1];
      const base64Data = matches[2];
      const buffer = Buffer.from(base64Data, 'base64');

      const extension = this.getFileExtensionFromMimeType(mimeType);
      const timestamp = new Date().getTime();
      const fileName = `${baseFileName}_${timestamp}.${extension}`;
      const filePath = join(targetPath, fileName);

      await fs.writeFile(filePath, buffer);
      return fileName;
    } catch (error) {
      console.error('Error al guardar archivo:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Error interno al guardar el archivo.',
      );
    }
  }

  private getFileExtensionFromMimeType(mimeType: string): string {
    const mimeMap: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/svg+xml': 'svg',
      'application/pdf': 'pdf',
    };
    return mimeMap[mimeType] || 'bin';
  }

  async create(
    createRouteSheetDto: CreateRouteSheetDto,
  ): Promise<RouteSheetResponseDto> {
    const { driver_id, vehicle_id, delivery_date, route_notes, details } =
      createRouteSheetDto;

    try {
      const driver = await this.user.findUnique({
        where: { id: driver_id },
      });
      if (!driver) {
        throw new BadRequestException(
          `El conductor con ID ${driver_id} no existe`,
        );
      }

      const vehicle = await this.vehicle.findUnique({
        where: { vehicle_id },
      });
      if (!vehicle) {
        throw new BadRequestException(
          `El vehículo con ID ${vehicle_id} no existe`,
        );
      }

      // Validar que existan las órdenes según su tipo
      // Separar órdenes ONE_OFF de las demás cuando se usa order_id
      const regularOrderIds = details
        .filter((detail) => detail.order_id && detail.order_type !== 'ONE_OFF')
        .map((detail) => detail.order_id);
      const oneOffOrderIds = details
        .filter((detail) => detail.order_id && detail.order_type === 'ONE_OFF')
        .map((detail) => detail.order_id);
      const oneOffPurchaseIds = details
        .filter((detail) => detail.one_off_purchase_id)
        .map((detail) => detail.one_off_purchase_id);
      const oneOffPurchaseHeaderIds = details
        .filter((detail) => detail.one_off_purchase_header_id)
        .map((detail) => detail.one_off_purchase_header_id);
      const cyclePaymentIds = details
        .filter((detail) => detail.cycle_payment_id)
        .map((detail) => detail.cycle_payment_id);

      // Validar órdenes regulares (SUBSCRIPTION, HYBRID, CONTRACT_DELIVERY)
      if (regularOrderIds.length > 0) {
        const orders = await this.order_header.findMany({
          where: { order_id: { in: regularOrderIds } },
        });
        if (orders.length !== regularOrderIds.length) {
          const foundOrderIds = orders.map((order) => order.order_id);
          const missingOrderIds = regularOrderIds.filter(
            (id) => !foundOrderIds.includes(id),
          );
          throw new BadRequestException(
            `Los siguientes pedidos no existen: ${missingOrderIds.join(', ')}`,
          );
        }

        // Validar que el tipo de orden especificado coincida con el tipo real en la base de datos
        for (const detail of details) {
          if (detail.order_id && detail.order_type) {
            const order = orders.find((o) => o.order_id === detail.order_id);
            if (order && order.order_type !== detail.order_type) {
              throw new BadRequestException(
                `El pedido ${detail.order_id} es de tipo ${order.order_type}, pero se especificó como ${detail.order_type}`,
              );
            }
          }
        }
      }

      // Validar órdenes ONE_OFF que usan order_id con order_type
      if (oneOffOrderIds.length > 0) {
        const oneOffPurchases = await this.one_off_purchase.findMany({
          where: { purchase_id: { in: oneOffOrderIds } },
        });
        if (oneOffPurchases.length !== oneOffOrderIds.length) {
          const foundIds = oneOffPurchases.map(
            (purchase) => purchase.purchase_id,
          );
          const missingIds = oneOffOrderIds.filter(
            (id) => !foundIds.includes(id),
          );
          throw new BadRequestException(
            `Las siguientes compras one-off no existen: ${missingIds.join(', ')}`,
          );
        }
      }

      // Validar órdenes one-off legacy (usando one_off_purchase_id directamente)
      if (oneOffPurchaseIds.length > 0) {
        const oneOffPurchases = await this.one_off_purchase.findMany({
          where: { purchase_id: { in: oneOffPurchaseIds } },
        });
        if (oneOffPurchases.length !== oneOffPurchaseIds.length) {
          const foundIds = oneOffPurchases.map(
            (purchase) => purchase.purchase_id,
          );
          const missingIds = oneOffPurchaseIds.filter(
            (id) => !foundIds.includes(id),
          );
          throw new BadRequestException(
            `Las siguientes compras one-off no existen: ${missingIds.join(', ')}`,
          );
        }
      }

      // Validar órdenes one-off header
      if (oneOffPurchaseHeaderIds.length > 0) {
        const oneOffPurchaseHeaders =
          await this.one_off_purchase_header.findMany({
            where: { purchase_header_id: { in: oneOffPurchaseHeaderIds } },
          });
        if (oneOffPurchaseHeaders.length !== oneOffPurchaseHeaderIds.length) {
          const foundIds = oneOffPurchaseHeaders.map(
            (header) => header.purchase_header_id,
          );
          const missingIds = oneOffPurchaseHeaderIds.filter(
            (id) => !foundIds.includes(id),
          );
          throw new BadRequestException(
            `Los siguientes headers de compras one-off no existen: ${missingIds.join(', ')}`,
          );
        }
      }

      // Validar pedidos de cobranza
      if (cyclePaymentIds.length > 0) {
        const cyclePayments = await this.cycle_payment.findMany({
          where: { payment_id: { in: cyclePaymentIds } },
        });
        if (cyclePayments.length !== cyclePaymentIds.length) {
          const foundIds = cyclePayments.map((payment) => payment.payment_id);
          const missingIds = cyclePaymentIds.filter(
            (id) => !foundIds.includes(id),
          );
          throw new BadRequestException(
            `Los siguientes pedidos de cobranza no existen: ${missingIds.join(', ')}`,
          );
        }
      }

      // Verificar asignaciones existentes para todos los tipos de órdenes
      const existingAssignments = await this.route_sheet_detail.findMany({
        where: {
          OR: [
            regularOrderIds.length > 0
              ? { order_id: { in: regularOrderIds } }
              : {},
            oneOffPurchaseIds.length > 0
              ? { one_off_purchase_id: { in: oneOffPurchaseIds } }
              : {},
            oneOffPurchaseHeaderIds.length > 0
              ? { one_off_purchase_header_id: { in: oneOffPurchaseHeaderIds } }
              : {},
            cyclePaymentIds.length > 0
              ? { cycle_payment_id: { in: cyclePaymentIds } }
              : {},
          ].filter((condition) => Object.keys(condition).length > 0),
          route_sheet: {
            is: {
              delivery_date:
                typeof delivery_date === 'string' &&
                /^\d{4}-\d{2}-\d{2}$/.test(delivery_date.trim())
                  ? parseYMD(delivery_date.trim())
                  : new Date(delivery_date),
              is_active: true,
            },
          },
        },
        include: {
          route_sheet: true,
        },
      });

      if (existingAssignments.length > 0) {
        const assignedOrders = existingAssignments.map((assignment) => {
          if (assignment.order_id) {
            return `Pedido de suscripción ${assignment.order_id} ya asignado a la hoja de ruta ${assignment.route_sheet_id}`;
          } else if (assignment.one_off_purchase_id) {
            return `Compra one-off ${assignment.one_off_purchase_id} ya asignada a la hoja de ruta ${assignment.route_sheet_id}`;
          } else if (assignment.one_off_purchase_header_id) {
            return `Header de compra one-off ${assignment.one_off_purchase_header_id} ya asignado a la hoja de ruta ${assignment.route_sheet_id}`;
          } else if (assignment.cycle_payment_id) {
            return `Pedido de cobranza ${assignment.cycle_payment_id} ya asignado a la hoja de ruta ${assignment.route_sheet_id}`;
          }
          return `Orden desconocida ya asignada a la hoja de ruta ${assignment.route_sheet_id}`;
        });
        throw new BadRequestException(
          `Las siguientes órdenes ya están asignadas para esa fecha: ${assignedOrders.join(', ')}`,
        );
      }

      // Validar horarios de entrega contra preferencias de suscripción (solo para órdenes de suscripción)
      const validationErrors: string[] = [];
      const validatedDetails: Array<{
        order_id?: number;
        one_off_purchase_id?: number;
        one_off_purchase_header_id?: number;
        cycle_payment_id?: number;
        delivery_status: string;
        delivery_time: string | null;
        comments?: string;
      }> = [];

      for (const detail of details) {
        // Solo validar horarios para órdenes de suscripción
        if (detail.delivery_time && detail.order_id) {
          const validation = await this.validateDeliveryTimeAgainstSubscription(
            detail.order_id,
            detail.delivery_time,
          );

          if (!validation.isValid) {
            validationErrors.push(
              `Pedido de suscripción ${detail.order_id}: ${validation.message}`,
            );
          }
        }

        validatedDetails.push({
          order_id: detail.order_id,
          one_off_purchase_id: detail.one_off_purchase_id,
          one_off_purchase_header_id: detail.one_off_purchase_header_id,
          cycle_payment_id: detail.cycle_payment_id,
          delivery_status: detail.delivery_status || DeliveryStatus.PENDING,
          delivery_time: detail.delivery_time || null,
          comments: detail.comments,
        });
      }

      if (validationErrors.length > 0) {
        throw new BadRequestException(
          `Errores de validación de horarios: ${validationErrors.join('; ')}`,
        );
      }

      // Validación de zonas contra zonas asignadas al vehículo y zone_ids opcional
      const activeVehicleZones = await this.vehicle_zone.findMany({
        where: { vehicle_id, is_active: true },
        select: { zone_id: true },
      });
      const assignedZoneIds = new Set<number>(
        activeVehicleZones.map((z) => z.zone_id),
      );

      const selectedZoneIds = Array.isArray(createRouteSheetDto.zone_ids)
        ? createRouteSheetDto.zone_ids
        : [];

      // Si se especifican zone_ids, validar que están asignadas al vehículo
      if (selectedZoneIds.length > 0) {
        const invalidSelected = selectedZoneIds.filter(
          (z) => !assignedZoneIds.has(z),
        );
        if (invalidSelected.length > 0) {
          throw new BadRequestException(
            `Las siguientes zonas no están asignadas al vehículo ${vehicle_id}: ${invalidSelected.join(
              ', ',
            )}`,
          );
        }
      }

      // Determinar zonas por detalle para validar contra zone_ids cuando corresponda
      const allOneOffIds = Array.from(
        new Set([...(oneOffOrderIds || []), ...(oneOffPurchaseIds || [])]),
      );
      const [
        orderZoneRecords,
        oneOffZoneRecords,
        headerZoneRecords,
        cyclePaymentRecords,
      ] = await Promise.all([
        regularOrderIds.length > 0
          ? this.order_header.findMany({
              where: { order_id: { in: regularOrderIds } },
              select: { order_id: true, zone_id: true },
            })
          : Promise.resolve([]),
        allOneOffIds.length > 0
          ? this.one_off_purchase.findMany({
              where: { purchase_id: { in: allOneOffIds } },
              select: { purchase_id: true, zone_id: true },
            })
          : Promise.resolve([]),
        oneOffPurchaseHeaderIds.length > 0
          ? this.one_off_purchase_header.findMany({
              where: {
                purchase_header_id: { in: oneOffPurchaseHeaderIds },
              },
              select: { purchase_header_id: true, zone_id: true },
            })
          : Promise.resolve([]),
        cyclePaymentIds.length > 0
          ? this.cycle_payment.findMany({
              where: { payment_id: { in: cyclePaymentIds } },
              include: {
                subscription_cycle: {
                  include: {
                    customer_subscription: {
                      include: { person: true },
                    },
                  },
                },
              },
            })
          : Promise.resolve([]),
      ]);

      const orderZonesMap = new Map<number, number | null>();
      for (const r of orderZoneRecords as Array<{
        order_id: number;
        zone_id: number | null;
      }>) {
        orderZonesMap.set(r.order_id, r.zone_id ?? null);
      }
      const oneOffZonesMap = new Map<number, number | null>();
      for (const r of oneOffZoneRecords as Array<{
        purchase_id: number;
        zone_id: number | null;
      }>) {
        oneOffZonesMap.set(r.purchase_id, r.zone_id ?? null);
      }
      const headerZonesMap = new Map<number, number | null>();
      for (const r of headerZoneRecords as Array<{
        purchase_header_id: number;
        zone_id: number | null;
      }>) {
        headerZonesMap.set(r.purchase_header_id, r.zone_id ?? null);
      }
      const cycleZonesMap = new Map<number, number | null>();
      for (const r of cyclePaymentRecords) {
        const zid =
          r.subscription_cycle?.customer_subscription?.person?.zone_id ?? null;
        cycleZonesMap.set(r.payment_id, typeof zid === 'number' ? zid : null);
      }

      const detailZoneIds = new Set<number>();
      for (const d of details) {
        let zid: number | null = null;
        if (d.order_id && d.order_type !== 'ONE_OFF') {
          zid = orderZonesMap.get(d.order_id) ?? null;
        } else if (d.order_id && d.order_type === 'ONE_OFF') {
          zid = oneOffZonesMap.get(d.order_id) ?? null;
        } else if (d.one_off_purchase_id) {
          zid = oneOffZonesMap.get(d.one_off_purchase_id) ?? null;
        } else if (d.one_off_purchase_header_id) {
          zid = headerZonesMap.get(d.one_off_purchase_header_id) ?? null;
        } else if (d.cycle_payment_id) {
          zid = cycleZonesMap.get(d.cycle_payment_id) ?? null;
        }
        if (typeof zid === 'number') detailZoneIds.add(zid);
      }

      if (selectedZoneIds.length > 0) {
        const outOfSelected = Array.from(detailZoneIds).filter(
          (z) => !selectedZoneIds.includes(z),
        );
        if (outOfSelected.length > 0) {
          throw new BadRequestException(
            `La hoja incluye detalles en zonas no especificadas en zone_ids: ${outOfSelected.join(
              ', ',
            )}`,
          );
        }
      }

      const result = await this.$transaction(async (tx) => {
        const routeSheet = await tx.route_sheet.create({
          data: {
            driver_id,
            vehicle_id,
            delivery_date:
              typeof delivery_date === 'string' &&
              /^\d{4}-\d{2}-\d{2}$/.test(delivery_date.trim())
                ? parseYMD(delivery_date.trim())
                : new Date(delivery_date),
            route_notes,
          },
          include: {
            driver: true,
            vehicle: {
              include: {
                vehicle_zone: {
                  where: { is_active: true },
                  include: {
                    zone: {
                      include: {
                        locality: {
                          include: {
                            province: {
                              include: {
                                country: true,
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            route_sheet_detail: {
              include: {
                order_header: {
                  include: {
                    customer: true,
                    customer_subscription: {
                      include: {
                        subscription_cycle: {
                          orderBy: { cycle_number: 'desc' },
                          take: 1,
                        },
                      },
                    },
                    order_item: {
                      include: {
                        product: true,
                      },
                    },
                  },
                },
                one_off_purchase: {
                  include: {
                    person: true,
                    product: true,
                  },
                },
                one_off_purchase_header: {
                  include: {
                    person: true,
                    purchase_items: {
                      include: {
                        product: true,
                      },
                    },
                  },
                },
                cancellation_order: {
                  include: {
                    customer_subscription: {
                      include: {
                        person: true,
                      },
                    },
                  },
                },
                cycle_payment: {
                  include: {
                    subscription_cycle: {
                      include: {
                        customer_subscription: {
                          include: {
                            person: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        });

        // Crear los detalles de la hoja de ruta con MERGE de cobranzas:
        // 1) Crear detalles de pedidos (order_id) y mapear persona -> detalle
        // 2) Crear detalles one-off y otros normalmente
        // 3) Para cycle_payment, si existe detalle de pedido del mismo cliente, asociar en ese detalle en vez de crear uno nuevo

        const orderDetails = validatedDetails.filter((d) => d.order_id);
        const cycleDetails = validatedDetails.filter((d) => d.cycle_payment_id);
        const otherDetails = validatedDetails.filter(
          (d) => !d.order_id && !d.cycle_payment_id,
        );

        // Mapa persona -> detalle creado para pedidos
        const personToDetailId = new Map<number, number>();

        // Pre-cargar personas de pedidos
        const orderIds = orderDetails
          .map((d) => d.order_id)
          .filter((id, idx, arr) => arr.indexOf(id) === idx);
        const ordersWithCustomer = orderIds.length
          ? await tx.order_header.findMany({
              where: { order_id: { in: orderIds } },
              include: { customer: true },
            })
          : [];
        const orderIdToPersonId = new Map<number, number>();
        for (const o of ordersWithCustomer) {
          orderIdToPersonId.set(o.order_id, o.customer.person_id);
        }

        // 1) Crear detalles de pedidos y llenar mapa persona -> detalle
        for (const detail of orderDetails) {
          const created = await tx.route_sheet_detail.create({
            data: {
              route_sheet_id: routeSheet.route_sheet_id,
              order_id: detail.order_id,
              delivery_status: detail.delivery_status,
              delivery_time: detail.delivery_time || undefined,
              comments: detail.comments,
            },
          });
          const personId = orderIdToPersonId.get(detail.order_id);
          if (personId) {
            personToDetailId.set(personId, created.route_sheet_detail_id);
          }
        }

        // 2) Crear otros detalles (one-off, headers, etc.)
        for (const detail of otherDetails) {
          await tx.route_sheet_detail.create({
            data: {
              route_sheet_id: routeSheet.route_sheet_id,
              one_off_purchase_id: detail.one_off_purchase_id || undefined,
              one_off_purchase_header_id:
                detail.one_off_purchase_header_id || undefined,
              delivery_status: detail.delivery_status,
              delivery_time: detail.delivery_time || undefined,
              comments: detail.comments,
            },
          });
        }

        // Pre-cargar personas de cobranzas
        const cyclePaymentIds = cycleDetails
          .map((d) => d.cycle_payment_id)
          .filter((id, idx, arr) => arr.indexOf(id) === idx);
        const cyclePayments = cyclePaymentIds.length
          ? await tx.cycle_payment.findMany({
              where: { payment_id: { in: cyclePaymentIds } },
              include: {
                subscription_cycle: {
                  include: { customer_subscription: true },
                },
              },
            })
          : [];
        const cyclePaymentIdToPersonId = new Map<number, number>();
        for (const cp of cyclePayments) {
          const personId =
            cp.subscription_cycle.customer_subscription.customer_id;
          if (personId) cyclePaymentIdToPersonId.set(cp.payment_id, personId);
        }

        // 3) Asociar cobranzas al detalle de pedido del mismo cliente si existe; si no, crear detalle nuevo
        for (const detail of cycleDetails) {
          const personId = cyclePaymentIdToPersonId.get(
            detail.cycle_payment_id,
          );
          const existingDetailId = personId
            ? personToDetailId.get(personId)
            : undefined;

          if (existingDetailId) {
            const existing = await tx.route_sheet_detail.findUnique({
              where: { route_sheet_detail_id: existingDetailId },
              select: { cycle_payment_id: true },
            });
            if (!existing?.cycle_payment_id) {
              await tx.route_sheet_detail.update({
                where: { route_sheet_detail_id: existingDetailId },
                data: {
                  cycle_payment_id: detail.cycle_payment_id,
                },
              });
            } else {
              await tx.route_sheet_detail.create({
                data: {
                  route_sheet_id: routeSheet.route_sheet_id,
                  cycle_payment_id: detail.cycle_payment_id,
                  delivery_status: detail.delivery_status,
                  delivery_time: detail.delivery_time || undefined,
                  comments: detail.comments,
                },
              });
            }
          } else {
            await tx.route_sheet_detail.create({
              data: {
                route_sheet_id: routeSheet.route_sheet_id,
                cycle_payment_id: detail.cycle_payment_id,
                delivery_status: detail.delivery_status,
                delivery_time: detail.delivery_time || undefined,
                comments: detail.comments,
              },
            });
          }
        }

        // 🆕 CORRECCIÓN: Cambiar estado de órdenes de PENDING a READY_FOR_DELIVERY al asignar a hoja de ruta
        const orderIdsToUpdate = validatedDetails
          .filter((detail) => detail.order_id)
          .map((detail) => detail.order_id);

        if (orderIdsToUpdate.length > 0) {
          await tx.order_header.updateMany({
            where: {
              order_id: { in: orderIdsToUpdate },
              status: 'PENDING',
            },
            data: {
              status: 'READY_FOR_DELIVERY',
            },
          });
        }

        // 🆕 CORRECCIÓN: Cambiar estado de compras one-off (LEGACY) a READY_FOR_DELIVERY al asignar a hoja de ruta
        const oneOffIdsToUpdate = validatedDetails
          .filter((detail) => detail.one_off_purchase_id)
          .map((detail) => detail.one_off_purchase_id);

        if (oneOffIdsToUpdate.length > 0) {
          await tx.one_off_purchase.updateMany({
            where: {
              purchase_id: { in: oneOffIdsToUpdate },
              status: 'PENDING',
            },
            data: {
              status: 'READY_FOR_DELIVERY',
            },
          });
        }

        // 🆕 CORRECCIÓN: Cambiar estado de compras one-off con header a READY_FOR_DELIVERY al asignar a hoja de ruta
        const oneOffHeaderIdsToUpdate = validatedDetails
          .filter((detail) => detail.one_off_purchase_header_id)
          .map((detail) => detail.one_off_purchase_header_id);

        if (oneOffHeaderIdsToUpdate.length > 0) {
          await tx.one_off_purchase_header.updateMany({
            where: {
              purchase_header_id: { in: oneOffHeaderIdsToUpdate },
              status: 'PENDING',
            },
            data: {
              status: 'READY_FOR_DELIVERY',
            },
          });
        }

        // Obtener la hoja de ruta completa con los detalles
        return await tx.route_sheet.findUniqueOrThrow({
          where: { route_sheet_id: routeSheet.route_sheet_id },
          include: {
            driver: true,
            vehicle: {
              include: {
                vehicle_zone: {
                  where: { is_active: true },
                  include: {
                    zone: {
                      include: {
                        locality: {
                          include: {
                            province: {
                              include: {
                                country: true,
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            route_sheet_detail: {
              include: {
                order_header: {
                  include: {
                    customer: true,
                    customer_subscription: {
                      include: {
                        subscription_cycle: {
                          orderBy: { cycle_number: 'desc' },
                          take: 1,
                        },
                      },
                    },
                    order_item: {
                      include: {
                        product: true,
                      },
                    },
                  },
                },
                one_off_purchase: {
                  include: {
                    person: true,
                    product: true,
                  },
                },
                one_off_purchase_header: {
                  include: {
                    person: true,
                    purchase_items: {
                      include: {
                        product: true,
                      },
                    },
                  },
                },
                cancellation_order: {
                  include: {
                    customer_subscription: {
                      include: {
                        person: true,
                      },
                    },
                  },
                },
                cycle_payment: {
                  include: {
                    subscription_cycle: {
                      include: {
                        customer_subscription: {
                          include: {
                            person: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        });
      });
      return await this.mapToRouteSheetResponseDto(result, selectedZoneIds);
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      handlePrismaError(error, this.entityName);
      throw new InternalServerErrorException(
        'Error no manejado después de handlePrismaError',
      );
    }
  }

  async findAll(filters?: FilterRouteSheetsDto): Promise<{
    data: RouteSheetResponseDto[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    try {
      const whereClause: Prisma.route_sheetWhereInput = {
        is_active: true, // Solo mostrar hojas de ruta activas
      };
      const page = filters?.page || 1;
      const limit = filters?.limit || 10;
      const skip = (Math.max(1, page) - 1) * Math.max(1, limit);
      const take = Math.max(1, limit);

      if (filters) {
        if (filters.driver_id) {
          whereClause.driver_id = filters.driver_id;
        }
        if (filters.vehicle_id) {
          whereClause.vehicle_id = filters.vehicle_id;
        }
        if (filters.from_date || filters.to_date) {
          whereClause.delivery_date = {};
        }
        if (
          filters.from_date &&
          typeof whereClause.delivery_date === 'object'
        ) {
          const rawFrom = String(filters.from_date).trim();
          const fromDate = /^\d{4}-\d{2}-\d{2}$/.test(rawFrom)
            ? parseYMD(rawFrom)
            : new Date(filters.from_date);
          fromDate.setHours(0, 0, 0, 0);
          (whereClause.delivery_date as Prisma.DateTimeFilter).gte = fromDate;
        }
        if (filters.to_date && typeof whereClause.delivery_date === 'object') {
          const rawTo = String(filters.to_date).trim();
          const toDate = /^\d{4}-\d{2}-\d{2}$/.test(rawTo)
            ? parseYMD(rawTo)
            : new Date(filters.to_date);
          toDate.setHours(23, 59, 59, 999);
          (whereClause.delivery_date as Prisma.DateTimeFilter).lte = toDate;
        }
      }

      const orderByClause = parseSortByString(filters?.sortBy, [
        { delivery_date: 'desc' },
      ]);
      const totalCount = await this.route_sheet.count({ where: whereClause });
      const routeSheets = await this.route_sheet.findMany({
        where: whereClause,
        include: {
          driver: true,
          vehicle: {
            include: {
              vehicle_zone: {
                where: { is_active: true },
                include: {
                  zone: {
                    include: {
                      locality: {
                        include: {
                          province: {
                            include: {
                              country: true,
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          route_sheet_detail: {
            include: {
              order_header: {
                include: {
                  customer: { include: { zone: true, locality: true } },
                  customer_subscription: {
                    include: {
                      subscription_cycle: {
                        orderBy: { cycle_number: 'desc' },
                        take: 1,
                      },
                    },
                  },
                  order_item: {
                    include: {
                      product: true,
                    },
                  },
                },
              },
              one_off_purchase: {
                include: {
                  person: true,
                  product: true,
                },
              },
              one_off_purchase_header: {
                include: {
                  person: true,
                  purchase_items: {
                    include: {
                      product: true,
                    },
                  },
                },
              },
              cancellation_order: {
                include: {
                  customer_subscription: {
                    include: {
                      person: true,
                    },
                  },
                },
              },
              cycle_payment: {
                include: {
                  subscription_cycle: {
                    include: {
                      customer_subscription: {
                        include: {
                          person: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: orderByClause,
        skip,
        take: limit,
      });

      const data = await Promise.all(
        routeSheets.map((routeSheet) =>
          this.mapToRouteSheetResponseDto(routeSheet),
        ),
      );

      return {
        data,
        meta: {
          total: totalCount,
          page,
          limit,
          totalPages: Math.ceil(totalCount / take),
        },
      };
    } catch (error) {
      handlePrismaError(error, `${this.entityName}s`);
      throw new InternalServerErrorException(
        'Error no manejado después de handlePrismaError',
      );
    }
  }

  async findOne(
    id: number,
    includeInactive: boolean = false,
  ): Promise<RouteSheetResponseDto> {
    const routeSheet = await this.route_sheet.findFirst({
      where: {
        route_sheet_id: id,
        ...(includeInactive ? {} : { is_active: true }),
      },
      include: {
        driver: true,
        vehicle: {
          include: {
            vehicle_zone: {
              where: { is_active: true },
              include: {
                zone: {
                  include: {
                    locality: {
                      include: {
                        province: {
                          include: {
                            country: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        route_sheet_detail: {
          include: {
            order_header: {
              include: {
                customer: { include: { zone: true, locality: true } },
                customer_subscription: {
                  include: {
                    subscription_cycle: {
                      orderBy: { cycle_number: 'desc' },
                      take: 1,
                    },
                  },
                },
                order_item: {
                  include: {
                    product: true,
                  },
                },
              },
            },
            one_off_purchase: {
              include: {
                person: true,
                product: true,
              },
            },
            one_off_purchase_header: {
              include: {
                person: true,
                purchase_items: {
                  include: {
                    product: true,
                  },
                },
              },
            },
            cancellation_order: {
              include: {
                customer_subscription: {
                  include: {
                    person: true,
                  },
                },
              },
            },
            cycle_payment: {
              include: {
                subscription_cycle: {
                  include: {
                    customer_subscription: {
                      include: {
                        person: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!routeSheet) {
      throw new NotFoundException(
        `${this.entityName} con ID ${id} no encontrada`,
      );
    }
    return await this.mapToRouteSheetResponseDto(routeSheet);
  }

  async update(
    id: number,
    updateRouteSheetDto: UpdateRouteSheetDto,
  ): Promise<RouteSheetResponseDto> {
    await this.findOne(id);
    const {
      driver_id,
      vehicle_id,
      delivery_date,
      route_notes,
      details,
      zone_ids,
    } = updateRouteSheetDto;

    try {
      if (driver_id) {
        const driver = await this.user.findUnique({ where: { id: driver_id } });
        if (!driver) {
          throw new BadRequestException(
            `El conductor con ID ${driver_id} no existe`,
          );
        }
      }

      if (vehicle_id) {
        const vehicle = await this.vehicle.findUnique({
          where: { vehicle_id },
        });
        if (!vehicle) {
          throw new BadRequestException(
            `El vehículo con ID ${vehicle_id} no existe`,
          );
        }
      }

      const result = await this.$transaction(async (tx) => {
        const updateData: Prisma.route_sheetUpdateInput = {};
        if (driver_id) updateData.driver = { connect: { id: driver_id } };
        if (vehicle_id) updateData.vehicle = { connect: { vehicle_id } };
        if (delivery_date) {
          updateData.delivery_date =
            typeof delivery_date === 'string' &&
            /^\d{4}-\d{2}-\d{2}$/.test(delivery_date.trim())
              ? parseYMD(delivery_date.trim())
              : new Date(delivery_date);
        }
        if (route_notes !== undefined) updateData.route_notes = route_notes;

        const updatedRouteSheet = await tx.route_sheet.update({
          where: { route_sheet_id: id },
          data: updateData,
          include: {
            driver: true,
            vehicle: {
              include: {
                vehicle_zone: {
                  where: { is_active: true },
                  include: {
                    zone: {
                      include: {
                        locality: {
                          include: {
                            province: {
                              include: {
                                country: true,
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            route_sheet_detail: {
              include: {
                order_header: {
                  include: {
                    customer: true,
                    customer_subscription: {
                      include: {
                        subscription_cycle: {
                          orderBy: { cycle_number: 'desc' },
                          take: 1,
                        },
                      },
                    },
                    order_item: {
                      include: {
                        product: true,
                      },
                    },
                  },
                },
                one_off_purchase: {
                  include: {
                    person: true,
                    product: true,
                  },
                },
                one_off_purchase_header: {
                  include: {
                    person: true,
                    purchase_items: {
                      include: {
                        product: true,
                      },
                    },
                  },
                },
                cancellation_order: {
                  include: {
                    customer_subscription: {
                      include: {
                        person: true,
                      },
                    },
                  },
                },
                cycle_payment: {
                  include: {
                    subscription_cycle: {
                      include: {
                        customer_subscription: {
                          include: {
                            person: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        });

        // Validación de zonas contra zonas asignadas al vehículo y zone_ids opcional
        const assignedZoneIds = (
          updatedRouteSheet.vehicle.vehicle_zone || []
        ).map((vz) => vz.zone.zone_id);
        const selectedZoneIds = (zone_ids || []).map((z) => Number(z));
        if (selectedZoneIds.length > 0) {
          const invalid = selectedZoneIds.filter(
            (z) => !assignedZoneIds.includes(z),
          );
          if (invalid.length > 0) {
            throw new BadRequestException(
              `Las zonas ${invalid.join(', ')} no están asignadas al vehículo o están inactivas`,
            );
          }
        }

        if (details && details.length > 0) {
          const orderIdsToUpdate: number[] = [];
          const oneOffIdsToUpdate: number[] = [];
          const oneOffHeaderIdsToUpdate: number[] = [];
          const detailZoneIds: number[] = [];

          for (const detail of details) {
            if (detail.route_sheet_detail_id) {
              const existing = await tx.route_sheet_detail.findUnique({
                where: { route_sheet_detail_id: detail.route_sheet_detail_id },
                select: {
                  order_id: true,
                  one_off_purchase_id: true,
                  one_off_purchase_header_id: true,
                },
              });

              await tx.route_sheet_detail.update({
                where: { route_sheet_detail_id: detail.route_sheet_detail_id },
                data: {
                  delivery_status: detail.delivery_status,
                  delivery_time: detail.delivery_time || undefined,
                  comments: detail.comments,
                },
              });

              // Marcar para actualizar estado según el tipo que tenga el detalle existente
              if (existing?.order_id) orderIdsToUpdate.push(existing.order_id);
              if (existing?.one_off_purchase_id)
                oneOffIdsToUpdate.push(existing.one_off_purchase_id);
              if (existing?.one_off_purchase_header_id)
                oneOffHeaderIdsToUpdate.push(
                  existing.one_off_purchase_header_id,
                );
            } else if (detail.order_id) {
              const order = await tx.order_header.findUnique({
                where: { order_id: detail.order_id },
                include: { customer: true },
              });
              if (!order) {
                throw new BadRequestException(
                  `El pedido con ID ${detail.order_id} no existe`,
                );
              }

              const existingAssignment = await tx.route_sheet_detail.findFirst({
                where: {
                  order_id: detail.order_id,
                  route_sheet: {
                    is: {
                      delivery_date: updatedRouteSheet.delivery_date,
                      route_sheet_id: { not: id },
                      is_active: true,
                    },
                  },
                },
              });

              if (existingAssignment) {
                throw new BadRequestException(
                  `El pedido ${detail.order_id} ya está asignado a otra hoja de ruta para esa fecha`,
                );
              }

              await tx.route_sheet_detail.create({
                data: {
                  route_sheet_id: id,
                  order_id: detail.order_id,
                  delivery_status:
                    detail.delivery_status || DeliveryStatus.PENDING,
                  delivery_time: detail.delivery_time || undefined,
                  comments: detail.comments,
                },
              });

              // Capturar zone_id del pedido para validación
              const orderZoneId =
                (order as any).zone_id ?? order.customer.zone_id ?? null;
              if (typeof orderZoneId === 'number')
                detailZoneIds.push(orderZoneId);
              // Marcar para actualizar estado
              orderIdsToUpdate.push(detail.order_id);
            } else if (detail.one_off_purchase_id) {
              const purchase = await tx.one_off_purchase.findUnique({
                where: { purchase_id: detail.one_off_purchase_id },
                include: { person: true },
              });
              if (!purchase) {
                throw new BadRequestException(
                  `La compra one-off con ID ${detail.one_off_purchase_id} no existe`,
                );
              }

              const existingAssignment = await tx.route_sheet_detail.findFirst({
                where: {
                  one_off_purchase_id: detail.one_off_purchase_id,
                  route_sheet: {
                    is: {
                      delivery_date: updatedRouteSheet.delivery_date,
                      route_sheet_id: { not: id },
                      is_active: true,
                    },
                  },
                },
              });
              if (existingAssignment) {
                throw new BadRequestException(
                  `La compra one-off ${detail.one_off_purchase_id} ya está asignada a otra hoja de ruta para esa fecha`,
                );
              }

              await tx.route_sheet_detail.create({
                data: {
                  route_sheet_id: id,
                  one_off_purchase_id: detail.one_off_purchase_id,
                  delivery_status:
                    detail.delivery_status || DeliveryStatus.PENDING,
                  delivery_time: detail.delivery_time || undefined,
                  comments: detail.comments,
                },
              });

              const purchaseZoneId =
                (purchase as any).zone_id ?? purchase.person.zone_id ?? null;
              if (typeof purchaseZoneId === 'number')
                detailZoneIds.push(purchaseZoneId);
              oneOffIdsToUpdate.push(detail.one_off_purchase_id);
            } else if (detail.one_off_purchase_header_id) {
              const header = await tx.one_off_purchase_header.findUnique({
                where: {
                  purchase_header_id: detail.one_off_purchase_header_id,
                },
                include: { person: true },
              });
              if (!header) {
                throw new BadRequestException(
                  `La compra one-off (header) con ID ${detail.one_off_purchase_header_id} no existe`,
                );
              }

              const existingAssignment = await tx.route_sheet_detail.findFirst({
                where: {
                  one_off_purchase_header_id: detail.one_off_purchase_header_id,
                  route_sheet: {
                    is: {
                      delivery_date: updatedRouteSheet.delivery_date,
                      route_sheet_id: { not: id },
                      is_active: true,
                    },
                  },
                },
              });
              if (existingAssignment) {
                throw new BadRequestException(
                  `La compra one-off (header) ${detail.one_off_purchase_header_id} ya está asignada a otra hoja de ruta para esa fecha`,
                );
              }

              await tx.route_sheet_detail.create({
                data: {
                  route_sheet_id: id,
                  one_off_purchase_header_id: detail.one_off_purchase_header_id,
                  delivery_status:
                    detail.delivery_status || DeliveryStatus.PENDING,
                  delivery_time: detail.delivery_time || undefined,
                  comments: detail.comments,
                },
              });

              const headerZoneId =
                (header as any).zone_id ?? header.person.zone_id ?? null;
              if (typeof headerZoneId === 'number')
                detailZoneIds.push(headerZoneId);
              oneOffHeaderIdsToUpdate.push(detail.one_off_purchase_header_id);
            } else if (detail.cycle_payment_id) {
              const cp = await tx.cycle_payment.findUnique({
                where: { payment_id: detail.cycle_payment_id },
                include: {
                  subscription_cycle: {
                    include: {
                      customer_subscription: { include: { person: true } },
                    },
                  },
                },
              });
              if (!cp) {
                throw new BadRequestException(
                  `El pago de ciclo con ID ${detail.cycle_payment_id} no existe`,
                );
              }

              await tx.route_sheet_detail.create({
                data: {
                  route_sheet_id: id,
                  cycle_payment_id: detail.cycle_payment_id,
                  delivery_status:
                    detail.delivery_status || DeliveryStatus.PENDING,
                  delivery_time: detail.delivery_time || undefined,
                  comments: detail.comments,
                },
              });

              const cpZoneId =
                cp.subscription_cycle.customer_subscription.person.zone_id ??
                null;
              if (typeof cpZoneId === 'number') detailZoneIds.push(cpZoneId);
            }
          }

          // Si se especificaron zone_ids, validar que todos los detalles caen dentro de esas zonas
          if (selectedZoneIds.length > 0) {
            const outOfSelection = detailZoneIds.filter(
              (zid) => !selectedZoneIds.includes(zid),
            );
            if (outOfSelection.length > 0) {
              throw new BadRequestException(
                `Los detalles incluyen zonas no seleccionadas: ${outOfSelection.join(', ')}`,
              );
            }
          }

          // Actualizar estados de pedidos a READY_FOR_DELIVERY (cuando estaban PENDING)
          if (orderIdsToUpdate.length > 0) {
            await tx.order_header.updateMany({
              where: { order_id: { in: orderIdsToUpdate }, status: 'PENDING' },
              data: { status: 'READY_FOR_DELIVERY' },
            });
          }
          if (oneOffIdsToUpdate.length > 0) {
            await tx.one_off_purchase.updateMany({
              where: {
                purchase_id: { in: oneOffIdsToUpdate },
                status: 'PENDING',
              },
              data: { status: 'READY_FOR_DELIVERY' },
            });
          }
          if (oneOffHeaderIdsToUpdate.length > 0) {
            await tx.one_off_purchase_header.updateMany({
              where: {
                purchase_header_id: { in: oneOffHeaderIdsToUpdate },
                status: 'PENDING',
              },
              data: { status: 'READY_FOR_DELIVERY' },
            });
          }
        }
        return await tx.route_sheet.findUniqueOrThrow({
          where: { route_sheet_id: id },
          include: {
            driver: true,
            vehicle: {
              include: {
                vehicle_zone: {
                  where: { is_active: true },
                  include: {
                    zone: {
                      include: {
                        locality: {
                          include: {
                            province: {
                              include: {
                                country: true,
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            route_sheet_detail: {
              include: {
                order_header: {
                  include: {
                    customer: true,
                    customer_subscription: {
                      include: {
                        subscription_cycle: {
                          orderBy: { cycle_number: 'desc' },
                          take: 1,
                        },
                      },
                    },
                    order_item: {
                      include: {
                        product: true,
                      },
                    },
                  },
                },
                one_off_purchase: {
                  include: {
                    person: true,
                    product: true,
                  },
                },
                one_off_purchase_header: {
                  include: {
                    person: true,
                    purchase_items: {
                      include: {
                        product: true,
                      },
                    },
                  },
                },
                cancellation_order: {
                  include: {
                    customer_subscription: {
                      include: {
                        person: true,
                      },
                    },
                  },
                },
                cycle_payment: {
                  include: {
                    subscription_cycle: {
                      include: {
                        customer_subscription: {
                          include: {
                            person: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        });
      });
      // Pasar zone_ids seleccionadas para que zones_covered respete el payload del PATCH
      return await this.mapToRouteSheetResponseDto(result, zone_ids);
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      )
        throw error;
      handlePrismaError(error, this.entityName);
      throw new InternalServerErrorException(
        'Error no manejado después de handlePrismaError',
      );
    }
  }

  async remove(id: number): Promise<{ message: string; deleted: boolean }> {
    await this.findOne(id);
    try {
      await this.$transaction(async (tx) => {
        // Obtener IDs de pedidos asociados a la hoja de ruta
        const details = await tx.route_sheet_detail.findMany({
          where: { route_sheet_id: id },
          select: {
            order_id: true,
            one_off_purchase_id: true,
            one_off_purchase_header_id: true,
          },
        });

        const orderIds: number[] = [];
        const oneOffIds: number[] = [];
        const oneOffHeaderIds: number[] = [];

        for (const d of details) {
          if (typeof d.order_id === 'number') orderIds.push(d.order_id);
          if (typeof d.one_off_purchase_id === 'number')
            oneOffIds.push(d.one_off_purchase_id);
          if (typeof d.one_off_purchase_header_id === 'number')
            oneOffHeaderIds.push(d.one_off_purchase_header_id);
        }

        // Revertir estados a PENDING para todos los pedidos involucrados
        if (orderIds.length > 0) {
          await tx.order_header.updateMany({
            where: { order_id: { in: orderIds } },
            data: { status: 'PENDING' },
          });
        }
        if (oneOffIds.length > 0) {
          await tx.one_off_purchase.updateMany({
            where: { purchase_id: { in: oneOffIds } },
            data: { status: 'PENDING' },
          });
        }
        if (oneOffHeaderIds.length > 0) {
          await tx.one_off_purchase_header.updateMany({
            where: { purchase_header_id: { in: oneOffHeaderIds } },
            data: { status: 'PENDING' },
          });
        }

        // Soft delete: cambiar is_active a false en lugar de eliminar físicamente
        await tx.route_sheet.update({
          where: { route_sheet_id: id },
          data: { is_active: false },
        });
      });

      return {
        message: `${this.entityName} con ID ${id} desactivada y pedidos revertidos a PENDING`,
        deleted: true,
      };
    } catch (error) {
      handlePrismaError(error, this.entityName);
      throw new InternalServerErrorException(
        'Error no manejado después de handlePrismaError',
      );
    }
  }

  async generatePrintableDocument(
    route_sheet_id: number,
    options?: any,
  ): Promise<{ url: string; filename: string }> {
    try {
      const routeSheet = await this.findOne(route_sheet_id);
      // Convertir RouteSheetResponseDto a RouteSheetPdfData
      const pdfData: RouteSheetPdfData = {
        route_sheet_id: routeSheet.route_sheet_id,
        delivery_date: routeSheet.delivery_date,
        driver: {
          id: routeSheet.driver.id,
          name: routeSheet.driver.name,
          email: routeSheet.driver.email,
        },
        vehicle: {
          vehicle_id: routeSheet.vehicle.vehicle_id,
          code: routeSheet.vehicle.code,
          name: routeSheet.vehicle.name,
          zones: routeSheet.vehicle.zones || [],
        },
        zone_identifiers: (routeSheet as any).zones_covered
          ? (routeSheet as any).zones_covered.map((z: any) => z.name)
          : undefined,
        route_notes: routeSheet.route_notes,
        details: routeSheet.details
          .map((detail) => {
            // Solo procesar detalles que tengan orden de suscripción
            if (detail.order) {
              return {
                route_sheet_detail_id: detail.route_sheet_detail_id,
                route_sheet_id: routeSheet.route_sheet_id,
                order: {
                  order_id: detail.order.order_id,
                  order_date:
                    detail.order.order_date || formatBATimestampISO(new Date()),
                  total_amount: detail.order.total_amount?.toString() || '0',
                  debt_amount:
                    (detail.order as any).debt_amount?.toString() || undefined,
                  status: detail.order.status || 'PENDING',
                  subscription_id: (detail.order as any).subscription_id,
                  subscription_due_date: (detail.order as any)
                    .subscription_due_date,
                  all_due_dates: (detail.order as any).all_due_dates,
                  collection_days: (detail.order as any).collection_days,
                  customer: {
                    person_id: detail.order.customer.person_id || 0,
                    name: detail.order.customer.name,
                    alias: detail.order.customer.alias,
                    address: detail.order.customer.address,
                    phone: detail.order.customer.phone,
                    locality: detail.order.customer.locality
                      ? {
                          locality_id:
                            detail.order.customer.locality.locality_id,
                          code: detail.order.customer.locality.code,
                          name: detail.order.customer.locality.name,
                        }
                      : undefined,
                    special_instructions:
                      detail.order.customer.special_instructions,
                  },
                  items: detail.order.items.map((item) => ({
                    order_item_id: item.order_item_id || 0,
                    quantity: item.quantity,
                    delivered_quantity: item.delivered_quantity || 0,
                    returned_quantity: item.returned_quantity || 0,
                    product: {
                      product_id: item.product.product_id || 0,
                      description: item.product.description,
                    },
                  })),
                  notes: detail.order.notes,
                },
                delivery_status: detail.delivery_status,
                delivery_time: detail.delivery_time || '08:00-18:00',
                is_current_delivery: detail.is_current_delivery ?? true,
                credits: detail.credits || [],
              };
            }
            // Si no hay orden de suscripción, devolver null y filtrar después
            return null;
          })
          .filter((detail) => detail !== null),
        zones_covered: routeSheet.zones_covered || [],
      };
      const pdfLogPayload = {
        route_sheet_id: pdfData.route_sheet_id,
        delivery_date: pdfData.delivery_date,
        details: pdfData.details.map((detail) => ({
          order_id: detail.order.order_id,
          collection_days: detail.order.collection_days ?? [],
        })),
      };
      this.logger.log(`Hoja de ruta PDF data: ${JSON.stringify(pdfLogPayload)}`);
      // Generar PDF usando el servicio común
      const { doc, filename, pdfPath } =
        await this.pdfGeneratorService.generateRouteSheetPdf(pdfData, options);
      const writeStream = fs.createWriteStream(pdfPath);
      doc.pipe(writeStream);

      // Finalizar el PDF
      const result = await this.pdfGeneratorService.finalizePdf(
        doc,
        writeStream,
        filename,
      );

      this.logger.log(`Hoja de ruta PDF result: ${JSON.stringify(result)}`);
      return result;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      console.error(
        `Error al generar PDF para ${this.entityName} ${route_sheet_id}:`,
        error,
      );
      throw new InternalServerErrorException(
        `Error al generar PDF para ${this.entityName} ${route_sheet_id}`,
      );
    }
  }

  private async mapToRouteSheetResponseDto(
    routeSheet: RouteSheetWithDetails,
    selectedZoneIds?: number[],
  ): Promise<RouteSheetResponseDto> {
    const driverDto: DriverDto = {
      id: routeSheet.driver.id,
      name: routeSheet.driver.name,
      email: routeSheet.driver.email,
    };

    const vehicleDto: VehicleDto = {
      vehicle_id: routeSheet.vehicle.vehicle_id,
      code: routeSheet.vehicle.code,
      name: routeSheet.vehicle.name,
      zones:
        routeSheet.vehicle.vehicle_zone?.map((vz) => ({
          zone_id: vz.zone.zone_id,
          code: vz.zone.code,
          name: vz.zone.name,
          locality: {
            locality_id: vz.zone.locality.locality_id,
            code: vz.zone.locality.code,
            name: vz.zone.locality.name,
            province: {
              province_id: vz.zone.locality.province.province_id,
              code: vz.zone.locality.province.code,
              name: vz.zone.locality.province.name,
              country: {
                country_id: vz.zone.locality.province.country.country_id,
                code: vz.zone.locality.province.country.code,
                name: vz.zone.locality.province.country.name,
              },
            },
          },
        })) || [],
    };

    const sortedDetails = [...routeSheet.route_sheet_detail]
      .map((d, idx) => ({ d, idx }))
      .sort((a, b) => {
        const as = a.d.sequence_number;
        const bs = b.d.sequence_number;
        if (as === null || as === undefined) return 1;
        if (bs === null || bs === undefined) return -1;
        return as - bs;
      });

    const getPersonId = (detail: any): number | null => {
      if (detail.order_header)
        return detail.order_header.customer.person_id ?? null;
      if (detail.one_off_purchase)
        return detail.one_off_purchase.person.person_id ?? null;
      if (detail.one_off_purchase_header)
        return detail.one_off_purchase_header.person.person_id ?? null;
      if (detail.cancellation_order)
        return (
          detail.cancellation_order.customer_subscription.person.person_id ??
          null
        );
      if (detail.cycle_payment)
        return (
          detail.cycle_payment.subscription_cycle.customer_subscription.person
            .person_id ?? null
        );
      return null;
    };

    const firstIndexByPerson = new Map<number, number>();
    for (const item of sortedDetails) {
      const pid = getPersonId(item.d);
      if (typeof pid === 'number' && !firstIndexByPerson.has(pid)) {
        firstIndexByPerson.set(pid, item.idx);
      }
    }

    const collectionDaysByPerson = new Map<number, number[]>();

    const groupedDetails = sortedDetails
      .slice()
      .sort((a, b) => {
        const pa = getPersonId(a.d);
        const pb = getPersonId(b.d);
        const fa = typeof pa === 'number' ? firstIndexByPerson.get(pa) : a.idx;
        const fb = typeof pb === 'number' ? firstIndexByPerson.get(pb) : b.idx;
        if (fa !== fb) return fa - fb;
        return a.idx - b.idx;
      })
      .map((x) => x.d);

    // Calcular zonas cubiertas: si se especifican zone_ids, usar esas; caso contrario, derivar de los detalles
    let zonesCoveredDto: ZoneDto[] = [];
    if (selectedZoneIds && selectedZoneIds.length > 0) {
      zonesCoveredDto = (vehicleDto.zones || []).filter((z) =>
        selectedZoneIds.includes(z.zone_id),
      );
    } else {
      const coveredZoneIds = new Set<number>();
      for (const d of groupedDetails) {
        let zid: number | null = null;
        if (d.order_header) {
          zid =
            (d.order_header as any).zone_id ??
            d.order_header.customer.zone_id ??
            null;
        } else if (d.one_off_purchase) {
          zid =
            (d.one_off_purchase as any).zone_id ??
            d.one_off_purchase.person.zone_id ??
            null;
        } else if (d.one_off_purchase_header) {
          zid =
            (d.one_off_purchase_header as any).zone_id ??
            d.one_off_purchase_header.person.zone_id ??
            null;
        } else if (d.cancellation_order) {
          zid =
            d.cancellation_order.customer_subscription.person.zone_id ?? null;
        } else if (d.cycle_payment) {
          zid =
            d.cycle_payment.subscription_cycle.customer_subscription.person
              .zone_id ?? null;
        }
        if (typeof zid === 'number') coveredZoneIds.add(zid);
      }
      zonesCoveredDto = (vehicleDto.zones || []).filter((z) =>
        coveredZoneIds.has(z.zone_id),
      );
    }

    let currentDeliveryFound = false;
    const detailsDto: RouteSheetDetailResponseDto[] = await Promise.all(
      groupedDetails.map(async (detail) => {
        let customerDto: CustomerDto;
        let orderDto: OrderDto;

        // Determinar el tipo de orden y mapear los datos correspondientes
        if (detail.order_header) {
          // Orden de suscripción
          customerDto = {
            person_id: detail.order_header.customer.person_id,
            name: detail.order_header.customer.name || 'Sin nombre',
            alias: detail.order_header.customer.alias || undefined,
            phone: detail.order_header.customer.phone,
            address: detail.order_header.customer.address || 'Sin dirección',
            zone: (detail.order_header.customer as any).zone
              ? {
                  zone_id: (detail.order_header.customer as any).zone.zone_id,
                  code: (detail.order_header.customer as any).zone.code,
                  name: (detail.order_header.customer as any).zone.name,
                }
              : undefined,
            locality: (detail.order_header.customer as any).locality
              ? {
                  locality_id: (detail.order_header.customer as any).locality
                    .locality_id,
                  code: (detail.order_header.customer as any).locality.code,
                  name: (detail.order_header.customer as any).locality.name,
                }
              : undefined,
            special_instructions:
              (detail.order_header as any).customer_subscription?.notes ||
              undefined,
          };

          const orderItemsDto: OrderItemDto[] =
            detail.order_header.order_item.map((item) => {
              const productDto: ProductDto = {
                product_id: item.product.product_id,
                description: item.product.description,
              };
              return {
                order_item_id: item.order_item_id,
                product: productDto,
                quantity: item.quantity,
                delivered_quantity: item.delivered_quantity || 0,
                returned_quantity: item.returned_quantity || 0,
              };
            });

          orderDto = {
            order_id: detail.order_header.order_id,
            order_date: formatBATimestampISO(detail.order_header.order_date),
            total_amount: detail.order_header.total_amount.toString(),
            debt_amount: (() => {
              const d = new Decimal(detail.order_header.total_amount).minus(
                new Decimal(detail.order_header.paid_amount),
              );
              return d.isNegative() ? '0.00' : d.toFixed(2);
            })(),
            status:
              detail.order_header.status === 'OVERDUE'
                ? 'ATRASADO'
                : detail.order_header.status,
            customer: customerDto,
            items: orderItemsDto,
            notes: detail.order_header.notes || undefined,
          };

          const customerId = customerDto.person_id;
          let cachedCollectionDays = collectionDaysByPerson.get(customerId);
          if (!cachedCollectionDays) {
            try {
              const subscriptions = await this.customer_subscription.findMany({
                where: {
                  customer_id: customerId,
                  is_active: true,
                  status: 'ACTIVE',
                  collection_day: { not: null },
                },
                select: { collection_day: true },
                orderBy: { collection_day: 'asc' },
              });
              cachedCollectionDays = subscriptions
                .map((sub) => sub.collection_day)
                .filter((day): day is number => typeof day === 'number');
            } catch {
              cachedCollectionDays = [];
            }
            collectionDaysByPerson.set(customerId, cachedCollectionDays);
          }
          if (cachedCollectionDays.length > 0) {
            orderDto.collection_days = cachedCollectionDays;
          }

          const cycle = (detail.order_header as any).customer_subscription
            ?.subscription_cycle?.[0];
          if (cycle?.payment_due_date) {
            orderDto.subscription_due_date = formatUTCYMD(
              cycle.payment_due_date,
            );
          }
          // Agregar todas las fechas de vencimiento pendientes para TODOS los abonos del cliente
          try {
            const unpaidCycles = await this.subscription_cycle.findMany({
              where: {
                customer_subscription: {
                  customer_id: customerDto.person_id,
                },
                payment_status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] },
              },
              select: { payment_due_date: true },
              orderBy: { payment_due_date: 'asc' },
            });
            orderDto.all_due_dates = unpaidCycles
              .map((c) => formatUTCYMD(c.payment_due_date))
              .filter((d) => !!d);
            orderDto.subscription_id = detail.order_header.subscription_id;
          } catch {
            // Ignorar errores de consulta y continuar
          }
        } else if (detail.one_off_purchase) {
          // Compra one-off individual
          customerDto = {
            person_id: detail.one_off_purchase.person.person_id,
            name: detail.one_off_purchase.person.name || 'Sin nombre',
            alias: detail.one_off_purchase.person.alias || undefined,
            phone: detail.one_off_purchase.person.phone,
            address: detail.one_off_purchase.person.address || 'Sin dirección',
            zone: (detail.one_off_purchase.person as any)?.zone
              ? {
                  zone_id: (detail.one_off_purchase.person as any).zone.zone_id,
                  code: (detail.one_off_purchase.person as any).zone.code,
                  name: (detail.one_off_purchase.person as any).zone.name,
                }
              : undefined,
            locality: (detail.one_off_purchase.person as any)?.locality
              ? {
                  locality_id: (detail.one_off_purchase.person as any).locality
                    .locality_id,
                  code: (detail.one_off_purchase.person as any).locality.code,
                  name: (detail.one_off_purchase.person as any).locality.name,
                }
              : undefined,
          };

          const productDto: ProductDto = {
            product_id: detail.one_off_purchase.product.product_id,
            description: detail.one_off_purchase.product.description,
          };

          const orderItemsDto: OrderItemDto[] = [
            {
              order_item_id: detail.one_off_purchase.purchase_id, // Usar purchase_id como identificador
              product: productDto,
              quantity: detail.one_off_purchase.quantity,
              delivered_quantity: 0, // Las compras one-off no tienen delivered_quantity
              returned_quantity: 0,
            },
          ];

          orderDto = {
            order_id: detail.one_off_purchase.purchase_id,
            order_date: formatBATimestampISO(
              detail.one_off_purchase.purchase_date,
            ),
            total_amount: detail.one_off_purchase.total_amount.toString(),
            debt_amount: (() => {
              const d = new Decimal(detail.one_off_purchase.total_amount).minus(
                new Decimal(detail.one_off_purchase.paid_amount),
              );
              return d.isNegative() ? '0.00' : d.toFixed(2);
            })(),
            status: detail.one_off_purchase.status,
            customer: customerDto,
            items: orderItemsDto,
          };
        } else if (detail.one_off_purchase_header) {
          // Compra one-off con header
          customerDto = {
            person_id: detail.one_off_purchase_header.person.person_id,
            name: detail.one_off_purchase_header.person.name || 'Sin nombre',
            alias: detail.one_off_purchase_header.person.alias || undefined,
            phone: detail.one_off_purchase_header.person.phone,
            address:
              detail.one_off_purchase_header.person.address || 'Sin dirección',
            zone: (detail.one_off_purchase_header.person as any)?.zone
              ? {
                  zone_id: (detail.one_off_purchase_header.person as any).zone
                    .zone_id,
                  code: (detail.one_off_purchase_header.person as any).zone
                    .code,
                  name: (detail.one_off_purchase_header.person as any).zone
                    .name,
                }
              : undefined,
            locality: (detail.one_off_purchase_header.person as any)?.locality
              ? {
                  locality_id: (detail.one_off_purchase_header.person as any)
                    .locality.locality_id,
                  code: (detail.one_off_purchase_header.person as any).locality
                    .code,
                  name: (detail.one_off_purchase_header.person as any).locality
                    .name,
                }
              : undefined,
          };

          const orderItemsDto: OrderItemDto[] = (
            detail.one_off_purchase_header?.purchase_items || []
          ).map((item) => {
            const productDto: ProductDto = {
              product_id: item.product.product_id,
              description: item.product.description,
            };
            return {
              order_item_id: item.purchase_item_id,
              product: productDto,
              quantity: item.quantity,
              delivered_quantity: 0, // Las compras one-off no tienen delivered_quantity
              returned_quantity: 0,
            };
          });

          orderDto = {
            order_id: detail.one_off_purchase_header.purchase_header_id,
            order_date: formatBATimestampISO(
              detail.one_off_purchase_header.purchase_date,
            ),
            total_amount:
              detail.one_off_purchase_header.total_amount.toString(),
            debt_amount: (() => {
              const d = new Decimal(
                detail.one_off_purchase_header.total_amount,
              ).minus(new Decimal(detail.one_off_purchase_header.paid_amount));
              return d.isNegative() ? '0.00' : d.toFixed(2);
            })(),
            status: detail.one_off_purchase_header.status,
            customer: customerDto,
            items: orderItemsDto,
          };
        } else if (detail.cancellation_order) {
          // Orden de cancelación
          customerDto = {
            person_id:
              detail.cancellation_order.customer_subscription.person.person_id,
            name:
              detail.cancellation_order.customer_subscription.person.name ||
              'Sin nombre',
            alias:
              detail.cancellation_order.customer_subscription.person.alias ||
              undefined,
            phone: detail.cancellation_order.customer_subscription.person.phone,
            address:
              detail.cancellation_order.customer_subscription.person.address ||
              'Sin dirección',
            zone: (
              detail.cancellation_order.customer_subscription.person as any
            )?.zone
              ? {
                  zone_id: (
                    detail.cancellation_order.customer_subscription
                      .person as any
                  ).zone.zone_id,
                  code: (
                    detail.cancellation_order.customer_subscription
                      .person as any
                  ).zone.code,
                  name: (
                    detail.cancellation_order.customer_subscription
                      .person as any
                  ).zone.name,
                }
              : undefined,
            locality: (
              detail.cancellation_order.customer_subscription.person as any
            )?.locality
              ? {
                  locality_id: (
                    detail.cancellation_order.customer_subscription
                      .person as any
                  ).locality.locality_id,
                  code: (
                    detail.cancellation_order.customer_subscription
                      .person as any
                  ).locality.code,
                  name: (
                    detail.cancellation_order.customer_subscription
                      .person as any
                  ).locality.name,
                }
              : undefined,
          };

          // Para órdenes de cancelación, no tenemos productos específicos
          const orderItemsDto: OrderItemDto[] = [];

          orderDto = {
            order_id: detail.cancellation_order.cancellation_order_id,
            order_date: formatBATimestampISO(
              detail.cancellation_order.scheduled_collection_date,
            ),
            total_amount: '0.00', // Las cancelaciones no tienen monto
            status: 'CANCELLED',
            customer: customerDto,
            items: orderItemsDto,
          };
        } else if (detail.cycle_payment) {
          // Pedido de cobranza
          customerDto = {
            person_id:
              detail.cycle_payment.subscription_cycle.customer_subscription
                .person.person_id,
            name:
              detail.cycle_payment.subscription_cycle.customer_subscription
                .person.name || 'Sin nombre',
            alias:
              detail.cycle_payment.subscription_cycle.customer_subscription
                .person.alias || undefined,
            phone:
              detail.cycle_payment.subscription_cycle.customer_subscription
                .person.phone,
            address:
              detail.cycle_payment.subscription_cycle.customer_subscription
                .person.address || 'Sin dirección',
            zone: (
              detail.cycle_payment.subscription_cycle.customer_subscription
                .person as any
            )?.zone
              ? {
                  zone_id: (
                    detail.cycle_payment.subscription_cycle
                      .customer_subscription.person as any
                  ).zone.zone_id,
                  code: (
                    detail.cycle_payment.subscription_cycle
                      .customer_subscription.person as any
                  ).zone.code,
                  name: (
                    detail.cycle_payment.subscription_cycle
                      .customer_subscription.person as any
                  ).zone.name,
                }
              : undefined,
            locality: (
              detail.cycle_payment.subscription_cycle.customer_subscription
                .person as any
            )?.locality
              ? {
                  locality_id: (
                    detail.cycle_payment.subscription_cycle
                      .customer_subscription.person as any
                  ).locality.locality_id,
                  code: (
                    detail.cycle_payment.subscription_cycle
                      .customer_subscription.person as any
                  ).locality.code,
                  name: (
                    detail.cycle_payment.subscription_cycle
                      .customer_subscription.person as any
                  ).locality.name,
                }
              : undefined,
            special_instructions:
              detail.cycle_payment.subscription_cycle.customer_subscription
                .notes || undefined,
          };

          // Para pedidos de cobranza, no tenemos productos específicos
          const orderItemsDto: OrderItemDto[] = [];

          orderDto = {
            order_id: detail.cycle_payment.payment_id,
            order_date: formatBATimestampISO(detail.cycle_payment.payment_date),
            total_amount: detail.cycle_payment.amount.toString(),
            status: 'PENDING', // Los cycle_payments no tienen status, usamos un valor por defecto
            customer: customerDto,
            items: orderItemsDto,
          };

          const customerId = customerDto.person_id;
          let cachedCollectionDays = collectionDaysByPerson.get(customerId);
          if (!cachedCollectionDays) {
            try {
              const subscriptions = await this.customer_subscription.findMany({
                where: {
                  customer_id: customerId,
                  is_active: true,
                  status: 'ACTIVE',
                  collection_day: { not: null },
                },
                select: { collection_day: true },
                orderBy: { collection_day: 'asc' },
              });
              cachedCollectionDays = subscriptions
                .map((sub) => sub.collection_day)
                .filter((day): day is number => typeof day === 'number');
            } catch {
              cachedCollectionDays = [];
            }
            collectionDaysByPerson.set(customerId, cachedCollectionDays);
          }
          if (cachedCollectionDays.length > 0) {
            orderDto.collection_days = cachedCollectionDays;
          }

          const due = detail.cycle_payment.subscription_cycle?.payment_due_date;
          if (due) {
            orderDto.subscription_due_date = formatUTCYMD(due as any);
          }
          // Agregar todas las fechas de vencimiento pendientes para TODOS los abonos del cliente
          try {
            const unpaidCycles = await this.subscription_cycle.findMany({
              where: {
                customer_subscription: {
                  customer_id: customerDto.person_id,
                },
                payment_status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] },
              },
              select: { payment_due_date: true },
              orderBy: { payment_due_date: 'asc' },
            });
            orderDto.all_due_dates = unpaidCycles
              .map((c) => formatUTCYMD(c.payment_due_date))
              .filter((d) => !!d);
          } catch {
            // Ignorar errores de consulta y continuar
          }
        } else {
          throw new Error('Detalle de hoja de ruta sin orden válida');
        }

        let isCurrent = false;
        if (
          !currentDeliveryFound &&
          detail.delivery_status === DeliveryStatus.PENDING
        ) {
          isCurrent = true;
          currentDeliveryFound = true;
        }

        const baseDetail: RouteSheetDetailResponseDto = {
          route_sheet_detail_id: detail.route_sheet_detail_id,
          route_sheet_id: detail.route_sheet_id,
          order: orderDto,
          delivery_status: detail.delivery_status as DeliveryStatus,
          delivery_time: detail.delivery_time || undefined,
          comments: detail.comments || undefined,
          digital_signature_id: detail.digital_signature_id || undefined,
          is_current_delivery: isCurrent,
        };

        if (detail.order_header?.subscription_id) {
          try {
            const credits =
              await this.subscriptionQuotaService.getAvailableCredits(
                detail.order_header.subscription_id,
              );
            return {
              ...baseDetail,
              credits: credits.map((c) => ({
                product_description: c.product_description,
                planned_quantity: c.planned_quantity,
                delivered_quantity: c.delivered_quantity,
                remaining_balance: c.remaining_balance,
              })),
            };
          } catch {
            return baseDetail;
          }
        }

        return baseDetail;
      }),
    );

    return new RouteSheetResponseDto({
      route_sheet_id: routeSheet.route_sheet_id,
      driver: driverDto,
      vehicle: vehicleDto,
      delivery_date: formatUTCYMD(routeSheet.delivery_date),
      route_notes: routeSheet.route_notes?.trim()
        ? routeSheet.route_notes
        : '-',
      details: detailsDto,
      zones_covered: zonesCoveredDto,
    });
  }

  async reconcileRouteSheetByDriver(
    route_sheet_id: number,
    reconcileDto: ReconcileRouteSheetDto,
  ): Promise<RouteSheetResponseDto> {
    const { signature_data } = reconcileDto;

    try {
      const routeSheet = await this.route_sheet.findUnique({
        where: { route_sheet_id },
      });

      if (!routeSheet) {
        throw new NotFoundException(
          `${this.entityName} con ID ${route_sheet_id} no encontrada.`,
        );
      }

      if (routeSheet.reconciliation_at) {
        throw new BadRequestException(
          `La ${this.entityName} ${route_sheet_id} ya fue rendida el ${formatBATimestampISO(routeSheet.reconciliation_at as any)}.`,
        );
      }

      const signatureFileName = await this.saveFile(
        signature_data,
        this.reconciliationSignaturesPath,
        `driver_reconciliation_routesheet_${route_sheet_id}`,
      );

      await this.route_sheet.update({
        where: { route_sheet_id },
        data: {
          driver_reconciliation_signature_path: signatureFileName,
          reconciliation_at: new Date(),
        },
      });

      const updatedRouteSheet = await this.route_sheet.findUniqueOrThrow({
        where: { route_sheet_id },
        include: {
          driver: true,
          vehicle: {
            include: {
              vehicle_zone: {
                where: { is_active: true },
                include: {
                  zone: {
                    include: {
                      locality: {
                        include: {
                          province: {
                            include: {
                              country: true,
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          route_sheet_detail: {
            include: {
              order_header: {
                include: {
                  customer: true,
                  customer_subscription: {
                    include: {
                      subscription_cycle: {
                        orderBy: { cycle_number: 'desc' },
                        take: 1,
                      },
                    },
                  },
                  order_item: {
                    include: {
                      product: true,
                    },
                  },
                },
              },
              one_off_purchase: {
                include: {
                  person: true,
                  product: true,
                },
              },
              one_off_purchase_header: {
                include: {
                  person: true,
                  purchase_items: {
                    include: {
                      product: true,
                    },
                  },
                },
              },
              cancellation_order: {
                include: {
                  customer_subscription: {
                    include: {
                      person: true,
                    },
                  },
                },
              },
              cycle_payment: {
                include: {
                  subscription_cycle: {
                    include: {
                      customer_subscription: {
                        include: {
                          person: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });
      return await this.mapToRouteSheetResponseDto(
        updatedRouteSheet as RouteSheetWithDetails,
      );
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      handlePrismaError(error, this.entityName);
      throw new InternalServerErrorException(
        'Error no manejado después de handlePrismaError',
      );
    }
  }

  async recordPaymentForDelivery(
    detailId: number,
    recordPaymentDto: RecordPaymentDto,
    userId: number,
  ): Promise<Prisma.payment_transactionGetPayload<{}>> {
    const routeSheetDetail = await this.route_sheet_detail.findUnique({
      where: { route_sheet_detail_id: detailId },
      include: {
        order_header: true,
        route_sheet: true,
      },
    });

    if (!routeSheetDetail) {
      throw new NotFoundException(
        `Detalle de ${this.entityName} con ID ${detailId} no encontrado.`,
      );
    }

    // if (routeSheetDetail.route_sheet.driver_id !== userId) {
    //     throw new ForbiddenException('No tienes permiso para registrar pagos en esta hoja de ruta.');
    // }

    const order = routeSheetDetail.order_header;
    if (!order) {
      throw new NotFoundException(
        `Pedido asociado al detalle de ${this.entityName} ${detailId} no encontrado.`,
      );
    }

    const paymentMethod = await this.payment_method.findUnique({
      where: { payment_method_id: recordPaymentDto.payment_method_id },
    });

    if (!paymentMethod) {
      throw new BadRequestException(
        `Método de pago con ID ${recordPaymentDto.payment_method_id} no es válido.`,
      );
    }

    const paymentAmount = new Decimal(recordPaymentDto.amount);
    if (paymentAmount.isNegative() || paymentAmount.isZero()) {
      throw new BadRequestException('El monto del pago debe ser positivo.');
    }

    const paymentTransactionResult = await this.$transaction(async (tx) => {
      const orderCurrentPaidAmount = new Decimal(order.paid_amount);
      const orderTotalAmount = new Decimal(order.total_amount);
      const remainingBalance = orderTotalAmount.minus(orderCurrentPaidAmount);

      if (paymentAmount.greaterThan(remainingBalance.plus(0.001))) {
        throw new BadRequestException(
          `El monto del pago (${paymentAmount}) excede el saldo pendiente (${remainingBalance.toFixed(2)}) del pedido ${order.order_id}.`,
        );
      }

      const paymentTransaction = await tx.payment_transaction.create({
        data: {
          transaction_date: recordPaymentDto.payment_date
            ? new Date(recordPaymentDto.payment_date)
            : new Date(),
          customer_id: order.customer_id,
          order_id: order.order_id,
          document_number: `RS-${routeSheetDetail.route_sheet_id}-D${detailId}`,
          receipt_number: recordPaymentDto.transaction_reference,
          transaction_type: 'PAYMENT',
          previous_balance: orderTotalAmount
            .minus(orderCurrentPaidAmount)
            .toString(),
          transaction_amount: paymentAmount.toString(),
          total: paymentAmount.toString(),
          payment_method_id: recordPaymentDto.payment_method_id,
          user_id: userId,
          notes: recordPaymentDto.notes,
        },
      });

      const newPaidAmount = orderCurrentPaidAmount.plus(paymentAmount);
      let newOrderStatus = order.status;
      if (newPaidAmount.greaterThanOrEqualTo(orderTotalAmount)) {
        newOrderStatus = 'DELIVERED';
      }

      await tx.order_header.update({
        where: { order_id: order.order_id },
        data: {
          paid_amount: newPaidAmount.toString(),
        },
      });
      return paymentTransaction;
    });
    // Aplicar lógica centralizada de entrega/comodatos a través de OrdersService
    const updatedPaidAmount = new Decimal(order.paid_amount).plus(
      new Decimal(recordPaymentDto.amount),
    );
    const updatedStatus = updatedPaidAmount.greaterThanOrEqualTo(
      new Decimal(order.total_amount),
    )
      ? DeliveryStatus.DELIVERED
      : (order.status as DeliveryStatus);

    if (
      updatedStatus === DeliveryStatus.DELIVERED &&
      order.status !== DeliveryStatus.DELIVERED
    ) {
      await this.ordersService.update(order.order_id, {
        status: updatedStatus,
      } as any);
    }

    return paymentTransactionResult;
  }

  async skipDelivery(
    detailId: number,
    dto: SkipDeliveryDto,
    userId: number,
  ): Promise<RouteSheetDetailResponseDto> {
    const routeSheetDetail = await this.route_sheet_detail.findUnique({
      where: { route_sheet_detail_id: detailId },
      include: {
        route_sheet: true,
        order_header: {
          include: {
            customer: true,
            order_item: {
              include: { product: true },
            },
          },
        },
      },
    });

    if (!routeSheetDetail) {
      throw new NotFoundException(
        `Detalle de ${this.entityName} con ID ${detailId} no encontrado.`,
      );
    }

    // if (routeSheetDetail.route_sheet.driver_id !== userId) {
    //   throw new ForbiddenException('No tienes permiso para modificar esta entrega.');
    // }

    if (routeSheetDetail.delivery_status !== DeliveryStatus.PENDING) {
      throw new BadRequestException(
        `Solo se pueden pasar entregas que estén en estado PENDING. Estado actual: ${routeSheetDetail.delivery_status}`,
      );
    }

    let evidencePhotoFileName: string | undefined = undefined;
    if (dto.photo_data_uri) {
      try {
        evidencePhotoFileName = await this.saveFile(
          dto.photo_data_uri,
          this.deliveryEvidencePath,
          `skip_evidence_detail_${detailId}`,
        );
      } catch (error) {
        console.error(
          `Error al guardar foto de evidencia para entrega saltada ${detailId}:`,
          error,
        );
      }
    }

    const updatedDetail = await this.route_sheet_detail.update({
      where: { route_sheet_detail_id: detailId },
      data: {
        delivery_status: DeliveryStatus.SKIPPED,
        rejection_reason: dto.reason,
        comments: dto.notes || routeSheetDetail.comments,
        digital_signature_id:
          evidencePhotoFileName || routeSheetDetail.digital_signature_id,
        delivery_time: new Date().toTimeString().slice(0, 5), // Formato HH:MM
      },
      include: {
        order_header: {
          include: {
            customer: true,
            order_item: { include: { product: true } },
          },
        },
      },
    });
    const responseDto = new RouteSheetDetailResponseDto();
    responseDto.route_sheet_detail_id = updatedDetail.route_sheet_detail_id;
    responseDto.route_sheet_id = updatedDetail.route_sheet_id;
    responseDto.delivery_status =
      updatedDetail.delivery_status as DeliveryStatus;
    responseDto.delivery_time = updatedDetail.delivery_time || undefined;
    responseDto.comments = updatedDetail.comments || undefined;
    responseDto.digital_signature_id =
      updatedDetail.digital_signature_id || undefined;

    // Only populate order data if order_header exists (for subscription orders)
    if (updatedDetail.order_header) {
      const customerDto = new CustomerDto();
      customerDto.person_id = updatedDetail.order_header.customer.person_id;
      customerDto.name = updatedDetail.order_header.customer.name || 'N/A';
      customerDto.alias =
        updatedDetail.order_header.customer.alias || undefined;
      customerDto.phone = updatedDetail.order_header.customer.phone;
      customerDto.address =
        updatedDetail.order_header.customer.address || 'N/A';

      const orderItemsDto: OrderItemDto[] =
        updatedDetail.order_header.order_item.map((item) => ({
          order_item_id: item.order_item_id,
          product: {
            product_id: item.product_id,
            description: item.product.description,
          },
          quantity: item.quantity,
          delivered_quantity: item.delivered_quantity || 0,
          returned_quantity: item.returned_quantity || 0,
        }));

      const orderDto = new OrderDto();
      orderDto.order_id = updatedDetail.order_header.order_id;
      orderDto.order_date = formatBATimestampISO(
        updatedDetail.order_header.order_date,
      );
      orderDto.total_amount =
        updatedDetail.order_header.total_amount.toString();
      orderDto.status = updatedDetail.order_header.status;
      orderDto.customer = customerDto;
      orderDto.items = orderItemsDto;

      responseDto.order = orderDto;
    }

    return responseDto;
  }

  /**
   * Valida que los horarios de entrega respeten las preferencias de suscripción del cliente
   */
  public async validateDeliveryTimeAgainstSubscription(
    orderId: number,
    deliveryTime: string,
  ): Promise<{ isValid: boolean; message?: string; suggestedTime?: string }> {
    try {
      // Obtener el pedido con información del cliente y suscripción
      const order = await this.order_header.findUnique({
        where: { order_id: orderId },
        include: {
          customer: true,
          customer_subscription: {
            include: {
              subscription_delivery_schedule: true,
            },
          },
        },
      });

      if (!order || !order.customer_subscription) {
        return { isValid: true }; // No hay suscripción, no validar
      }

      const subscription = order.customer_subscription;
      const schedules = subscription.subscription_delivery_schedule;

      if (schedules.length === 0) {
        return { isValid: true }; // No hay horarios definidos
      }

      // Validar formato del horario de entrega
      const timeValidation = this.validateScheduledTime(deliveryTime);
      if (!timeValidation.isValid) {
        return {
          isValid: false,
          message: `Formato de horario inválido: ${timeValidation.error}`,
        };
      }

      // Para validación simplificada, asumimos que el horario es válido si está en formato correcto
      // En una implementación completa, se podría validar contra un día específico
      // Por ahora, validamos que el formato sea correcto y retornamos válido
      return { isValid: true };
    } catch (error) {
      console.error('Error validando horario de entrega:', error);
      return { isValid: true }; // En caso de error, permitir la entrega
    }
  }

  /**
   * Valida formato de horario (método auxiliar)
   */
  private validateScheduledTime(scheduledTime: string): {
    isValid: boolean;
    type: 'puntual' | 'rango';
    startTime?: string;
    endTime?: string;
    error?: string;
  } {
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;

    if (scheduledTime.includes('-')) {
      // Formato de rango: HH:MM-HH:MM
      const [startTime, endTime] = scheduledTime
        .split('-')
        .map((t) => t.trim());

      if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
        return {
          isValid: false,
          type: 'rango',
          error: 'Formato de datos URI inválido.',
        };
      }

      const startMinutes = this.timeToMinutes(startTime);
      const endMinutes = this.timeToMinutes(endTime);

      if (startMinutes >= endMinutes) {
        return {
          isValid: false,
          type: 'rango',
          error: 'La hora de inicio debe ser menor que la hora de fin',
        };
      }

      return { isValid: true, type: 'rango', startTime, endTime };
    } else {
      // Formato puntual: HH:MM
      if (!timeRegex.test(scheduledTime)) {
        return {
          isValid: false,
          type: 'puntual',
          error: 'Formato de datos URI inválido.',
        };
      }

      return { isValid: true, type: 'puntual', startTime: scheduledTime };
    }
  }

  /**
   * Convierte tiempo HH:MM a minutos
   */
  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Actualiza el horario de entrega de un detalle de hoja de ruta
   * con validación contra las preferencias de suscripción del cliente
   */
  async updateDeliveryTime(
    detailId: number,
    updateDeliveryTimeDto: UpdateDeliveryTimeDto,
  ): Promise<RouteSheetDetailResponseDto> {
    try {
      // Verificar que el detalle existe
      const detail = await this.route_sheet_detail.findUnique({
        where: { route_sheet_detail_id: detailId },
        include: {
          order_header: {
            include: {
              customer: true,
              customer_subscription: {
                include: {
                  subscription_delivery_schedule: true,
                },
              },
            },
          },
        },
      });

      if (!detail) {
        throw new NotFoundException(
          `Detalle de hoja de ruta con ID ${detailId} no encontrado`,
        );
      }

      // Validar el nuevo horario contra las preferencias de suscripción (solo para órdenes de suscripción)
      if (detail.order_id) {
        const validation = await this.validateDeliveryTimeAgainstSubscription(
          detail.order_id,
          updateDeliveryTimeDto.delivery_time,
        );

        if (!validation.isValid) {
          throw new BadRequestException(
            `Horario inválido: ${validation.message}`,
          );
        }
      }

      // Actualizar el detalle
      const updatedDetail = await this.route_sheet_detail.update({
        where: { route_sheet_detail_id: detailId },
        data: {
          delivery_time: updateDeliveryTimeDto.delivery_time,
          comments: updateDeliveryTimeDto.comments || detail.comments,
        },
        include: {
          order_header: {
            include: {
              customer: true,
              order_item: {
                include: {
                  product: true,
                },
              },
            },
          },
        },
      });

      // Obtener la hoja de ruta completa para mapear correctamente
      const routeSheet = await this.route_sheet.findUnique({
        where: { route_sheet_id: updatedDetail.route_sheet_id },
        include: {
          driver: true,
          vehicle: true,
          route_sheet_detail: {
            include: {
              order_header: {
                include: {
                  customer: true,
                  order_item: {
                    include: {
                      product: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!routeSheet) {
        throw new NotFoundException('Hoja de ruta no encontrada');
      }

      // Encontrar el detalle actualizado en la respuesta
      const updatedDetailInResponse = routeSheet.route_sheet_detail.find(
        (detail) => detail.route_sheet_detail_id === detailId,
      );

      if (!updatedDetailInResponse) {
        throw new NotFoundException(
          'Detalle actualizado no encontrado en la respuesta',
        );
      }

      // Retornar una respuesta básica
      const responseDto: RouteSheetDetailResponseDto = {
        route_sheet_detail_id: updatedDetail.route_sheet_detail_id,
        route_sheet_id: updatedDetail.route_sheet_id,
        delivery_status: updatedDetail.delivery_status as DeliveryStatus,
        delivery_time: updatedDetail.delivery_time || undefined,
        comments: updatedDetail.comments || undefined,
        digital_signature_id: updatedDetail.digital_signature_id || undefined,
      };

      // Solo agregar información de orden si existe order_header
      if (updatedDetail.order_header) {
        responseDto.order = {
          order_id: updatedDetail.order_header.order_id,
          order_date: formatBATimestampISO(
            updatedDetail.order_header.order_date,
          ),
          total_amount: updatedDetail.order_header.total_amount.toString(),
          status: 'PENDING',
          customer: {
            person_id: updatedDetail.order_header.customer.person_id,
            name: updatedDetail.order_header.customer.name || '',
            alias: updatedDetail.order_header.customer.alias || undefined,
            phone: updatedDetail.order_header.customer.phone,
            address: updatedDetail.order_header.customer.address || '',
          },
          items: updatedDetail.order_header.order_item.map((item) => ({
            order_item_id: item.order_item_id,
            product: {
              product_id: item.product.product_id,
              description: item.product.description,
            },
            quantity: item.quantity,
            delivered_quantity: 0,
            returned_quantity: 0,
          })),
        };
      }

      return responseDto;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      handlePrismaError(error, 'Detalle de Hoja de Ruta');
      throw new InternalServerErrorException(
        'Error al actualizar horario de entrega',
      );
    }
  }

  /**
   * Genera un PDF específico para hojas de ruta de cobranzas automáticas
   */
  async generateCollectionRouteSheetPdf(
    route_sheet_id: number,
    options: any = {},
  ): Promise<{ url: string; filename: string; total_collections: number }> {
    try {
      // Buscar la hoja de ruta con todos los detalles necesarios
      const routeSheet = await this.route_sheet.findUnique({
        where: { route_sheet_id },
        include: {
          driver: true,
          vehicle: true,
          route_sheet_detail: {
            where: {
              cycle_payment_id: { not: null },
            },
            include: {
              cycle_payment: {
                include: {
                  subscription_cycle: {
                    include: {
                      customer_subscription: {
                        include: {
                          person: {
                            include: {
                              zone: true,
                              locality: true,
                            },
                          },
                          subscription_plan: true,
                        },
                      },
                      subscription_cycle_detail: {
                        include: {
                          product: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!routeSheet) {
        throw new NotFoundException(
          `Hoja de ruta con ID ${route_sheet_id} no encontrada`,
        );
      }

      // Filtrar solo los detalles que tienen cycle_payment_id
      const collectionDetails = routeSheet.route_sheet_detail.filter(
        (detail) => detail.cycle_payment_id,
      );

      if (collectionDetails.length === 0) {
        throw new BadRequestException(
          'Esta hoja de ruta no contiene cobranzas automáticas',
        );
      }

      // Mapear los datos para el PDF
      // Calcular zonas únicas a partir de los detalles de cobranzas
      const zoneIdsSet = new Set<number>();
      for (const detail of collectionDetails) {
        const zid =
          detail.cycle_payment?.subscription_cycle?.customer_subscription
            ?.person?.zone_id ?? null;
        if (typeof zid === 'number') zoneIdsSet.add(zid);
      }
      const zoneIdentifiers = Array.from(zoneIdsSet)
        .sort((a, b) => a - b)
        .map((z) => `zona${z}`);

      const collections = await Promise.all(
        collectionDetails.map(async (detail) => {
          const person =
            detail.cycle_payment.subscription_cycle.customer_subscription
              .person;
          const subscription =
            detail.cycle_payment.subscription_cycle.customer_subscription;
          const cycle = detail.cycle_payment.subscription_cycle;

          let finalAmount = detail.cycle_payment.amount.toNumber();

          const activeSubscriptionsCount =
            await this.customer_subscription.count({
              where: { customer_id: person.person_id, is_active: true },
            });

          if (activeSubscriptionsCount === 1) {
            const unpaidCycles = await this.subscription_cycle.findMany({
              where: {
                subscription_id: subscription.subscription_id,
                payment_status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] },
              },
              select: { pending_balance: true, payment_due_date: true },
            });
            const sumDebts = unpaidCycles.reduce(
              (acc, c) => acc + Number(c.pending_balance ?? 0),
              0,
            );
            if (sumDebts > 0) {
              finalAmount = sumDebts;
            }
          }

          const mapped = {
            cycle_payment_id: detail.cycle_payment_id,
            customer: {
              customer_id: person.person_id,
              name: person.name,
              address: person.address,
              phone: person.phone,
              zone: person.zone
                ? {
                    zone_id: person.zone.zone_id,
                    code: person.zone.code,
                    name: person.zone.name,
                  }
                : undefined,
              locality: person.locality
                ? {
                    locality_id: person.locality.locality_id,
                    code: person.locality.code,
                    name: person.locality.name,
                  }
                : undefined,
            },
            amount: finalAmount,
            payment_reference: detail.cycle_payment.reference || undefined,
            payment_notes: detail.cycle_payment.notes || undefined,
            payment_method: detail.cycle_payment.payment_method || undefined,
            subscription_notes: subscription.notes || undefined,
            payment_due_date: cycle?.payment_due_date
              ? formatUTCYMD(cycle.payment_due_date as any)
              : '',
            cycle_period: cycle.cycle_number.toString(),
            subscription_plan: subscription.subscription_plan.name,
            payment_status: (() => {
              const dbStatus = (cycle as any)?.payment_status as
                | string
                | undefined;
              if (dbStatus && dbStatus !== 'PENDING') return dbStatus;
              const pbRaw = (cycle as any)?.pending_balance;
              const pb =
                pbRaw !== undefined && pbRaw !== null ? Number(pbRaw) : NaN;
              if (!Number.isNaN(pb)) {
                if (pb <= 0) return 'PAID';
                const isOver =
                  Boolean((cycle as any)?.is_overdue) ||
                  (cycle?.payment_due_date &&
                    formatUTCYMD(new Date(cycle.payment_due_date)) <
                      formatUTCYMD(new Date()));
                if (isOver) return 'OVERDUE';
                const paidRaw = (cycle as any)?.paid_amount;
                const paid =
                  paidRaw !== undefined && paidRaw !== null
                    ? Number(paidRaw)
                    : 0;
                if (paid > 0) return 'PARTIAL';
                return 'PENDING';
              }
              return dbStatus || 'PENDING';
            })(),
            delivery_status: detail.delivery_status,
            delivery_time: detail.delivery_time,
            comments: detail.comments,
            subscription_id: (cycle as any).subscription_id,
            credits:
              cycle.subscription_cycle_detail?.map((cycleDetail) => ({
                product_description: cycleDetail.product.description,
                planned_quantity: cycleDetail.planned_quantity,
                delivered_quantity: cycleDetail.delivered_quantity,
                remaining_balance: cycleDetail.remaining_balance,
              })) || [],
          };
          return mapped;
        }),
      );

      const collectionData = {
        route_sheet_id: routeSheet.route_sheet_id,
        delivery_date: formatUTCYMD(routeSheet.delivery_date),
        route_notes: routeSheet.route_notes,
        driver: {
          name: routeSheet.driver.name,
          email: routeSheet.driver.email,
        },
        vehicle: {
          code: routeSheet.vehicle.code,
          name: routeSheet.vehicle.name,
        },
        zone_identifiers: zoneIdentifiers,
        collections,
      };
      // Generar el PDF usando el servicio de generación mejorado
      const { doc, filename, pdfPath } =
        await this.pdfGeneratorService.generateCollectionRouteSheetPdf(
          collectionData,
        );

      // Guardar el PDF
      const writeStream = fs.createWriteStream(pdfPath);
      doc.pipe(writeStream);

      // Finalizar y obtener la URL
      const result = await this.pdfGeneratorService.finalizePdf(
        doc,
        writeStream,
        filename,
      );

      return {
        ...result,
        total_collections: collectionDetails.length,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Error generando PDF de cobranzas: ${error.message}`,
      );
    }
  }
}
