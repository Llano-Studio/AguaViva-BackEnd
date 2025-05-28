import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaClient, Prisma, route_sheet, route_sheet_detail, User, vehicle } from '@prisma/client';
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
  ReconcileRouteSheetDto,
  RecordPaymentDto,
  SkipDeliveryDto,
  SkipDeliveryReason
} from './dto';
import * as PDFDocument from 'pdfkit';
import * as fs from 'fs-extra';
import { join } from 'path';
import { Decimal } from '@prisma/client/runtime/library';
import { parseSortByString } from '../common/utils/query-parser.utils';
import { handlePrismaError } from '../common/utils/prisma-error-handler.utils';

type RouteSheetWithDetails = Prisma.route_sheetGetPayload<{
  include: {
    driver: true;
    vehicle: true;
    route_sheet_detail: {
      include: {
        order_header: {
          include: {
            customer: true;
            order_item: {
              include: {
                product: true;
              }
            };
          }
        };
      }
    };
  };
}>;

@Injectable()
export class RouteSheetService extends PrismaClient implements OnModuleInit {
  
  private readonly entityName = 'Hoja de Ruta';
  private readonly pdfDir = join(process.cwd(), 'public', 'pdfs');
  private readonly reconciliationSignaturesPath = join(process.cwd(), 'public', 'uploads', 'reconciliations', 'driver_signatures');
  private readonly deliveryEvidencePath = join(process.cwd(), 'public', 'uploads', 'delivery_evidence');

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

  private async saveFile(dataUri: string, targetPath: string, baseFileName: string): Promise<string> {
    try {
      if (!dataUri.startsWith('data:')) {
        throw new BadRequestException('Formato de datos inválido para el archivo.');
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
      throw new InternalServerErrorException('Error interno al guardar el archivo.');
    }
  }

  private getFileExtensionFromMimeType(mimeType: string): string {
    const mimeMap: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/svg+xml': 'svg',
      'application/pdf': 'pdf'
    };
    return mimeMap[mimeType] || 'bin';
  }

