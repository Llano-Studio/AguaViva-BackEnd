import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import * as PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as fsExtra from 'fs-extra';
import * as path from 'path';
import { join, dirname } from 'path';
import { TempFileManagerService } from './temp-file-manager.service';
import { GenerateRouteSheetDto, RouteSheetResponseDto } from '../../orders/dto/generate-route-sheet.dto';
import { isValidYMD, parseYMD, formatLocalYMD } from '../utils/date.utils';

export interface RouteSheetZone {
  zone_id: number;
  name: string;
  collections: RouteSheetCollection[];
  summary: {
    total_collections: number;
    total_amount: string;
    overdue_collections: number;
    overdue_amount: string;
  };
}

export interface RouteSheetCollection {
  order_id: number;
  customer: {
    customer_id: number;
    name: string;
    address: string;
    phone: string;
    zone_name: string;
  };
  amount: string;
  due_date: string | null;
  days_overdue: number;
  priority: number;
  notes: string;
  status: string;
}

export interface RouteSheetDriver {
  driver_id: number;
  name: string;
  license_number: string;
  phone: string;
}

export interface RouteSheetVehicle {
  vehicle_id: number;
  license_plate: string;
  model: string;
  capacity: number;
}

// Interfaces para hojas de ruta de cobranzas automáticas (PDFs modernos)
export interface CollectionRouteSheetPdfData {
  route_sheet_id: number;
  delivery_date: string;
  driver: {
    name: string;
    email: string;
  };
  vehicle: {
    code: string;
    name: string;
  };
  route_notes?: string;
  zone_identifiers?: string[];
  collections: Array<{
    cycle_payment_id: number;
    customer: {
      name: string;
      address: string;
      phone: string;
      zone?: {
        zone_id: number;
        code: string;
        name: string;
      };
      locality?: {
        locality_id: number;
        code: string;
        name: string;
      };
    };
    amount: number;
    payment_due_date: string;
    cycle_period: string;
    subscription_plan: string;
    delivery_status: string;
    delivery_time?: string;
    comments?: string;
    subscription_id?: number;
    credits?: Array<{
      product_description: string;
      planned_quantity: number;
      delivered_quantity: number;
      remaining_balance: number;
    }>;
  }>;
}

@Injectable()
export class RouteSheetGeneratorService extends PrismaClient {
  private readonly logger = new Logger(RouteSheetGeneratorService.name);
  
  // Configuración de colores para impresión en blanco y negro
  private readonly colors = {
    primary: '#000000',        // Negro sólido para encabezados
    secondary: '#333333',      // Gris oscuro
    bgPrimary: '#F5F5F5',      // Gris muy claro para fondos alternados
    bgSecondary: '#E0E0E0',    // Gris claro
    bgWhite: '#FFFFFF',        // Blanco
    textPrimary: '#000000',    // Negro para texto principal
    textWhite: '#FFFFFF',      // Blanco para texto sobre fondos oscuros
    textAccent: '#000000',     // Negro para acentos
    borderColor: '#CCCCCC',    // Gris medio para bordes
    successColor: '#DDDDDD',   // Gris claro (reemplaza verde)
    errorColor: '#999999',     // Gris medio (reemplaza rojo)
    warningColor: '#BBBBBB',   // Gris claro (reemplaza amarillo)
  };

  constructor(private readonly tempFileManager: TempFileManagerService) {
    super();
  }

  /**
   * Genera una hoja de ruta para cobranzas automáticas
   */
  async generateRouteSheet(filters: GenerateRouteSheetDto): Promise<RouteSheetResponseDto> {
    try {
      let targetDate: Date;
      if (filters.date) {
        if (!isValidYMD(filters.date)) {
          throw new BadRequestException('La fecha debe estar en formato YYYY-MM-DD válido');
        }
        targetDate = parseYMD(filters.date);
      } else {
        targetDate = new Date();
        targetDate.setHours(0, 0, 0, 0);
      }

      // Validar que el vehículo tenga las zonas asignadas si se especifican zoneIds
      if (filters.vehicleId && filters.zoneIds && filters.zoneIds.length > 0) {
        await this.validateVehicleZones(filters.vehicleId, filters.zoneIds);
      }

      const collections = await this.getCollectionsForRouteSheet(filters, targetDate);
      const zones = this.groupCollectionsByZone(collections);
      const driver = await this.getDriverInfo(filters.driverId);
      const vehicle = await this.getVehicleInfo(filters.vehicleId);

      const fileName = this.tempFileManager.generateUniqueFileName('route-sheet');
      const filePath = this.tempFileManager.getTempFilePath(fileName);

      await this.generateRouteSheetPdf(filePath, {
        targetDate,
        zones,
        driver,
        vehicle,
        notes: filters.notes,
      });

      // Verificación básica del archivo generado
      try {
        const stats = fs.statSync(filePath);
        if (!stats || stats.size === 0) {
          throw new Error('El PDF generado está vacío');
        }
      } catch (e) {
        this.logger.error(`PDF inválido o no generado en ${filePath}`, e as any);
        throw new Error(`Fallo al escribir el PDF: ${(e as Error).message}`);
      }

      const fileInfo = this.tempFileManager.createTempFileInfo(fileName, 60);

      const summary = this.calculateSummary(zones);

      return {
        success: true,
        message: 'Hoja de ruta generada exitosamente',
        downloadUrl: fileInfo.downloadUrl,
        routeSheet: {
          date: formatLocalYMD(targetDate),
          generated_at: new Date().toISOString(),
          driver,
          vehicle,
          zones,
          summary,
          notes: filters.notes,
        },
      };
    } catch (error) {
      this.logger.error('Error generando hoja de ruta:', error);
      throw new Error(`Error generando hoja de ruta: ${error.message}`);
    }
  }

