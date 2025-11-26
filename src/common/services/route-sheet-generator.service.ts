import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import * as PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as fsExtra from 'fs-extra';
import * as path from 'path';
import { join, dirname } from 'path';
import { TempFileManagerService } from './temp-file-manager.service';
import { PdfGeneratorService, CollectionRouteSheetPdfData as PdfCollectionRouteSheetPdfData } from './pdf-generator.service';
import { GenerateRouteSheetDto, RouteSheetResponseDto } from '../../orders/dto/generate-route-sheet.dto';
import { isValidYMD, parseYMD, formatLocalYMD, formatBAYMD, formatBATimestampISO, formatUTCYMD, formatBAHMS } from '../utils/date.utils';

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
    locality_name?: string;
  };
  amount: string;
  due_dates?: string[];
  days_overdue: number;
  priority: number;
  notes: string;
  status: string;
  payment_status?: 'NONE' | 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'CREDITED';
  is_backlog: boolean;
  backlog_type?: 'PENDING' | 'OVERDUE' | null;
  subscription_plan_name?: string;
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
      customer_id: number;
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
    payment_reference?: string;
    payment_notes?: string;
    payment_method?: string;
    subscription_notes?: string;
    payment_due_date: string;
    cycle_period: string;
    subscription_plan: string;
    payment_status: string;
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
    primary: '#000000ff',        // Rojo para encabezados
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

  constructor(
    private readonly tempFileManager: TempFileManagerService,
    private readonly pdfGeneratorService: PdfGeneratorService,
  ) {
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
      const zones = this.groupCollectionsByZone(collections, targetDate);
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
          generated_at: formatBATimestampISO(new Date()),
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
      const zones = this.groupCollectionsByZone(collections, targetDate);
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
      const timeRaw = formatBAHMS(new Date());
      const timePart = `${timeRaw.slice(0,2)}-${timeRaw.slice(2,4)}-${timeRaw.slice(4,6)}`;
      const baseName = `cobranza-automatica-hoja-de-ruta_${datePart}-${timePart}_${vehiclePart}_${zonesPart}_${driverPart}.pdf`;
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
          generated_at: formatBATimestampISO(new Date()),
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

    const whereClause: Prisma.collection_ordersWhereInput = {
      order_type: 'ONE_OFF',
      is_active: true,
      AND: [
        {
          OR: [
            { order_date: { gte: dayStart, lt: dayEnd } },
            { scheduled_delivery_date: { gte: dayStart, lt: dayEnd } },
            {
              AND: [
                { scheduled_delivery_date: { lt: dayStart } },
                { payment_status: { in: ['PENDING', 'OVERDUE'] } },
              ],
            },
            {
              AND: [
                { order_date: { lt: dayStart } },
                { payment_status: { in: ['PENDING', 'OVERDUE'] } },
              ],
            },
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
            locality: true,
            customer_subscription: {
              include: {
                subscription_cycle: {
                  where: { pending_balance: { gt: 0 } },
                  orderBy: { payment_due_date: 'desc' },
                },
              },
            },
          },
        },
        customer_subscription: {
          include: {
            subscription_plan: {
              select: { name: true },
            },
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
  private groupCollectionsByZone(collections: any[], targetDate: Date): RouteSheetZone[] {
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

      const collectionData = this.createCollectionData(collection, zoneName, targetDate);
      const zoneData = zoneGroups.get(zoneKey)!;
      
      zoneData.collections.push(collectionData);
      this.updateZoneSummary(zoneData, collection, collectionData.days_overdue > 0);
    });

    return Array.from(zoneGroups.values());
  }

  /**
   * Crea los datos de una cobranza
   */
  private createCollectionData(collection: any, zoneName: string, targetDate: Date): RouteSheetCollection {
    const dayStart = new Date(targetDate);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    const dueDate = collection.customer_subscription?.subscription_cycle?.[0]?.payment_due_date;
    const isOverdue = dueDate ? dueDate < dayStart : false;
    const daysOverdue = isOverdue && dueDate
      ? Math.floor((dayStart.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    const orderDate: Date | null = collection.order_date ? new Date(collection.order_date) : null;
    const scheduledDate: Date | null = collection.scheduled_delivery_date ? new Date(collection.scheduled_delivery_date) : null;
    const inRange = (d: Date | null) => d ? d >= dayStart && d < dayEnd : false;
    const isForTargetDay = inRange(orderDate) || inRange(scheduledDate);
    const isBacklog = !isForTargetDay && ['PENDING', 'OVERDUE'].includes((collection.payment_status || '').toUpperCase());
    const backlogType: 'PENDING' | 'OVERDUE' | null = isBacklog ? ((collection.payment_status || '').toUpperCase() as 'PENDING' | 'OVERDUE') : null;

    const planName = collection.customer_subscription?.subscription_plan?.name;
    const subscriptionNotes = collection.customer_subscription?.notes ?? undefined;
    const amountNumber = Number(collection.total_amount);
    const formattedNotes = formatCollectionNotesForRouteSheet(
      subscriptionNotes,
      planName,
      dueDate || undefined,
      isNaN(amountNumber) ? String(collection.total_amount) : amountNumber,
    );

    return {
      order_id: (collection as any).collection_order_id ?? collection.order_id,
      customer: {
        customer_id: collection.customer_id,
        name: collection.customer.name,
        address: collection.customer.address || 'Sin dirección',
        phone: collection.customer.phone,
        zone_name: zoneName,
        locality_name: collection.customer?.locality?.name,
      },
      amount: collection.total_amount.toString(),
      due_dates: (collection.customer?.customer_subscription || [])
        .flatMap((cs: any) => (cs.subscription_cycle || []).map((c: any) => c?.payment_due_date))
        .filter((d: Date | undefined) => !!d)
        .map((d: Date) => formatUTCYMD(d)),
      days_overdue: daysOverdue,
      priority: isOverdue ? (daysOverdue > 30 ? 1 : 2) : 3,
      notes: formattedNotes,
      status: collection.status,
      payment_status: collection.payment_status,
      is_backlog: isBacklog,
      backlog_type: backlogType,
      subscription_plan_name: planName,
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
   * Genera el PDF de la hoja de ruta usando el PdfGeneratorService
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

    // Convertir los datos al formato que espera PdfGeneratorService
    const collections = zones.flatMap(zone => 
      zone.collections.map(collection => ({
        cycle_payment_id: collection.order_id,
        customer: {
          customer_id: collection.customer.customer_id || collection.order_id,
          name: collection.customer.name,
          address: collection.customer.address,
          phone: collection.customer.phone,
          locality: collection.customer.locality_name ? { name: collection.customer.locality_name } : undefined,
        },
        amount: parseFloat(collection.amount),
        payment_due_date: (collection.due_dates && collection.due_dates[0]) ? collection.due_dates[0] : formatBAYMD(targetDate),
        all_due_dates: collection.due_dates || [],
        delivery_status: collection.status || 'pending',
        payment_status: collection.payment_status || 'PENDING',
        delivery_time: '',
        cycle_period: 'monthly',
        subscription_plan: collection.subscription_plan_name || 'Standard',
        payment_reference: '',
        payment_notes: collection.notes,
        payment_method: '',
        subscription_notes: '',
        comments: collection.notes,
        subscription_id: 1,
        credits: [],
      }))
    );

    const collectionData: PdfCollectionRouteSheetPdfData = {
      route_sheet_id: Math.floor(Math.random() * 1000),
      delivery_date: formatBAYMD(targetDate),
      driver: {
        name: driver?.name || 'No asignado',
        email: '',
      },
      vehicle: {
        code: vehicle?.license_plate || 'N/A',
        name: vehicle?.model || 'No asignado',
      },
      route_notes: notes,
      collections,
    };

    // Usar PdfGeneratorService para generar el PDF
    const result = await this.pdfGeneratorService.generateCollectionRouteSheetPdf(
      collectionData
    );

    // Crear el stream y finalizar el documento
    const writeStream = fs.createWriteStream(filePath);
    result.doc.pipe(writeStream);
    result.doc.end();

    // Esperar a que termine la escritura
    await new Promise<void>((resolve, reject) => {
      writeStream.on('finish', () => resolve());
      writeStream.on('error', reject);
    });

    return;
  }
  /**
   * Genera un PDF de previsualización usando datos de prueba directos
   * Solo para desarrollo y testing
   */
  async generatePreviewPdf(testData: CollectionRouteSheetPdfData): Promise<string> {
    try {
      const result = await this.pdfGeneratorService.generateCollectionRouteSheetPdf(testData);
      const tempPath = `./temp/preview-collection-${Date.now()}.pdf`;
      const writeStream = fs.createWriteStream(tempPath);
      result.doc.pipe(writeStream);
      result.doc.end();
      await new Promise<void>((resolve, reject) => {
        writeStream.on('finish', () => resolve());
        writeStream.on('error', reject);
      });
      return tempPath;
    } catch (error) {
      this.logger.error('Error generando PDF de previsualización:', error);
      throw new Error(`Error generando PDF de previsualización: ${error.message}`);
    }
  }

  /**
   * Genera un PDF de previsualización para hojas de ruta normales (no cobranzas)
   * Solo para desarrollo y testing
   */
  async generatePreviewRouteSheetPdf(testData: any): Promise<string> {
    try {
      const result = await this.pdfGeneratorService.generateRouteSheetPdf(testData, {
        includeSignatureField: true,
        includeProductDetails: true,
      });
      const writeStream = fs.createWriteStream(result.pdfPath);
      result.doc.pipe(writeStream);
      result.doc.end();
      await new Promise<void>((resolve, reject) => {
        writeStream.on('finish', () => resolve());
        writeStream.on('error', reject);
      });
      return result.pdfPath;
    } catch (error) {
      this.logger.error('Error generando PDF de previsualización de hoja de ruta:', error);
      throw new Error(`Error generando PDF de previsualización de hoja de ruta: ${error.message}`);
    }
  }
}

export function formatCollectionNotesForRouteSheet(
  subscriptionNotes: string | undefined,
  planName: string | undefined,
  dueDate: Date | undefined,
  amount: number | string,
): string {
  const dateStr = dueDate ? formatBAYMD(dueDate) : 'N/A';
  const amountStr = typeof amount === 'number' ? String(amount) : amount;
  const base = `${planName ? planName : ''}  - Vencimiento: ${dateStr} - Monto a cobrar: $${amountStr}`;
  if (subscriptionNotes && subscriptionNotes.trim().length > 0) {
    return `${subscriptionNotes.trim()}  |  ${base}`;
  }
  return `Suscripción: ${base}`;
}
