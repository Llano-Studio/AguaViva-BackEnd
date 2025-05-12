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
  
  private readonly pdfDir = join(process.cwd(), 'public', 'pdfs');
  private readonly reconciliationSignaturesPath = join(process.cwd(), 'public', 'uploads', 'reconciliations', 'driver_signatures');
  private readonly deliveryEvidencePath = join(process.cwd(), 'public', 'uploads', 'delivery_evidence');

  async onModuleInit() {
    await this.$connect();
    // Asegurar que el directorio de PDFs existe
    await this.ensurePdfDirectoryExists();
    await fs.ensureDir(this.reconciliationSignaturesPath); // Asegurar que el directorio de firmas de rendición exista
    await fs.ensureDir(this.deliveryEvidencePath); // Asegurar que el directorio de evidencia exista
  }

  /**
   * Asegura que exista el directorio para almacenar los PDFs
   */
  private async ensurePdfDirectoryExists() {
    const pdfDir = join(process.cwd(), 'public', 'pdfs');
    await fs.ensureDir(pdfDir);
    return pdfDir;
  }

  /**
   * Guarda un archivo (ej. firma, evidencia) en el sistema de archivos.
   * @param dataUri Datos del archivo en formato base64.
   * @param targetPath Directorio donde se guardará el archivo.
   * @param baseFileName Nombre base para el archivo (sin extensión ni timestamp).
   * @returns El nombre del archivo guardado (incluyendo timestamp y extensión).
   */
  private async saveFile(dataUri: string, targetPath: string, baseFileName: string): Promise<string> {
    try {
      if (!dataUri.startsWith('data:')) {
        throw new BadRequestException('Formato de datos inválido para el archivo.');
      }

      const matches = dataUri.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
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

  /**
   * Obtiene la extensión de archivo según el tipo MIME.
   */
  private getFileExtensionFromMimeType(mimeType: string): string {
    const mimeMap: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/svg+xml': 'svg',
      'application/pdf': 'pdf'
    };
    return mimeMap[mimeType] || 'bin'; // 'bin' como extensión genérica para desconocidos
  }

  /**
   * Crea una nueva hoja de ruta con sus detalles
   */
  async create(createRouteSheetDto: CreateRouteSheetDto): Promise<RouteSheetResponseDto> {
    const { driver_id, vehicle_id, delivery_date, route_notes, details } = createRouteSheetDto;

    try {
      // Verificar que el conductor existe
      const driver = await this.user.findUnique({
        where: { id: driver_id }
      });
      if (!driver) {
        throw new BadRequestException(`El conductor con ID ${driver_id} no existe`);
      }

      // Verificar que el vehículo existe
      const vehicle = await this.vehicle.findUnique({
        where: { vehicle_id }
      });
      if (!vehicle) {
        throw new BadRequestException(`El vehículo con ID ${vehicle_id} no existe`);
      }

      // Verificar que todos los pedidos existen
      const orderIds = details.map(detail => detail.order_id);
      const orders = await this.order_header.findMany({
        where: { order_id: { in: orderIds } }
      });
      if (orders.length !== orderIds.length) {
        const foundOrderIds = orders.map(order => order.order_id);
        const missingOrderIds = orderIds.filter(id => !foundOrderIds.includes(id));
        throw new BadRequestException(`Los siguientes pedidos no existen: ${missingOrderIds.join(', ')}`);
      }

      // Verificar si algún pedido ya está asignado a otra hoja de ruta para esa fecha
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

      // Crear la hoja de ruta dentro de una transacción
      const result = await this.$transaction(async (tx) => {
        // Crear la hoja de ruta
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

      // Transformar el resultado para la respuesta
      return this.mapToRouteSheetResponseDto(result);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      console.error('Error al crear la hoja de ruta:', error);
      throw new InternalServerErrorException('Error al crear la hoja de ruta');
    }
  }

  /**
   * Obtiene todas las hojas de ruta con filtros opcionales
   */
  async findAll(filters?: FilterRouteSheetsDto) {
    try {
      const whereClause: Prisma.route_sheetWhereInput = {};
      
      // Aplicar filtros si se proporcionan
      if (filters) {
        if (filters.driver_id) {
          whereClause.driver_id = filters.driver_id;
        }

        if (filters.vehicle_id) {
          whereClause.vehicle_id = filters.vehicle_id;
        }

        // Inicializar el objeto de fecha si es necesario
        if (filters.from_date || filters.to_date) {
          whereClause.delivery_date = {};
        }

        if (filters.from_date) {
          whereClause.delivery_date = {
            ...(whereClause.delivery_date as Prisma.DateTimeFilter),
            gte: new Date(filters.from_date)
          };
        }

        if (filters.to_date) {
          whereClause.delivery_date = {
            ...(whereClause.delivery_date as Prisma.DateTimeFilter),
            lte: new Date(filters.to_date)
          };
        }
      }

      // Aplicar paginación
      const page = filters?.page || 1;
      const limit = filters?.limit || 10;
      const skip = (page - 1) * limit;

      // Obtener el total de registros
      const totalRouteSheets = await this.route_sheet.count({ where: whereClause });

      // Obtener las hojas de ruta
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
        skip,
        take: limit,
        orderBy: { delivery_date: 'desc' }
      });

      // Transformar los resultados
      const data = routeSheets.map(routeSheet => this.mapToRouteSheetResponseDto(routeSheet));

      // Retornar con metadatos de paginación
      return {
        data,
        meta: {
          total: totalRouteSheets,
          page,
          limit,
          totalPages: Math.ceil(totalRouteSheets / limit)
        }
      };
    } catch (error) {
      console.error('Error al obtener las hojas de ruta:', error);
      throw new InternalServerErrorException('Error al obtener las hojas de ruta');
    }
  }

  /**
   * Obtiene una hoja de ruta por su ID
   */
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
      throw new NotFoundException(`Hoja de ruta con ID ${id} no encontrada`);
    }

    return this.mapToRouteSheetResponseDto(routeSheet);
  }

  /**
   * Actualiza una hoja de ruta por su ID
   */
  async update(id: number, updateRouteSheetDto: UpdateRouteSheetDto): Promise<RouteSheetResponseDto> {
    // Verificar que la hoja de ruta existe
    await this.findOne(id);

    const { driver_id, vehicle_id, delivery_date, route_notes, details } = updateRouteSheetDto;
    
    try {
      if (driver_id) {
        // Verificar que el conductor existe
        const driver = await this.user.findUnique({ where: { id: driver_id } });
        if (!driver) {
          throw new BadRequestException(`El conductor con ID ${driver_id} no existe`);
        }
      }

      if (vehicle_id) {
        // Verificar que el vehículo existe
        const vehicle = await this.vehicle.findUnique({ where: { vehicle_id } });
        if (!vehicle) {
          throw new BadRequestException(`El vehículo con ID ${vehicle_id} no existe`);
        }
      }

      // Actualizar dentro de una transacción
      const result = await this.$transaction(async (tx) => {
        // Actualizar datos básicos de la hoja de ruta
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

        // Si se proporcionan detalles, actualizarlos
        if (details && details.length > 0) {
          for (const detail of details) {
            if (detail.route_sheet_detail_id) {
              // Actualizar detalle existente
              await tx.route_sheet_detail.update({
                where: { route_sheet_detail_id: detail.route_sheet_detail_id },
                data: {
                  delivery_status: detail.delivery_status,
                  comments: detail.comments
                }
              });
            } else if (detail.order_id) {
              // Agregar nuevo detalle
              // Verificar que el pedido existe
              const order = await tx.order_header.findUnique({
                where: { order_id: detail.order_id }
              });
              if (!order) {
                throw new BadRequestException(`El pedido con ID ${detail.order_id} no existe`);
              }

              // Verificar si el pedido ya está asignado a otra hoja de ruta para esa fecha
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

        // Obtener la hoja de ruta actualizada con todos sus detalles
        return await tx.route_sheet.findUnique({
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

      // Verificar si el resultado es nulo antes de mapearlo
      if (!result) {
        throw new InternalServerErrorException(`Error al obtener la hoja de ruta actualizada ${id}`);
      }

      return this.mapToRouteSheetResponseDto(result);
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      console.error(`Error al actualizar la hoja de ruta ${id}:`, error);
      throw new InternalServerErrorException(`Error al actualizar la hoja de ruta ${id}`);
    }
  }

  /**
   * Elimina una hoja de ruta por su ID
   */
  async remove(id: number): Promise<{ message: string; deleted: boolean }> {
    // Verificar que la hoja de ruta existe
    await this.findOne(id);

    try {
      await this.$transaction(async (tx) => {
        // Eliminar primero los detalles
        await tx.route_sheet_detail.deleteMany({
          where: { route_sheet_id: id }
        });

        // Eliminar la hoja de ruta
        await tx.route_sheet.delete({
          where: { route_sheet_id: id }
        });
      });

      return {
        message: `Hoja de ruta con ID ${id} eliminada correctamente`,
        deleted: true
      };
    } catch (error) {
      console.error(`Error al eliminar la hoja de ruta ${id}:`, error);
      throw new InternalServerErrorException(`Error al eliminar la hoja de ruta ${id}`);
    }
  }

  /**
   * Genera un documento PDF para imprimir la hoja de ruta
   */
  async generatePrintableDocument(route_sheet_id: number, options?: any): Promise<{ url: string; filename: string }> {
    try {
      // 1. Obtener los datos completos de la hoja de ruta
      const routeSheet = await this.findOne(route_sheet_id);
      
      // 2. Configurar nombre de archivo y ruta
      const filename = `route_sheet_${route_sheet_id}_${new Date().toISOString().split('T')[0]}.pdf`;
      const pdfDir = await this.ensurePdfDirectoryExists();
      const pdfPath = join(pdfDir, filename);
      
      // 3. Crear el documento PDF
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const writeStream = fs.createWriteStream(pdfPath);
      
      // Configurar pipe para escribir a archivo
      doc.pipe(writeStream);
      
      // 4. Añadir contenido al PDF
      await this.generatePdfContent(doc, routeSheet, options);
      
      // 5. Finalizar el PDF
      doc.end();
      
      // 6. Esperar a que termine de escribir
      await new Promise<void>((resolve, reject) => {
        writeStream.on('finish', () => resolve());
        writeStream.on('error', reject);
      });
      
      // 7. Configurar URL para acceder al PDF
      const url = `/pdfs/${filename}`;
      
      return { url, filename };
    } catch (error) {
      console.error(`Error al generar PDF para hoja de ruta ${route_sheet_id}:`, error);
      throw new InternalServerErrorException(`Error al generar PDF para hoja de ruta ${route_sheet_id}`);
    }
  }

  /**
   * Genera el contenido del PDF con toda la información de la hoja de ruta
   */
  private async generatePdfContent(doc: PDFKit.PDFDocument, routeSheet: RouteSheetResponseDto, options?: any): Promise<void> {
    // Configuración de opciones
    const includeMap = options?.includeMap || false;
    const includeSignatureField = options?.includeSignatureField !== false; // Por defecto true
    const includeProductDetails = options?.includeProductDetails !== false; // Por defecto true
    
    // 1. Encabezado
    doc.fontSize(20).text('HOJA DE RUTA', { align: 'center' });
    doc.moveDown();
    
    // 2. Información general
    doc.fontSize(12).text(`Hoja de Ruta #: ${routeSheet.route_sheet_id}`, { continued: true });
    doc.text(`Fecha: ${routeSheet.delivery_date}`, { align: 'right' });
    doc.moveDown(0.5);
    
    // 3. Información del conductor y vehículo
    doc.fontSize(12).font('Helvetica-Bold').text('Datos del Conductor:');
    doc.font('Helvetica').text(`Nombre: ${routeSheet.driver.name}`);
    doc.text(`Email: ${routeSheet.driver.email}`);
    doc.moveDown(0.5);
    
    doc.fontSize(12).font('Helvetica-Bold').text('Datos del Vehículo:');
    doc.font('Helvetica').text(`Código: ${routeSheet.vehicle.code}`);
    doc.text(`Descripción: ${routeSheet.vehicle.name}`);
    
    // 4. Notas de la ruta
    if (routeSheet.route_notes) {
      doc.moveDown(0.5);
      doc.fontSize(12).font('Helvetica-Bold').text('Notas:');
      doc.font('Helvetica').text(routeSheet.route_notes);
    }
    
    doc.moveDown();
    
    // 5. Tabla de Pedidos
    doc.fontSize(14).font('Helvetica-Bold').text('PEDIDOS A ENTREGAR', { align: 'center' });
    doc.moveDown();
    
    // Encabezados de la tabla
    const startX = 50;
    let currentY = doc.y;
    const lineHeight = 20;
    
    // Dibujar encabezados
    doc.font('Helvetica-Bold').fontSize(10);
    doc.text('#', startX, currentY, { width: 30 });
    doc.text('Cliente', startX + 30, currentY, { width: 120 });
    doc.text('Dirección', startX + 150, currentY, { width: 150 });
    doc.text('Teléfono', startX + 300, currentY, { width: 80 });
    doc.text('Estado', startX + 380, currentY, { width: 80 });
    
    currentY += lineHeight;
    doc.moveTo(startX, currentY).lineTo(startX + 460, currentY).stroke();
    currentY += 5;
    
    // Detalles de pedidos
    doc.font('Helvetica').fontSize(10);
    
    for (const detail of routeSheet.details) {
      // Verificar si necesitamos una nueva página
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
      
      // Si se solicitan detalles de productos
      if (includeProductDetails && detail.order.items.length > 0) {
        doc.text('Productos:', startX + 20, currentY);
        currentY += lineHeight - 5;
        
        for (const item of detail.order.items) {
          doc.text(`- ${item.quantity}x ${item.product.description}`, startX + 30, currentY);
          currentY += lineHeight - 5;
        }
        
        currentY += 5;
      }
      
      // Línea separadora entre pedidos
      doc.moveTo(startX, currentY).lineTo(startX + 460, currentY).stroke();
      currentY += 10;
    }
    
    // 6. Campos para firma si se solicitan
    if (includeSignatureField) {
      // Verificar si necesitamos una nueva página
      if (currentY > doc.page.height - 150) {
        doc.addPage();
        currentY = 50;
      }
      
      doc.moveDown();
      currentY = doc.y;
      
      doc.fontSize(12).font('Helvetica-Bold').text('CONFIRMACIÓN DE ENTREGAS', { align: 'center' });
      doc.moveDown();
      currentY = doc.y;
      
      // Campo de firma del conductor
      doc.font('Helvetica').text('Firma del Conductor:', startX, currentY);
      currentY += lineHeight;
      doc.moveTo(startX, currentY).lineTo(startX + 200, currentY).stroke();
      
      // Campo de firma del supervisor
      doc.font('Helvetica').text('Firma del Supervisor:', startX + 250, currentY - lineHeight);
      doc.moveTo(startX + 250, currentY).lineTo(startX + 450, currentY).stroke();
    }
    
    // 7. Fecha y hora de impresión
    doc.fontSize(8);
    doc.text(`Documento generado el: ${new Date().toLocaleString()}`, 50, doc.page.height - 50);
  }

  /**
   * Mapea una entidad route_sheet a su DTO de respuesta
   */
  private mapToRouteSheetResponseDto(routeSheet: RouteSheetWithDetails): RouteSheetResponseDto {
    // Mapear driver (conductor)
    const driverDto: DriverDto = {
      id: routeSheet.driver.id,
      name: routeSheet.driver.name,
      email: routeSheet.driver.email
    };

    // Mapear vehicle (vehículo)
    const vehicleDto: VehicleDto = {
      vehicle_id: routeSheet.vehicle.vehicle_id,
      code: routeSheet.vehicle.code,
      name: routeSheet.vehicle.name
    };

    // Mapear los detalles
    // Primero, ordenamos los detalles por sequence_number para determinar la entrega actual
    const sortedDetails = [...routeSheet.route_sheet_detail].sort((a, b) => {
      // Manejar casos donde sequence_number pueda ser null o undefined
      // Los que tienen sequence_number van primero y se ordenan por él
      // Los que no tienen sequence_number (null/undefined) van al final
      if (a.sequence_number === null || a.sequence_number === undefined) return 1;
      if (b.sequence_number === null || b.sequence_number === undefined) return -1;
      return a.sequence_number - b.sequence_number;
    });

    let currentDeliveryFound = false;
    const detailsDto: RouteSheetDetailResponseDto[] = sortedDetails.map(detail => {
      // Mapear customer (cliente)
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

      // Mapear order items (ítems del pedido)
      const orderItemsDto: OrderItemDto[] = detail.order_header.order_item.map(item => {
        // Mapear product (producto)
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

      // Mapear order (pedido)
      const orderDto: OrderDto = {
        order_id: detail.order_header.order_id,
        order_date: detail.order_header.order_date.toISOString(),
        total_amount: detail.order_header.total_amount.toString(),
        status: detail.order_header.status,
        customer: customerDto,
        items: orderItemsDto
      };

      // Convertir valores null a undefined para satisfacer los tipos
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

    // Construir el DTO completo
    return new RouteSheetResponseDto({
      route_sheet_id: routeSheet.route_sheet_id,
      driver: driverDto,
      vehicle: vehicleDto,
      delivery_date: routeSheet.delivery_date.toISOString().split('T')[0], // solo fecha YYYY-MM-DD
      route_notes: routeSheet.route_notes || undefined,
      details: detailsDto
    });
  }

  /**
   * Registra la rendición de una hoja de ruta por parte del chofer.
   * @param route_sheet_id ID de la hoja de ruta a rendir.
   * @param reconcileDto DTO con la firma del chofer.
   * @returns La hoja de ruta actualizada.
   */
  async reconcileRouteSheetByDriver(route_sheet_id: number, reconcileDto: ReconcileRouteSheetDto): Promise<RouteSheetResponseDto> {
    const { signature_data } = reconcileDto;

    try {
      const routeSheet = await this.route_sheet.findUnique({
        where: { route_sheet_id },
      });

      if (!routeSheet) {
        throw new NotFoundException(`Hoja de ruta con ID ${route_sheet_id} no encontrada.`);
      }

      if (routeSheet.reconciliation_at) {
        throw new BadRequestException(
          `La hoja de ruta ${route_sheet_id} ya fue rendida el ${routeSheet.reconciliation_at.toISOString()}.`
        );
      }

      // Guardar la firma del chofer
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
        include: { // Incluir relaciones para el mapeo de respuesta
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

      return this.mapToRouteSheetResponseDto(updatedRouteSheet as any); // Usar el mapeador existente
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      console.error(`Error al rendir la hoja de ruta ${route_sheet_id}:`, error);
      throw new InternalServerErrorException('Error al procesar la rendición de la hoja de ruta.');
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
            route_sheet: true, // Para verificar que el chofer está asignado a esta hoja de ruta
        }
    });

    if (!routeSheetDetail) {
        throw new NotFoundException(`Detalle de hoja de ruta con ID ${detailId} no encontrado.`);
    }

    // if (routeSheetDetail.route_sheet.driver_id !== userId) { // Comparamos con userId
    //     throw new ForbiddenException('No tienes permiso para registrar pagos en esta hoja de ruta.');
    // }

    const order = routeSheetDetail.order_header;
    if (!order) {
        throw new NotFoundException(`Pedido asociado al detalle de hoja de ruta ${detailId} no encontrado.`);
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

    // Lógica principal dentro de una transacción
    const paymentTransactionResult = await this.$transaction(async (tx) => {
        // TODO: Implementar creación de payment_transaction y actualización de order_header
        // Por ahora, solo un placeholder

        const orderCurrentPaidAmount = new Decimal(order.paid_amount);
        const orderTotalAmount = new Decimal(order.total_amount);
        const remainingBalance = orderTotalAmount.minus(orderCurrentPaidAmount);

        if (paymentAmount.greaterThan(remainingBalance.plus(0.001))) { // 0.001 para evitar problemas de precisión con decimales
            throw new BadRequestException(
                `El monto del pago (${paymentAmount}) excede el saldo pendiente (${remainingBalance.toFixed(2)}) del pedido ${order.order_id}.`
            );
        }
        
        // Crear la transacción de pago
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
                user_id: userId, // Registrar qué usuario (chofer/admin) registró el pago
                notes: recordPaymentDto.notes,
            }
        });

        // Actualizar el pedido
        const newPaidAmount = orderCurrentPaidAmount.plus(paymentAmount);
        let newOrderStatus = order.status;
        if (newPaidAmount.greaterThanOrEqualTo(orderTotalAmount)) {
            newOrderStatus = "PAID"; 
        }

        const updatedOrder = await tx.order_header.update({
            where: { order_id: order.order_id },
            data: {
                paid_amount: newPaidAmount.toString(),
                status: newOrderStatus,
            }
        });

        // Opcional: Actualizar estado de route_sheet_detail si el pago implica entrega completa
        // Esto dependerá de tu flujo de negocio.
        // await tx.route_sheet_detail.update({
        //     where: { route_sheet_detail_id: detailId },
        //     data: { delivery_status: 'DELIVERED' } // Si el pago significa entrega
        // });

        return paymentTransaction; // Devolver la transacción creada
    });

    return paymentTransactionResult; // Devolver el resultado de la transacción
  }

  async skipDelivery(
    detailId: number, 
    dto: SkipDeliveryDto, 
    userId: number // El ID del chofer que realiza la acción
  ): Promise<RouteSheetDetailResponseDto> { // Podríamos devolver el detalle actualizado

    const routeSheetDetail = await this.route_sheet_detail.findUnique({
      where: { route_sheet_detail_id: detailId },
      include: { 
        route_sheet: true, // Para verificar asignación del chofer
        order_header: { // Necesario para mapear a RouteSheetDetailResponseDto
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
      throw new NotFoundException(`Detalle de hoja de ruta con ID ${detailId} no encontrado.`);
    }

    // Opcional: Verificar si el chofer (userId) está asignado a esta hoja de ruta
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
          this.deliveryEvidencePath, // Usar un directorio específico para estas evidencias
          `skip_evidence_detail_${detailId}`
        );
      } catch (error) {
        // No bloquear la operación si falla el guardado de la foto, pero registrar el error
        console.error(`Error al guardar foto de evidencia para entrega saltada ${detailId}:`, error);
        // Podríamos lanzar un error diferente o simplemente continuar sin la foto.
      }
    }

    const updatedDetail = await this.route_sheet_detail.update({
      where: { route_sheet_detail_id: detailId },
      data: {
        delivery_status: 'SKIPPED', // O un estado más específico como 'UNDELIVERED_CLIENT_ABSENT'
        rejection_reason: dto.reason, // Guardar el motivo del enum
        comments: dto.notes || routeSheetDetail.comments, // Mantener comentarios existentes si no hay nuevos
        // Usar digital_signature_id para la foto por ahora, idealmente sería un campo dedicado
        digital_signature_id: evidencePhotoFileName || routeSheetDetail.digital_signature_id,
        delivery_time: new Date(), // Registrar cuándo se marcó como saltada
      },
      include: { // Re-incluir para mapear a la respuesta completa
        order_header: {
            include: {
                customer: true,
                order_item: { include: { product: true } }
            }
        }
      }
    });

    // Por ahora, construyo el DTO manualmente de forma simplificada.
    // NOTA: Esto es una simplificación. Un mapeador robusto sería mejor.
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
    // is_current_delivery se calcularía si devolvemos toda la hoja de ruta, aquí no es tan relevante.
    return responseDto;
  }
} 