  /**
   * Genera y persiste un PDF de hoja de ruta en /public/pdfs/collections
   * Devuelve una URL de descarga estable para mostrar en el frontend
   */
  async generateRouteSheetAndPersist(
    filters: GenerateRouteSheetDto,
  ): Promise<RouteSheetResponseDto> {
    try {
      let targetDate: Date;
      if (filters.date) {
        if (!isValidYMD(filters.date)) {
          throw new BadRequestException('La fecha debe estar en formato YYYY-MM-DD válido');
        }
        targetDate = parseYMD(filters.date);
      } else {
        targetDate = new Date();
        targetDate.setHours(0, 0, 0, 0);
      }

      if (filters.vehicleId && filters.zoneIds && filters.zoneIds.length > 0) {
        await this.validateVehicleZones(filters.vehicleId, filters.zoneIds);
      }

      const collections = await this.getCollectionsForRouteSheet(filters, targetDate);
      const zones = this.groupCollectionsByZone(collections);
      const driver = await this.getDriverInfo(filters.driverId);
      const vehicle = await this.getVehicleInfo(filters.vehicleId);

      // Asegurar directorio de persistencia
      const persistDir = path.join(process.cwd(), 'public', 'pdfs', 'collections');
      if (!fs.existsSync(persistDir)) {
        fs.mkdirSync(persistDir, { recursive: true });
      }

      // Construir nombre de archivo estable con formato solicitado (sin prefijos)
      // Formato: cobranza-automatica-hoja-de-ruta_YYYY-MM-DD_<movil-nombre|NA>_<zonas-nombres|all>_<driver-nombre|NA>.pdf
      const datePart = formatLocalYMD(targetDate);
      const zoneIds = Array.isArray(filters.zoneIds) && filters.zoneIds.length > 0
        ? [...filters.zoneIds].sort((a, b) => a - b)
        : [];

      // Resolver nombres de zonas según los zoneIds, manteniendo orden estable
      let zonesPart = 'all';
      if (zoneIds.length > 0) {
        const zoneList = await this.zone.findMany({
          where: { zone_id: { in: zoneIds } },
          select: { zone_id: true, name: true },
        });
        const zoneNameById = new Map<number, string>(
          zoneList.map((z) => [z.zone_id, z.name])
        );
        const zoneNameSlugs = zoneIds.map((id) => {
          const name = zoneNameById.get(id) ?? String(id);
          return this.slugifyForFilename(name);
        });
        const joined = zoneNameSlugs.join('-');
        // Evitar nombres de archivo excesivamente largos en Windows
        zonesPart = joined.length > 80 ? `multi-${zoneIds.length}` : joined;
      }

      // Usar nombre del móvil/vehículo y del chofer en formato slug
      const vehiclePart = vehicle?.model
        ? `${this.slugifyForFilename(vehicle.model)}`
        : 'NA';
      const driverPart = driver?.name
        ? `${this.slugifyForFilename(driver.name)}`
        : 'NA';
      const baseName = `cobranza-automatica-hoja-de-ruta_${datePart}_${vehiclePart}_${zonesPart}_${driverPart}.pdf`;
      const filePath = path.join(persistDir, baseName);

      // Evitar duplicados: si existe, reescribirlo con contenido actualizado
      await this.generateRouteSheetPdf(filePath, {
        targetDate,
        zones,
        driver,
        vehicle,
        notes: filters.notes,
      });

      const downloadUrl = `/public/pdfs/collections/${baseName}`;
      const summary = this.calculateSummary(zones);

      return {
        success: true,
        message: 'Hoja de ruta generada y persistida exitosamente',
        downloadUrl,
        routeSheet: {
          date: datePart,
          generated_at: new Date().toISOString(),
          driver,
          vehicle,
          zones,
          summary,
          notes: filters.notes,
        },
      };
    } catch (error) {
      this.logger.error('Error generando y persistiendo hoja de ruta:', error);
      throw new Error(`Error generando y persistiendo hoja de ruta: ${error.message}`);
    }
  }

  /**
   * Convierte una cadena en slug seguro para nombres de archivo
   */
  private slugifyForFilename(input: string): string {
    return input
      .toString()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // quitar acentos
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase();
  }

  // Método legacy de cálculo de versión eliminado; el nuevo formato usa m/z/d

  /**
   * Calcula el resumen de la hoja de ruta
   */
  private calculateSummary(zones: RouteSheetZone[]) {
    const totalCollections = zones.reduce((sum, zone) => sum + zone.summary.total_collections, 0);
    const totalAmount = zones.reduce((sum, zone) => sum + parseFloat(zone.summary.total_amount), 0);
    const overdueCollections = zones.reduce((sum, zone) => sum + zone.summary.overdue_collections, 0);
    const overdueAmount = zones.reduce((sum, zone) => sum + parseFloat(zone.summary.overdue_amount), 0);

    return {
      total_zones: zones.length,
      total_collections: totalCollections,
      total_amount: totalAmount.toFixed(2),
      overdue_collections: overdueCollections,
      overdue_amount: overdueAmount.toFixed(2),
      estimated_duration_hours: Math.ceil(totalCollections * 0.25), // 15 min por cobranza
    };
  }