  async create(createRouteSheetDto: CreateRouteSheetDto): Promise<RouteSheetResponseDto> {
    const { driver_id, vehicle_id, delivery_date, route_notes, details } = createRouteSheetDto;

    try {
      const driver = await this.user.findUnique({
        where: { id: driver_id }
      });
      if (!driver) {
        throw new BadRequestException(`El conductor con ID ${driver_id} no existe`);
      }

      const vehicle = await this.vehicle.findUnique({
        where: { vehicle_id }
      });
      if (!vehicle) {
        throw new BadRequestException(`El vehículo con ID ${vehicle_id} no existe`);
      }

      const orderIds = details.map(detail => detail.order_id);
      const orders = await this.order_header.findMany({
        where: { order_id: { in: orderIds } }
      });
      if (orders.length !== orderIds.length) {
        const foundOrderIds = orders.map(order => order.order_id);
        const missingOrderIds = orderIds.filter(id => !foundOrderIds.includes(id));
        throw new BadRequestException(`Los siguientes pedidos no existen: ${missingOrderIds.join(', ')}`);
      }

      const existingAssignments = await this.route_sheet_detail.findMany({
        where: {
          order_id: { in: orderIds },
          route_sheet: {
            delivery_date: new Date(delivery_date)
          }
        },
        include: {
          route_sheet: true
        }
      });

      if (existingAssignments.length > 0) {
        const assignedOrders = existingAssignments.map(assignment => {
          return `Pedido ${assignment.order_id} ya asignado a la hoja de ruta ${assignment.route_sheet_id}`;
        });
        throw new BadRequestException(`Los siguientes pedidos ya están asignados para esa fecha: ${assignedOrders.join(', ')}`);
      }

      const result = await this.$transaction(async (tx) => {
        const routeSheet = await tx.route_sheet.create({
          data: {
            driver_id,
            vehicle_id,
            delivery_date: new Date(delivery_date),
            route_notes,
            route_sheet_detail: {
              create: details.map(detail => ({
                order_id: detail.order_id,
                delivery_status: detail.delivery_status || 'PENDING',
                comments: detail.comments
              }))
            }
          },
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
                        product: true
                      }
                    }
                  }
                }
              }
            }
          }
        });
        return routeSheet;
      });
      return this.mapToRouteSheetResponseDto(result);
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      handlePrismaError(error, this.entityName);
      throw new InternalServerErrorException('Error no manejado después de handlePrismaError');
    }
  }

  async findAll(filters?: FilterRouteSheetsDto): Promise<{ data: RouteSheetResponseDto[], meta: { total: number, page: number, limit: number, totalPages: number} }> {
    try {
      const whereClause: Prisma.route_sheetWhereInput = {};
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
        if (filters.from_date && typeof whereClause.delivery_date === 'object') {
          (whereClause.delivery_date as Prisma.DateTimeFilter).gte = new Date(filters.from_date);
        }
        if (filters.to_date && typeof whereClause.delivery_date === 'object') {
          (whereClause.delivery_date as Prisma.DateTimeFilter).lte = new Date(filters.to_date);
        }
      }

      const orderByClause = parseSortByString(filters?.sortBy, [{ delivery_date: 'desc' }]);
      const totalCount = await this.route_sheet.count({ where: whereClause });
      const routeSheets = await this.route_sheet.findMany({
        where: whereClause,
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
                      product: true
                    }
                  }
                }
              }
            }
          }
        },
        orderBy: orderByClause,
        skip,
        take: limit
      });

      const data = routeSheets.map(routeSheet => this.mapToRouteSheetResponseDto(routeSheet));

      return {
        data,
        meta: {
          total: totalCount,
          page,
          limit,
          totalPages: Math.ceil(totalCount / take) 
        }
      };
    } catch (error) {
      handlePrismaError(error, `${this.entityName}s`);
      throw new InternalServerErrorException('Error no manejado después de handlePrismaError');
    }
  }

  async findOne(id: number): Promise<RouteSheetResponseDto> {
    const routeSheet = await this.route_sheet.findUnique({
      where: { route_sheet_id: id },
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
                    product: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!routeSheet) {
      throw new NotFoundException(`${this.entityName} con ID ${id} no encontrada`);
    }
    return this.mapToRouteSheetResponseDto(routeSheet);
  }

  async update(id: number, updateRouteSheetDto: UpdateRouteSheetDto): Promise<RouteSheetResponseDto> {
    await this.findOne(id);
    const { driver_id, vehicle_id, delivery_date, route_notes, details } = updateRouteSheetDto;
    
    try {
      if (driver_id) {
        const driver = await this.user.findUnique({ where: { id: driver_id } });
        if (!driver) {
          throw new BadRequestException(`El conductor con ID ${driver_id} no existe`);
        }
      }

      if (vehicle_id) {
        const vehicle = await this.vehicle.findUnique({ where: { vehicle_id } });
        if (!vehicle) {
          throw new BadRequestException(`El vehículo con ID ${vehicle_id} no existe`);
        }
      }

      const result = await this.$transaction(async (tx) => {
        let updateData: Prisma.route_sheetUpdateInput = {};
        if (driver_id) updateData.driver = { connect: { id: driver_id } };
        if (vehicle_id) updateData.vehicle = { connect: { vehicle_id } };
        if (delivery_date) updateData.delivery_date = new Date(delivery_date);
        if (route_notes !== undefined) updateData.route_notes = route_notes;

        const updatedRouteSheet = await tx.route_sheet.update({
          where: { route_sheet_id: id },
          data: updateData,
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
                        product: true
                      }
                    }
                  }
                }
              }
            }
          }
        });

        if (details && details.length > 0) {
          for (const detail of details) {
            if (detail.route_sheet_detail_id) {
              await tx.route_sheet_detail.update({
                where: { route_sheet_detail_id: detail.route_sheet_detail_id },
                data: {
                  delivery_status: detail.delivery_status,
                  comments: detail.comments
                }
              });
            } else if (detail.order_id) {
              const order = await tx.order_header.findUnique({
                where: { order_id: detail.order_id }
              });
              if (!order) {
                throw new BadRequestException(`El pedido con ID ${detail.order_id} no existe`);
              }

              const existingAssignment = await tx.route_sheet_detail.findFirst({
                where: {
                  order_id: detail.order_id,
                  route_sheet: {
                    delivery_date: updatedRouteSheet.delivery_date,
                    route_sheet_id: { not: id }
                  }
                }
              });

              if (existingAssignment) {
                throw new BadRequestException(`El pedido ${detail.order_id} ya está asignado a otra hoja de ruta para esa fecha`);
              }

              await tx.route_sheet_detail.create({
                data: {
                  route_sheet_id: id,
                  order_id: detail.order_id,
                  delivery_status: detail.delivery_status || 'PENDING',
                  comments: detail.comments
                }
              });
            }
          }
        }
        return await tx.route_sheet.findUniqueOrThrow({
          where: { route_sheet_id: id },
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
                        product: true
                      }
                    }
                  }
                }
              }
            }
          }
        });
      });
      return this.mapToRouteSheetResponseDto(result);
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) throw error;
      handlePrismaError(error, this.entityName);
      throw new InternalServerErrorException('Error no manejado después de handlePrismaError');
    }
  }

  async remove(id: number): Promise<{ message: string; deleted: boolean }> {
    await this.findOne(id);
    try {
      await this.$transaction(async (tx) => {
        await tx.route_sheet_detail.deleteMany({
          where: { route_sheet_id: id }
        });
        await tx.route_sheet.delete({
          where: { route_sheet_id: id }
        });
      });
      return {
        message: `${this.entityName} con ID ${id} eliminada correctamente`,
        deleted: true
      };
    } catch (error) {
      handlePrismaError(error, this.entityName);
      throw new InternalServerErrorException('Error no manejado después de handlePrismaError');
    }
  }

  async generatePrintableDocument(route_sheet_id: number, options?: any): Promise<{ url: string; filename: string }> {
    try {
      const routeSheet = await this.findOne(route_sheet_id);
      const filename = `route_sheet_${route_sheet_id}_${new Date().toISOString().split('T')[0]}.pdf`;
      const pdfDir = await this.ensurePdfDirectoryExists();
      const pdfPath = join(pdfDir, filename);
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const writeStream = fs.createWriteStream(pdfPath);
      doc.pipe(writeStream);
      await this.generatePdfContent(doc, routeSheet, options);
      doc.end();
      await new Promise<void>((resolve, reject) => {
        writeStream.on('finish', () => resolve());
        writeStream.on('error', reject);
      });
      const url = `/pdfs/${filename}`;
      return { url, filename };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      console.error(`Error al generar PDF para ${this.entityName} ${route_sheet_id}:`, error);
      throw new InternalServerErrorException(`Error al generar PDF para ${this.entityName} ${route_sheet_id}`);
    }
  }

  private async generatePdfContent(doc: PDFKit.PDFDocument, routeSheet: RouteSheetResponseDto, options?: any): Promise<void> {
    const includeMap = options?.includeMap || false;
    const includeSignatureField = options?.includeSignatureField !== false;
    const includeProductDetails = options?.includeProductDetails !== false;
    
    doc.fontSize(20).text('HOJA DE RUTA', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Hoja de Ruta #: ${routeSheet.route_sheet_id}`, { continued: true });
    doc.text(`Fecha: ${routeSheet.delivery_date}`, { align: 'right' });
    doc.moveDown(0.5);
    doc.fontSize(12).font('Helvetica-Bold').text('Datos del Conductor:');
    doc.font('Helvetica').text(`Nombre: ${routeSheet.driver.name}`);
    doc.text(`Email: ${routeSheet.driver.email}`);
    doc.moveDown(0.5);
    doc.fontSize(12).font('Helvetica-Bold').text('Datos del Vehículo:');
    doc.font('Helvetica').text(`Código: ${routeSheet.vehicle.code}`);
    doc.text(`Descripción: ${routeSheet.vehicle.name}`);
    
    if (routeSheet.route_notes) {
      doc.moveDown(0.5);
      doc.fontSize(12).font('Helvetica-Bold').text('Notas:');
      doc.font('Helvetica').text(routeSheet.route_notes);
    }
    doc.moveDown();
    doc.fontSize(14).font('Helvetica-Bold').text('PEDIDOS A ENTREGAR', { align: 'center' });
    doc.moveDown();
    
    const startX = 50;
    let currentY = doc.y;
    const lineHeight = 20;
    
    doc.font('Helvetica-Bold').fontSize(10);
    doc.text('#', startX, currentY, { width: 30 });
    doc.text('Cliente', startX + 30, currentY, { width: 120 });
    doc.text('Dirección', startX + 150, currentY, { width: 150 });
    doc.text('Teléfono', startX + 300, currentY, { width: 80 });
    doc.text('Estado', startX + 380, currentY, { width: 80 });
    
    currentY += lineHeight;
    doc.moveTo(startX, currentY).lineTo(startX + 460, currentY).stroke();
    currentY += 5;
    
    doc.font('Helvetica').fontSize(10);
    
    for (const detail of routeSheet.details) {
      if (currentY > doc.page.height - 150) {
        doc.addPage();
        currentY = 50;
      }
      
      doc.text(detail.order.order_id.toString(), startX, currentY, { width: 30 });
      doc.text(detail.order.customer.name, startX + 30, currentY, { width: 120 });
      doc.text(detail.order.customer.address, startX + 150, currentY, { width: 150 });
      doc.text(detail.order.customer.phone, startX + 300, currentY, { width: 80 });
      doc.text(detail.delivery_status, startX + 380, currentY, { width: 80 });
      
      currentY += lineHeight;
      
      if (includeProductDetails && detail.order.items.length > 0) {
        doc.text('Productos:', startX + 20, currentY);
        currentY += lineHeight - 5;
        
        for (const item of detail.order.items) {
          doc.text(`- ${item.quantity}x ${item.product.description}`, startX + 30, currentY);
          currentY += lineHeight - 5;
        }
        currentY += 5;
      }
      doc.moveTo(startX, currentY).lineTo(startX + 460, currentY).stroke();
      currentY += 10;
    }
    
    if (includeSignatureField) {
      if (currentY > doc.page.height - 150) {
        doc.addPage();
        currentY = 50;
      }
      doc.moveDown();
      currentY = doc.y;
      doc.fontSize(12).font('Helvetica-Bold').text('CONFIRMACIÓN DE ENTREGAS', { align: 'center' });
      doc.moveDown();
      currentY = doc.y;
      doc.font('Helvetica').text('Firma del Conductor:', startX, currentY);
      currentY += lineHeight;
      doc.moveTo(startX, currentY).lineTo(startX + 200, currentY).stroke();
      doc.font('Helvetica').text('Firma del Supervisor:', startX + 250, currentY - lineHeight);
      doc.moveTo(startX + 250, currentY).lineTo(startX + 450, currentY).stroke();
    }
    doc.fontSize(8);
    doc.text(`Documento generado el: ${new Date().toLocaleString()}`, 50, doc.page.height - 50);
  }

  private mapToRouteSheetResponseDto(routeSheet: RouteSheetWithDetails): RouteSheetResponseDto {
    const driverDto: DriverDto = {
      id: routeSheet.driver.id,
      name: routeSheet.driver.name,
      email: routeSheet.driver.email
    };

    const vehicleDto: VehicleDto = {
      vehicle_id: routeSheet.vehicle.vehicle_id,
      code: routeSheet.vehicle.code,
      name: routeSheet.vehicle.name
    };

    const sortedDetails = [...routeSheet.route_sheet_detail].sort((a, b) => {
      if (a.sequence_number === null || a.sequence_number === undefined) return 1;
      if (b.sequence_number === null || b.sequence_number === undefined) return -1;
      return a.sequence_number - b.sequence_number;
    });

    let currentDeliveryFound = false;
    const detailsDto: RouteSheetDetailResponseDto[] = sortedDetails.map(detail => {
      const customerDto: CustomerDto = {
        person_id: detail.order_header.customer.person_id,
        name: detail.order_header.customer.name || 'Sin nombre',
        phone: detail.order_header.customer.phone,
        address: detail.order_header.customer.address || 'Sin dirección'
      };

      let isCurrent = false;
      if (!currentDeliveryFound && detail.delivery_status === 'PENDING') {
        isCurrent = true;
        currentDeliveryFound = true;
      }

      const orderItemsDto: OrderItemDto[] = detail.order_header.order_item.map(item => {
        const productDto: ProductDto = {
          product_id: item.product.product_id,
          description: item.product.description
        };
        return {
          order_item_id: item.order_item_id,
          product: productDto,
          quantity: item.quantity,
          delivered_quantity: item.delivered_quantity || 0,
          returned_quantity: item.returned_quantity || 0
        };
      });

      const orderDto: OrderDto = {
        order_id: detail.order_header.order_id,
        order_date: detail.order_header.order_date.toISOString(),
        total_amount: detail.order_header.total_amount.toString(),
        status: detail.order_header.status,
        customer: customerDto,
        items: orderItemsDto
      };

      return {
        route_sheet_detail_id: detail.route_sheet_detail_id,
        route_sheet_id: detail.route_sheet_id,
        order: orderDto,
        delivery_status: detail.delivery_status,
        delivery_time: detail.delivery_time?.toISOString(),
        comments: detail.comments || undefined,
        digital_signature_id: detail.digital_signature_id || undefined,
        is_current_delivery: isCurrent
      };
    });

    return new RouteSheetResponseDto({
      route_sheet_id: routeSheet.route_sheet_id,
      driver: driverDto,
      vehicle: vehicleDto,
      delivery_date: routeSheet.delivery_date.toISOString().split('T')[0],
      route_notes: routeSheet.route_notes || undefined,
      details: detailsDto
    });
  }

  async reconcileRouteSheetByDriver(route_sheet_id: number, reconcileDto: ReconcileRouteSheetDto): Promise<RouteSheetResponseDto> {
    const { signature_data } = reconcileDto;

    try {
      const routeSheet = await this.route_sheet.findUnique({
        where: { route_sheet_id },
      });

      if (!routeSheet) {
        throw new NotFoundException(`${this.entityName} con ID ${route_sheet_id} no encontrada.`);
      }

      if (routeSheet.reconciliation_at) {
        throw new BadRequestException(
          `La ${this.entityName} ${route_sheet_id} ya fue rendida el ${routeSheet.reconciliation_at.toISOString()}.`
        );
      }

      const signatureFileName = await this.saveFile(
        signature_data,
        this.reconciliationSignaturesPath,
        `driver_reconciliation_routesheet_${route_sheet_id}`
      );

      const updatedRouteSheet = await this.route_sheet.update({
        where: { route_sheet_id },
        data: {
          driver_reconciliation_signature_path: signatureFileName,
          reconciliation_at: new Date(),
        },
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
                      product: true
                    }
                  }
                }
              }
            }
          }
        }
      });
      return this.mapToRouteSheetResponseDto(updatedRouteSheet as any);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      handlePrismaError(error, this.entityName);
      throw new InternalServerErrorException('Error no manejado después de handlePrismaError');
    }
  }

  async recordPaymentForDelivery(
    detailId: number, 
    recordPaymentDto: RecordPaymentDto, 
    userId: number
  ): Promise<Prisma.payment_transactionGetPayload<{}>> {
    
    console.log(`Registrando pago para detailId: ${detailId}, DTO: ${JSON.stringify(recordPaymentDto)}, Usuario ID: ${userId}`);
    
    const routeSheetDetail = await this.route_sheet_detail.findUnique({
        where: { route_sheet_detail_id: detailId },
        include: {
            order_header: true,
            route_sheet: true, 
        }
    });

    if (!routeSheetDetail) {
        throw new NotFoundException(`Detalle de ${this.entityName} con ID ${detailId} no encontrado.`);
    }

    // if (routeSheetDetail.route_sheet.driver_id !== userId) {
    //     throw new ForbiddenException('No tienes permiso para registrar pagos en esta hoja de ruta.');
    // }

    const order = routeSheetDetail.order_header;
    if (!order) {
        throw new NotFoundException(`Pedido asociado al detalle de ${this.entityName} ${detailId} no encontrado.`);
    }

    const paymentMethod = await this.payment_method.findUnique({
        where: { payment_method_id: recordPaymentDto.payment_method_id }
    });

    if (!paymentMethod) {
        throw new BadRequestException(`Método de pago con ID ${recordPaymentDto.payment_method_id} no es válido.`);
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
                `El monto del pago (${paymentAmount}) excede el saldo pendiente (${remainingBalance.toFixed(2)}) del pedido ${order.order_id}.`
            );
        }
        
        const paymentTransaction = await tx.payment_transaction.create({
            data: {
                transaction_date: recordPaymentDto.payment_date ? new Date(recordPaymentDto.payment_date) : new Date(),
                customer_id: order.customer_id,
                order_id: order.order_id,
                document_number: `RS-${routeSheetDetail.route_sheet_id}-D${detailId}`, 
                receipt_number: recordPaymentDto.transaction_reference, 
                transaction_type: 'PAYMENT', 
                previous_balance: orderTotalAmount.minus(orderCurrentPaidAmount).toString(), 
                transaction_amount: paymentAmount.toString(),
                total: paymentAmount.toString(), 
                payment_method_id: recordPaymentDto.payment_method_id,
                user_id: userId,
                notes: recordPaymentDto.notes,
            }
        });

        const newPaidAmount = orderCurrentPaidAmount.plus(paymentAmount);
        let newOrderStatus = order.status;
        if (newPaidAmount.greaterThanOrEqualTo(orderTotalAmount)) {
            newOrderStatus = "PAID"; 
        }

        await tx.order_header.update({
            where: { order_id: order.order_id },
            data: {
                paid_amount: newPaidAmount.toString(),
                status: newOrderStatus,
            }
        });
        return paymentTransaction;
    });
    return paymentTransactionResult;
  }

  async skipDelivery(
    detailId: number, 
    dto: SkipDeliveryDto, 
    userId: number
  ): Promise<RouteSheetDetailResponseDto> {

    const routeSheetDetail = await this.route_sheet_detail.findUnique({
      where: { route_sheet_detail_id: detailId },
      include: { 
        route_sheet: true,
        order_header: {
            include: {
                customer: true,
                order_item: {
                    include: { product: true }
                }
            }
        }
       }
    });

    if (!routeSheetDetail) {
      throw new NotFoundException(`Detalle de ${this.entityName} con ID ${detailId} no encontrado.`);
    }

    // if (routeSheetDetail.route_sheet.driver_id !== userId) {
    //   throw new ForbiddenException('No tienes permiso para modificar esta entrega.');
    // }

    if (routeSheetDetail.delivery_status !== 'PENDING') {
      throw new BadRequestException(
        `Solo se pueden pasar entregas que estén en estado PENDING. Estado actual: ${routeSheetDetail.delivery_status}`
      );
    }

    let evidencePhotoFileName: string | undefined = undefined;
    if (dto.photo_data_uri) {
      try {
        evidencePhotoFileName = await this.saveFile(
          dto.photo_data_uri,
          this.deliveryEvidencePath,
          `skip_evidence_detail_${detailId}`
        );
      } catch (error) {
        console.error(`Error al guardar foto de evidencia para entrega saltada ${detailId}:`, error);
      }
    }

    const updatedDetail = await this.route_sheet_detail.update({
      where: { route_sheet_detail_id: detailId },
      data: {
        delivery_status: 'SKIPPED',
        rejection_reason: dto.reason,
        comments: dto.notes || routeSheetDetail.comments,
        digital_signature_id: evidencePhotoFileName || routeSheetDetail.digital_signature_id,
        delivery_time: new Date(),
      },
      include: {
        order_header: {
            include: {
                customer: true,
                order_item: { include: { product: true } }
            }
        }
      }
    });

    const customerDto = new CustomerDto();
    customerDto.person_id = updatedDetail.order_header.customer.person_id;
    customerDto.name = updatedDetail.order_header.customer.name || 'N/A';
    customerDto.phone = updatedDetail.order_header.customer.phone;
    customerDto.address = updatedDetail.order_header.customer.address || 'N/A';

    const orderItemsDto: OrderItemDto[] = updatedDetail.order_header.order_item.map(item => ({
        order_item_id: item.order_item_id,
        product: { product_id: item.product_id, description: item.product.description },
        quantity: item.quantity,
        delivered_quantity: item.delivered_quantity || 0,
        returned_quantity: item.returned_quantity || 0,
    }));

    const orderDto = new OrderDto();
    orderDto.order_id = updatedDetail.order_header.order_id;
    orderDto.order_date = updatedDetail.order_header.order_date.toISOString();
    orderDto.total_amount = updatedDetail.order_header.total_amount.toString();
    orderDto.status = updatedDetail.order_header.status;
    orderDto.customer = customerDto;
    orderDto.items = orderItemsDto;
    
    const responseDto = new RouteSheetDetailResponseDto();
    responseDto.route_sheet_detail_id = updatedDetail.route_sheet_detail_id;
    responseDto.route_sheet_id = updatedDetail.route_sheet_id;
    responseDto.order = orderDto;
    responseDto.delivery_status = updatedDetail.delivery_status;
    responseDto.delivery_time = updatedDetail.delivery_time?.toISOString();
    responseDto.comments = updatedDetail.comments || undefined;
    responseDto.digital_signature_id = updatedDetail.digital_signature_id || undefined;
    return responseDto;
  }
} 