  /**
   * Obtiene las cobranzas para la hoja de ruta
   */
  private async getCollectionsForRouteSheet(
    filters: GenerateRouteSheetDto,
    targetDate: Date
  ): Promise<any[]> {
    // Rango de día robusto (00:00:00 a 23:59:59)
    const dayStart = new Date(targetDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

    // Construir cláusula WHERE tolerante:
    // - is_active=true y order_type='ONE_OFF'
    // - Coincidir por order_date O scheduled_delivery_date dentro del día
    // - Considerar órdenes automáticas modernas (es_automatica=true)
    //   y órdenes automáticas legacy (notas que contienen 'COBRANZA AUTOMÁTICA')
    const whereClause: Prisma.collection_ordersWhereInput = {
      order_type: 'ONE_OFF',
      is_active: true,
      AND: [
        {
          OR: [
            { order_date: { gte: dayStart, lt: dayEnd } },
            { scheduled_delivery_date: { gte: dayStart, lt: dayEnd } },
          ],
        },
      ],
      OR: [
        { es_automatica: true },
        { notes: { contains: 'COBRANZA AUTOMÁTICA', mode: 'insensitive' } },
      ],
    };

    // Filtro por zonas: aceptar tanto el zone_id del pedido como el del cliente
    if (filters.zoneIds && filters.zoneIds.length > 0) {
      (whereClause.AND as any[]).push({
        OR: [
          { zone_id: { in: filters.zoneIds } },
          { customer: { is: { zone_id: { in: filters.zoneIds } } } },
        ],
      });
    }

    if (filters.overdueOnly === 'true') {
      (whereClause.AND as any[]).push({
        payment_status: { in: ['PENDING', 'OVERDUE'] },
      });
    }

    if (filters.minAmount) {
      (whereClause.AND as any[]).push({
        total_amount: { gte: new Prisma.Decimal(filters.minAmount) },
      });
    }

    const orderBy = this.getOrderBy(filters.sortBy);

    return await this.collection_orders.findMany({
      where: whereClause,
      include: {
        customer: {
          include: {
            zone: true,
          },
        },
        customer_subscription: {
          include: {
            subscription_cycle: {
              where: {
                pending_balance: { gt: 0 },
              },
              orderBy: { payment_due_date: 'desc' },
              take: 1,
            },
          },
        },
      },
      orderBy,
    });
  }

  /**
   * Obtiene el criterio de ordenamiento
   */
  private getOrderBy(sortBy?: string) {
    switch (sortBy) {
      case 'zone':
        return { customer: { zone: { name: 'asc' as const } } };
      case 'amount':
        return { total_amount: 'desc' as const };
      default:
        return { order_date: 'asc' as const };
    }
  }

  /**
   * Agrupa las cobranzas por zona
   */
  private groupCollectionsByZone(collections: any[]): RouteSheetZone[] {
    const zoneGroups = new Map<number, RouteSheetZone>();

    collections.forEach((collection) => {
      const zone = (collection as any).customer.zone;
      const zoneKey = zone ? zone.zone_id : 0;
      const zoneName = zone ? zone.name : 'Sin zona';

      if (!zoneGroups.has(zoneKey)) {
        zoneGroups.set(zoneKey, {
          zone_id: zoneKey,
          name: zoneName,
          collections: [],
          summary: {
            total_collections: 0,
            total_amount: '0.00',
            overdue_collections: 0,
            overdue_amount: '0.00',
          },
        });
      }

      const collectionData = this.createCollectionData(collection, zoneName);
      const zoneData = zoneGroups.get(zoneKey)!;
      
      zoneData.collections.push(collectionData);
      this.updateZoneSummary(zoneData, collection, collectionData.days_overdue > 0);
    });

    return Array.from(zoneGroups.values());
  }

  /**
   * Crea los datos de una cobranza
   */
  private createCollectionData(collection: any, zoneName: string): RouteSheetCollection {
    const today = new Date();
    const dueDate = collection.customer_subscription?.subscription_cycle?.[0]?.payment_due_date;
    const isOverdue = dueDate ? dueDate < today : false;
    const daysOverdue = isOverdue && dueDate 
      ? Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    return {
      order_id: (collection as any).collection_order_id ?? collection.order_id,
      customer: {
        customer_id: collection.customer_id,
        name: collection.customer.name,
        address: collection.customer.address || 'Sin dirección',
        phone: collection.customer.phone,
        zone_name: zoneName,
      },
      amount: collection.total_amount.toString(),
      due_date: dueDate?.toISOString() || null,
      days_overdue: daysOverdue,
      priority: isOverdue ? (daysOverdue > 30 ? 1 : 2) : 3,
      notes: collection.notes,
      status: collection.status,
    };
  }

  /**
   * Actualiza el resumen de la zona
   */
  private updateZoneSummary(zoneData: RouteSheetZone, collection: any, isOverdue: boolean): void {
    const amount = parseFloat(collection.total_amount.toString());
    
    zoneData.summary.total_collections++;
    zoneData.summary.total_amount = (
      parseFloat(zoneData.summary.total_amount) + amount
    ).toFixed(2);
    
    if (isOverdue) {
      zoneData.summary.overdue_collections++;
      zoneData.summary.overdue_amount = (
        parseFloat(zoneData.summary.overdue_amount) + amount
      ).toFixed(2);
    }
  }

  /**
   * Obtiene información del conductor
   */
  private async getDriverInfo(driverId?: number): Promise<RouteSheetDriver | undefined> {
    if (!driverId) return undefined;

    // Fuente de verdad para choferes: User (usuarios del sistema)
    const user = await this.user.findUnique({
      where: { id: driverId },
      select: { id: true, name: true },
    });

    if (!user) return undefined;

    return {
      driver_id: user.id,
      name: user.name,
      license_number: 'N/A',
      phone: '',
    };
  }

  /**
   * Obtiene información del vehículo
   */
  private async getVehicleInfo(vehicleId?: number): Promise<RouteSheetVehicle | undefined> {
    if (!vehicleId) return undefined;

    const vehicle = await this.vehicle.findUnique({
      where: { vehicle_id: vehicleId },
    });

    if (!vehicle) return undefined;

    return {
      vehicle_id: vehicle.vehicle_id,
      license_plate: vehicle.code,
      model: vehicle.name,
      capacity: 0, // Capacidad por defecto
    };
  }

  /**
   * Valida que el vehículo tenga las zonas asignadas
   */
  private async validateVehicleZones(vehicleId: number, zoneIds: number[]): Promise<void> {
    // Obtener las zonas activas asignadas al vehículo
    const vehicleZones = await this.vehicle_zone.findMany({
      where: {
        vehicle_id: vehicleId,
        is_active: true,
      },
      select: {
        zone_id: true,
      },
    });

    const assignedZoneIds = vehicleZones.map(vz => vz.zone_id);
    const missingZones = zoneIds.filter(zoneId => !assignedZoneIds.includes(zoneId));

    if (missingZones.length > 0) {
      // Obtener los nombres de las zonas faltantes para un mensaje más descriptivo
      const missingZoneDetails = await this.zone.findMany({
        where: {
          zone_id: { in: missingZones },
        },
        select: {
          zone_id: true,
          name: true,
        },
      });

      const missingZoneNames = missingZoneDetails.map(z => `${z.name} (ID: ${z.zone_id})`).join(', ');
      
      throw new BadRequestException(
        `El vehículo con ID ${vehicleId} no tiene asignadas las siguientes zonas: ${missingZoneNames}. ` +
        `Por favor, asigne estas zonas al vehículo antes de generar la hoja de ruta.`
      );
    }
  }

  /**
   * Genera el PDF de la hoja de ruta con diseño moderno
   */
  private async generateRouteSheetPdf(
    filePath: string,
    data: {
      targetDate: Date;
      zones: RouteSheetZone[];
      driver?: RouteSheetDriver;
      vehicle?: RouteSheetVehicle;
      notes?: string;
    }
  ): Promise<void> {
    const { targetDate, zones, driver, vehicle, notes } = data;

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // Registrar fuentes Poppins
    const fontsPath = join(process.cwd(), 'public', 'fonts');
    doc.registerFont('Poppins', join(fontsPath, 'Poppins-Regular.ttf'));
    doc.registerFont('Poppins-Bold', join(fontsPath, 'Poppins-Bold.ttf'));

    let currentY = 50;

    // Header moderno
    currentY = this.generateModernPdfHeader(doc, targetDate, currentY);
    currentY += 20;

    // Información del conductor y vehículo con diseño moderno
    currentY = this.generateModernDriverVehicleInfo(doc, driver, vehicle, currentY);
    currentY += 20;

    // Notas de ruta
    if (notes) {
      currentY = this.generateModernRouteNotes(doc, notes, currentY);
      currentY += 20;
    }

    // Tabla de cobranzas con diseño moderno
    currentY = this.generateModernCollectionsTable(doc, zones, currentY);
    currentY += 30;

    // Sección de firmas
    this.generateModernSignatureSection(doc, currentY);

    doc.end();

    await new Promise<void>((resolve, reject) => {
      stream.on('finish', () => resolve());
      stream.on('error', (err) => reject(err));
      doc.on('error', (err) => reject(err));
    });
  }

  /**
   * Genera el header del PDF con diseño moderno
   */
  private generateModernPdfHeader(doc: PDFKit.PDFDocument, targetDate: Date, currentY: number): number {
    // Línea superior decorativa
    doc.rect(50, currentY, 520, 3).fill(this.colors.primary);
    currentY += 15;

    // Título principal
    doc.fontSize(20)
       .font('Poppins-Bold')
       .fillColor(this.colors.primary)
       .text('HOJA DE RUTA - COBRANZAS AUTOMÁTICAS', 50, currentY, { align: 'left' });
    
    currentY += 30;

    // Información básica - solo fecha
    doc.fontSize(14)
       .font('Poppins')
       .fillColor(this.colors.textPrimary);
    
    const displayDate = this.formatDateForDisplay(targetDate.toISOString());
    doc.text(`Fecha: ${displayDate}`, 50, currentY);
    
    currentY += 20;
    
    return currentY;
  }

  /**
   * Genera la información del conductor y vehículo con diseño moderno
   */
  private generateModernDriverVehicleInfo(
    doc: PDFKit.PDFDocument, 
    driver?: RouteSheetDriver, 
    vehicle?: RouteSheetVehicle,
    currentY: number = 50
  ): number {
    // Información del conductor
    if (driver) {
      doc.rect(50, currentY, 250, 70).fill(this.colors.bgPrimary).stroke(this.colors.borderColor);
      doc.rect(50, currentY, 4, 70).fill(this.colors.primary);
      
      doc.fontSize(14).font('Poppins-Bold').fillColor(this.colors.textPrimary);
      doc.text('CONDUCTOR', 70, currentY + 10);
      
      doc.fontSize(12).font('Poppins').fillColor(this.colors.textPrimary);
      doc.text(`Nombre: ${driver.name}`, 70, currentY + 30);
    }

    // Información del vehículo
    if (vehicle) {
      const vehicleX = 320;
      doc.rect(vehicleX, currentY, 250, 70).fill(this.colors.bgPrimary).stroke(this.colors.borderColor);
      doc.rect(vehicleX, currentY, 4, 70).fill(this.colors.secondary);
      
      doc.fontSize(14).font('Poppins-Bold').fillColor(this.colors.textPrimary);
      doc.text('VEHÍCULO', vehicleX + 20, currentY + 10);
      
      doc.fontSize(12).font('Poppins').fillColor(this.colors.textPrimary);
      doc.text(`Nombre: ${vehicle.model || 'N/A'}`, vehicleX + 20, currentY + 50);
      doc.text(`Código: ${vehicle.license_plate}`, vehicleX + 20, currentY + 30);
    }

    return currentY + 80;
  }

  /**
   * Genera las notas de ruta con diseño moderno
   */
  private generateModernRouteNotes(doc: PDFKit.PDFDocument, notes: string, currentY: number): number {
    doc.rect(50, currentY, 520, 50).fill(this.colors.warningColor).stroke(this.colors.borderColor);
    
    doc.fontSize(14).font('Poppins-Bold').fillColor(this.colors.textPrimary);
    doc.text('INSTRUCCIONES ESPECIALES', 70, currentY + 10);
    
    doc.fontSize(12).font('Poppins').fillColor(this.colors.textPrimary);
    doc.text(notes, 70, currentY + 30, { width: 480 });
    return currentY + 70;
  }

  /**
   * Genera la tabla de cobranzas con diseño moderno
   */
  private generateModernCollectionsTable(
    doc: PDFKit.PDFDocument, 
    zones: RouteSheetZone[], 
    currentY: number
  ): number {
    const startX = 50;
    const tableWidth = 520;
    const headerHeight = 35;
    
    // Headers de la tabla
    const headers = ['#', 'Cliente', 'Dirección', 'Teléfono', 'Monto', 'Venc.', 'Estado'];
    const colWidths = [30, 90, 120, 80, 60, 70, 70];
    
    // Header de la tabla
    let headerX = startX;
    doc.rect(startX, currentY, tableWidth, headerHeight)
       .fill(this.colors.primary);
    
    doc.fontSize(12)
       .font('Poppins-Bold')
       .fillColor(this.colors.textWhite);
    
    headers.forEach((header, index) => {
      doc.text(header, headerX + 5, currentY + 12, { 
        width: colWidths[index] - 10,
        align: 'center'
      });
      headerX += colWidths[index];
    });
    
    currentY += headerHeight;
    
    // Filas de datos
    let rowIndex = 0;
    zones.forEach((zone) => {
      zone.collections.forEach((collection) => {
        if (currentY > doc.page.height - 200) {
          doc.addPage();
          currentY = 50;
        }

        currentY = this.generateModernCollectionRow(
          doc, 
          collection, 
          rowIndex, 
          currentY, 
          startX, 
          colWidths
        );
        rowIndex++;
      });
    });
    
    return currentY;
  }

  /**
   * Genera una fila de la tabla de cobranzas con altura dinámica
   */
  private generateModernCollectionRow(
    doc: PDFKit.PDFDocument,
    collection: RouteSheetCollection,
    index: number,
    currentY: number,
    startX: number,
    colWidths: number[]
  ): number {
    const fillColor = index % 2 === 0 ? this.colors.bgWhite : this.colors.bgPrimary;
    
    // Preparar datos de cada columna
    const cellData: Array<{ text: string; align: 'center' | 'left' | 'right' }> = [
      { text: (index + 1).toString(), align: 'center' },
      { text: collection.customer.name, align: 'left' },
      { text: collection.customer.address || '-', align: 'center' },
      { text: collection.customer.phone || '-', align: 'center' },
      { text: `$${parseFloat(collection.amount).toFixed(2)}`, align: 'center' },
      { text: collection.due_date ? new Date(collection.due_date).toLocaleDateString('es-ES') : '-', align: 'center' },
      { text: this.translateCollectionStatus(collection.status), align: 'center' }
    ];

    // Calcular altura necesaria para cada celda
    const minRowHeight = 25;
    const padding = 10;
    let maxHeight = minRowHeight;

    doc.fontSize(10).font('Poppins');
    cellData.forEach((cell, colIndex) => {
      const textHeight = doc.heightOfString(cell.text, {
        width: colWidths[colIndex] - padding,
        align: cell.align
      });
      maxHeight = Math.max(maxHeight, textHeight + padding);
    });

    const tableWidth = colWidths.reduce((a, b) => a + b, 0);

    // Dibujar fondo de la fila con altura calculada
    doc.rect(startX, currentY, tableWidth, maxHeight).fill(fillColor);
    
    // Renderizar cada celda con texto multilínea
    let cellX = startX;
    doc.fontSize(10).font('Poppins').fillColor(this.colors.textPrimary);
    
    cellData.forEach((cell, colIndex) => {
      doc.text(cell.text, cellX + 5, currentY + 5, {
        width: colWidths[colIndex] - 10,
        align: cell.align,
        lineGap: 2
      });
      cellX += colWidths[colIndex];
    });
    
    // Bordes
    doc.strokeColor(this.colors.borderColor).lineWidth(0.5);
    
    let borderX = startX;
    colWidths.forEach(width => {
      doc.moveTo(borderX, currentY)
         .lineTo(borderX, currentY + maxHeight)
         .stroke();
      borderX += width;
    });
    
    // Borde inferior
    doc.moveTo(startX, currentY + maxHeight)
       .lineTo(startX + tableWidth, currentY + maxHeight)
       .stroke();
    
    return currentY + maxHeight;
  }

  /**
   * Traduce el estado de cobranza al español
   */
  private translateCollectionStatus(status: string): string {
    const statusMap = {
      'pending': 'PENDIENTE',
      'pendiente': 'PENDIENTE',
      'delivered': 'ENTREGADO',
      'entregado': 'ENTREGADO',
      'cancelled': 'CANCELADO',
      'cancelado': 'CANCELADO',
      'in_route': 'EN RUTA',
      'en_ruta': 'EN RUTA',
      'overdue': 'ATRASADO',
      'atrasado': 'ATRASADO',
    };
    
    return statusMap[status.toLowerCase()] || 'PENDIENTE';
  }

  /**
   * Genera la sección de firmas con diseño moderno
   */
  private generateModernSignatureSection(doc: PDFKit.PDFDocument, currentY: number): void {
    if (currentY > doc.page.height - 200) {
      doc.addPage();
      currentY = 50;
    }

    // Título de confirmación
    doc.rect(50, currentY, 520, 30).fill(this.colors.primary);
    doc.fillColor(this.colors.textWhite).fontSize(16).font('Poppins-Bold');
    doc.text('CONFIRMACIÓN DE ENTREGAS', 50, currentY + 8, {
      align: 'center',
      width: 520,
    });
    currentY += 50;

    const signatureHeight = 80;
    const signatureWidth = 250;

    // Firma del conductor
    doc.rect(50, currentY, signatureWidth, signatureHeight).fill(this.colors.bgWhite).stroke(this.colors.borderColor);
    doc.rect(50, currentY, 4, signatureHeight).fill(this.colors.primary);
    
    doc.fillColor(this.colors.textPrimary).fontSize(12).font('Poppins-Bold');
    doc.text('CONDUCTOR', 70, currentY + 10);
    
    doc.fontSize(10).font('Poppins').fillColor(this.colors.textPrimary);
    doc.text('Nombre: _________________________', 70, currentY + 30);
    doc.text('Fecha: _____ / _____ / _____', 70, currentY + 50);
    doc.text('Hora: _____ : _____', 70, currentY + 65);

    // Firma del supervisor
    const supervisorX = 320;
    doc.rect(supervisorX, currentY, signatureWidth, signatureHeight).fill(this.colors.bgWhite).stroke(this.colors.borderColor);
    doc.rect(supervisorX, currentY, 4, signatureHeight).fill(this.colors.secondary);
    
    doc.fillColor(this.colors.textPrimary).fontSize(12).font('Poppins-Bold');
    doc.text('SUPERVISOR', supervisorX + 20, currentY + 10);
    
    doc.fontSize(10).font('Poppins').fillColor(this.colors.textPrimary);
    doc.text('Nombre: _____________________', supervisorX + 20, currentY + 30);
    doc.text('Fecha: _____ / _____ / _____', supervisorX + 20, currentY + 50);
    doc.text('Hora: _____ : _____', supervisorX + 20, currentY + 65);
  }

  /**
   * ============================================================================
   * MÉTODOS PARA GENERACIÓN DE PDFs DE HOJAS DE RUTA DE COBRANZAS AUTOMÁTICAS
   * ============================================================================
   */

  /**
   * Genera un PDF específico para hojas de ruta de cobranzas automáticas
   */
  async generateCollectionRouteSheetPdf(
    data: CollectionRouteSheetPdfData,
  ): Promise<{ doc: PDFKit.PDFDocument; filename: string; pdfPath: string }> {
    const filename = this.buildCollectionRouteSheetFilename(data);
    const pdfPath = join(process.cwd(), 'public', 'pdfs', filename);

    // Asegurar que el directorio existe
    await fsExtra.ensureDir(dirname(pdfPath));

    const doc = new PDFDocument({ margin: 50 });
    await this.generateCollectionRouteSheetContent(doc, data);

    return { doc, filename, pdfPath };
  }

  /**
   * Construye el nombre de archivo para hoja de ruta de cobranzas automáticas.
   */
  private buildCollectionRouteSheetFilename(data: CollectionRouteSheetPdfData): string {
    const base = 'cobranza-automatica-hoja-de-ruta';
    const ymd = this.formatDateYMD(data.delivery_date);

    // Movil/vehículo
    const rawVehicle = data.vehicle?.name || data.vehicle?.code || '';
    const vehiclePart = rawVehicle
      ? `m${this.slugifyForFilename(rawVehicle)}`
      : 'mNA';

    // Zonas
    const zones = Array.isArray(data.zone_identifiers) ? data.zone_identifiers : [];
    let zonesPart = 'zall';
    if (zones.length > 0) {
      const uniqueZones = Array.from(new Set(zones)).map((z) => this.slugifyForFilename(z));
      zonesPart = `z${uniqueZones.join('-')}`;
    }

    // Chofer
    const rawDriver = data.driver?.name || '';
    const driverPart = rawDriver
      ? `d${this.slugifyForFilename(rawDriver)}`
      : 'dNA';

    return `${base}_${ymd}_${vehiclePart}_${zonesPart}_${driverPart}.pdf`;
  }

  /**
   * Formatea fecha a YYYY-MM-DD para uso en nombre de archivo unificado
   */
  private formatDateYMD(dateInput: string | Date): string {
    const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${yyyy}-${mm}-${dd}`;
  }

  /**
   * Formatea fecha para mostrar en el PDF como dd/MM/yyyy
   */
  private formatDateForDisplay(dateInput: string | Date): string {
    const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  /**
   * Genera el contenido del PDF para hojas de ruta de cobranzas
   */
  private async generateCollectionRouteSheetContent(
    doc: PDFKit.PDFDocument,
    routeSheet: CollectionRouteSheetPdfData,
  ): Promise<void> {
    // Registrar fuentes Poppins
    const fontsPath = join(process.cwd(), 'public', 'fonts');
    doc.registerFont('Poppins', join(fontsPath, 'Poppins-Regular.ttf'));
    doc.registerFont('Poppins-Bold', join(fontsPath, 'Poppins-Bold.ttf'));

    let currentY = 50;

    // Header
    currentY = this.generateCollectionHeader(doc, routeSheet, currentY);
    currentY += 20;

    // Driver and Vehicle Info
    currentY = this.generateCollectionDriverVehicleInfo(doc, routeSheet, currentY);
    currentY += 20;

    // Route Notes
    if (routeSheet.route_notes) {
      currentY = this.generateCollectionRouteNotes(doc, routeSheet, currentY);
      currentY += 20;
    }

    // Collections Table
    currentY = this.generateCollectionsTable(doc, routeSheet, currentY);
    currentY += 30;

    // Signature Section
    this.generateCollectionSignatureSection(doc, currentY);
  }

  /**
   * Genera el header específico para hojas de ruta de cobranzas
   */
  private generateCollectionHeader(doc: PDFKit.PDFDocument, routeSheet: CollectionRouteSheetPdfData, currentY: number): number {
    // Línea superior decorativa
    doc.rect(50, currentY, 520, 3).fill(this.colors.primary);
    currentY += 15;

    // Título principal
    doc.fontSize(20)
       .font('Poppins-Bold')
       .fillColor(this.colors.primary)
       .text('HOJA DE RUTA - COBRANZAS AUTOMÁTICAS', 50, currentY, { align: 'left' });
    
    currentY += 30;

    // Información básica - solo fecha
    doc.fontSize(14)
       .font('Poppins')
       .fillColor(this.colors.textPrimary);
    
    const displayDate = this.formatDateForDisplay(routeSheet.delivery_date);
    doc.text(`Fecha: ${displayDate}`, 50, currentY);
    
    currentY += 20;
    
    return currentY;
  }

  /**
   * Genera la información del conductor y vehículo para cobranzas
   */
  private generateCollectionDriverVehicleInfo(doc: PDFKit.PDFDocument, routeSheet: CollectionRouteSheetPdfData, currentY: number): number {
    // Información del conductor
    doc.rect(50, currentY, 250, 70).fill(this.colors.bgPrimary).stroke(this.colors.borderColor);
    doc.rect(50, currentY, 4, 70).fill(this.colors.primary);
    
    doc.fontSize(14).font('Poppins-Bold').fillColor(this.colors.textPrimary);
    doc.text('CONDUCTOR', 70, currentY + 10);
    
    doc.fontSize(12).font('Poppins').fillColor(this.colors.textPrimary);
    doc.text(`Nombre: ${routeSheet.driver.name}`, 70, currentY + 30);

    // Información del vehículo
    const vehicleX = 320;
    doc.rect(vehicleX, currentY, 250, 70).fill(this.colors.bgPrimary).stroke(this.colors.borderColor);
    doc.rect(vehicleX, currentY, 4, 70).fill(this.colors.secondary);
    
    doc.fontSize(14).font('Poppins-Bold').fillColor(this.colors.textPrimary);
    doc.text('VEHÍCULO', vehicleX + 20, currentY + 10);
    
    doc.fontSize(12).font('Poppins').fillColor(this.colors.textPrimary);
    doc.text(`Nombre: ${routeSheet.vehicle.name}`, vehicleX + 20, currentY + 45);
    doc.text(`Código: ${routeSheet.vehicle.code}`, vehicleX + 20, currentY + 30);

    return currentY + 80;
  }

  /**
   * Genera las notas de ruta para cobranzas
   */
  private generateCollectionRouteNotes(doc: PDFKit.PDFDocument, routeSheet: CollectionRouteSheetPdfData, currentY: number): number {
    doc.rect(50, currentY, 520, 50).fill(this.colors.warningColor).stroke(this.colors.borderColor);
    
    doc.fontSize(14).font('Poppins-Bold').fillColor(this.colors.textPrimary);
    doc.text('INSTRUCCIONES ESPECIALES', 70, currentY + 10);
    
    doc.fontSize(12).font('Poppins').fillColor(this.colors.textPrimary);
    doc.text(routeSheet.route_notes, 70, currentY + 30, { width: 480 });
    return currentY + 70;
  }

  /**
   * Genera la tabla de cobranzas
   */
  private generateCollectionsTable(
    doc: PDFKit.PDFDocument, 
    routeSheet: CollectionRouteSheetPdfData, 
    currentY: number
  ): number {
    const startX = 50;
    const tableWidth = 520;
    const rowHeight = 25;
    const headerHeight = 35;
    
    // Headers de la tabla
    const headers = ['#', 'Cliente', 'Dirección', 'Teléfono', 'Monto', 'Venc.', 'Estado'];
    const colWidths = [30, 90, 120, 80, 60, 70, 70];
    
    // Header de la tabla
    let headerX = startX;
    doc.rect(startX, currentY, tableWidth, headerHeight)
       .fill(this.colors.primary);
    
    doc.fontSize(12)
       .font('Poppins-Bold')
       .fillColor(this.colors.textWhite);
    
    headers.forEach((header, index) => {
      doc.text(header, headerX + 5, currentY + 12, { 
        width: colWidths[index] - 10,
        align: 'center'
      });
      headerX += colWidths[index];
    });
    
    currentY += headerHeight;
    
    // Filas de datos
    routeSheet.collections.forEach((collection, index) => {
      if (currentY > doc.page.height - 200) {
        doc.addPage();
        currentY = 50;
      }

      currentY = this.generateCollectionRow(doc, collection, index, currentY, startX, colWidths, rowHeight);
    });
    
    return currentY;
  }

  /**
   * Genera una fila de la tabla de cobranzas con altura dinámica
   */
  private generateCollectionRow(
    doc: PDFKit.PDFDocument,
    collection: any,
    index: number,
    currentY: number,
    startX: number,
    colWidths: number[],
    rowHeight: number
  ): number {
    const fillColor = index % 2 === 0 ? this.colors.bgWhite : this.colors.bgPrimary;
    
    // Preparar datos de cada columna
    const cellData: Array<{ text: string; align: 'center' | 'left' | 'right' }> = [
      { text: (index + 1).toString(), align: 'center' },
      { text: collection.customer.name, align: 'left' },
      { text: collection.customer.address || '-', align: 'center' },
      { text: collection.customer.phone || '-', align: 'center' },
      { text: `$${collection.amount.toFixed(2)}`, align: 'center' },
      { text: new Date(collection.payment_due_date).toLocaleDateString('es-ES'), align: 'center' },
      { text: this.translateStatus(collection.delivery_status), align: 'center' }
    ];

    // Calcular altura necesaria para cada celda
    const minRowHeight = 25;
    const padding = 10;
    let maxHeight = minRowHeight;

    doc.fontSize(10).font('Poppins');
    cellData.forEach((cell, colIndex) => {
      const textHeight = doc.heightOfString(cell.text, {
        width: colWidths[colIndex] - padding,
        align: cell.align
      });
      maxHeight = Math.max(maxHeight, textHeight + padding);
    });

    // Si hay comentarios, calcular altura adicional para renderizarlos bajo la fila
    const tableWidth = colWidths.reduce((a, b) => a + b, 0);
    const hasComments = !!(collection.comments && String(collection.comments).trim().length > 0);
    let commentsHeight = 0;
    let commentsText = '';
    if (hasComments) {
      commentsText = `Obs.: ${String(collection.comments).trim()}`;
      doc.fontSize(9).font('Poppins');
      const h = doc.heightOfString(commentsText, {
        width: tableWidth - 20,
        align: 'left',
        lineGap: 2,
      });
      commentsHeight = h + 8; // padding para respiración visual
    }

    // Dibujar fondo de la fila con altura calculada
    doc.rect(startX, currentY, tableWidth, maxHeight).fill(fillColor);
    
    // Renderizar cada celda con texto multilínea
    let cellX = startX;
    doc.fontSize(10).font('Poppins').fillColor(this.colors.textPrimary);
    
    cellData.forEach((cell, colIndex) => {
      doc.text(cell.text, cellX + 5, currentY + 5, {
        width: colWidths[colIndex] - 10,
        align: cell.align,
        lineGap: 2
      });
      cellX += colWidths[colIndex];
    });
    
    // Bordes
    doc.strokeColor(this.colors.borderColor).lineWidth(0.5);
    
    let borderX = startX;
    colWidths.forEach(width => {
      doc.moveTo(borderX, currentY)
         .lineTo(borderX, currentY + maxHeight)
         .stroke();
      borderX += width;
    });
    
    // Comentarios bajo la fila (si existen)
    let endY = currentY + maxHeight;
    if (hasComments) {
      // Fondo ligero para comentarios
      doc.rect(startX, endY, tableWidth, commentsHeight).fill(this.colors.bgSecondary);
      // Texto de comentarios
      doc.fontSize(9).font('Poppins').fillColor(this.colors.textPrimary);
      doc.text(commentsText, startX + 10, endY + 4, {
        width: tableWidth - 20,
        align: 'left',
        lineGap: 2,
      });
      endY += commentsHeight;
    }
    
    // Borde inferior (considerando posible bloque de comentarios)
    doc.moveTo(startX, endY)
       .lineTo(startX + tableWidth, endY)
       .stroke();
    
    return endY;
  }

  /**
   * Traduce el estado de entrega al español
   */
  private translateStatus(status: string): string {
    const statusMap = {
      'pending': 'PENDIENTE',
      'pendiente': 'PENDIENTE',
      'delivered': 'ENTREGADO',
      'entregado': 'ENTREGADO',
      'cancelled': 'CANCELADO',
      'cancelado': 'CANCELADO',
      'in_route': 'EN RUTA',
      'en_ruta': 'EN RUTA',
      'overdue': 'ATRASADO',
      'atrasado': 'ATRASADO',
    };
    
    return statusMap[status.toLowerCase()] || 'PENDIENTE';
  }

  /**
   * Genera la sección de firmas para cobranzas
   */
  private generateCollectionSignatureSection(doc: PDFKit.PDFDocument, currentY: number): void {
    if (currentY > doc.page.height - 200) {
      doc.addPage();
      currentY = 50;
    }

    // Título de confirmación
    doc.rect(50, currentY, 520, 30).fill(this.colors.primary);
    doc.fillColor(this.colors.textWhite).fontSize(16).font('Poppins-Bold');
    doc.text('CONFIRMACIÓN DE ENTREGAS', 50, currentY + 8, {
      align: 'center',
      width: 520,
    });
    currentY += 50;

    const signatureHeight = 80;
    const signatureWidth = 250;

    // Firma del conductor
    doc.rect(50, currentY, signatureWidth, signatureHeight).fill(this.colors.bgWhite).stroke(this.colors.borderColor);
    doc.rect(50, currentY, 4, signatureHeight).fill(this.colors.primary);
    
    doc.fillColor(this.colors.textPrimary).fontSize(12).font('Poppins-Bold');
    doc.text('CONDUCTOR', 70, currentY + 10);
    
    doc.fontSize(10).font('Poppins').fillColor(this.colors.textPrimary);
    doc.text('Nombre: _________________________', 70, currentY + 30);
    doc.text('Fecha: _____ / _____ / _____', 70, currentY + 50);
    doc.text('Hora: _____ : _____', 70, currentY + 65);

    // Firma del supervisor
    const supervisorX = 320;
    doc.rect(supervisorX, currentY, signatureWidth, signatureHeight).fill(this.colors.bgWhite).stroke(this.colors.borderColor);
    doc.rect(supervisorX, currentY, 4, signatureHeight).fill(this.colors.secondary);
    
    doc.fillColor(this.colors.textPrimary).fontSize(12).font('Poppins-Bold');
    doc.text('SUPERVISOR', supervisorX + 20, currentY + 10);
    
    doc.fontSize(10).font('Poppins').fillColor(this.colors.textPrimary);
    doc.text('Nombre: _____________________', supervisorX + 20, currentY + 30);
    doc.text('Fecha: _____ / _____ / _____', supervisorX + 20, currentY + 50);
    doc.text('Hora: _____ : _____', supervisorX + 20, currentY + 65);
  }

  /**
   * Finaliza la generación del PDF y retorna la URL
   */
  async finalizePdf(
    doc: PDFKit.PDFDocument,
    writeStream: fs.WriteStream,
    filename: string,
  ): Promise<{ url: string; filename: string }> {
    return new Promise((resolve, reject) => {
      writeStream.on('finish', () => {
        resolve({ url: `/public/pdfs/${filename}`, filename });
      });
      writeStream.on('error', reject);
      doc.end();
    });
  }
}