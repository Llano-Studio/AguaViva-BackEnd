import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import * as PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';
import { TempFileManagerService } from './temp-file-manager.service';
import { GenerateRouteSheetDto, RouteSheetResponseDto } from '../../orders/dto/generate-route-sheet.dto';

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

@Injectable()
export class RouteSheetGeneratorService extends PrismaClient {
  private readonly logger = new Logger(RouteSheetGeneratorService.name);

  constructor(private readonly tempFileManager: TempFileManagerService) {
    super();
  }

  /**
   * Genera una hoja de ruta para cobranzas automáticas
   */
  async generateRouteSheet(filters: GenerateRouteSheetDto): Promise<RouteSheetResponseDto> {
    try {
      const targetDate = filters.date ? new Date(filters.date) : new Date();
      targetDate.setHours(0, 0, 0, 0);

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

      const fileInfo = this.tempFileManager.createTempFileInfo(fileName, 60);

      const summary = this.calculateSummary(zones);

      return {
        success: true,
        message: 'Hoja de ruta generada exitosamente',
        downloadUrl: fileInfo.downloadUrl,
        routeSheet: {
          date: targetDate.toISOString().split('T')[0],
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
      const targetDate = filters.date ? new Date(filters.date) : new Date();
      targetDate.setHours(0, 0, 0, 0);

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

      // Construir nombre de archivo estable con metadatos básicos
      const datePart = targetDate.toISOString().split('T')[0];
      const vehiclePart = filters.vehicleId ? `v${filters.vehicleId}` : 'vNA';
      const driverPart = filters.driverId ? `d${filters.driverId}` : 'dNA';
      const zonesPart = filters.zoneIds && filters.zoneIds.length > 0 ? `z${filters.zoneIds.join('-')}` : 'zall';
      const baseName = `collection-route-sheet_${datePart}_${vehiclePart}_${zonesPart}_${driverPart}.pdf`;
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
    const whereClause: any = {
      order_type: 'ONE_OFF',
      notes: { contains: 'COBRANZA AUTOMÁTICA' },
      order_date: {
        gte: targetDate,
        lt: new Date(targetDate.getTime() + 24 * 60 * 60 * 1000),
      },
      es_automatica: true,
    };

    if (filters.zoneIds && filters.zoneIds.length > 0) {
      whereClause.customer = {
        zone_id: { in: filters.zoneIds },
      };
    }

    if (filters.overdueOnly === 'true') {
      whereClause.payment_status = { in: ['PENDING', 'OVERDUE'] };
    }

    if (filters.minAmount) {
      whereClause.total_amount = { gte: new Prisma.Decimal(filters.minAmount) };
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
   * Genera el PDF de la hoja de ruta
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

    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    this.generatePdfHeader(doc, targetDate);
    this.generateDriverVehicleInfo(doc, driver, vehicle);
    this.generateSummary(doc, zones);
    this.generateZoneDetails(doc, zones);
    
    if (notes) {
      this.generateNotes(doc, notes);
    }

    doc.end();

    await new Promise<void>((resolve) => {
      stream.on('finish', () => resolve());
    });
  }

  /**
   * Genera el header del PDF
   */
  private generatePdfHeader(doc: PDFKit.PDFDocument, targetDate: Date): void {
    doc.fontSize(18).text('HOJA DE RUTA - COBRANZAS AUTOMÁTICAS', { align: 'center' });
    doc.moveDown();

    doc.fontSize(12);
    doc.text(`Fecha: ${targetDate.toLocaleDateString('es-ES')}`);
    doc.text(`Generado: ${new Date().toLocaleString('es-ES')}`);
    doc.moveDown();
  }

  /**
   * Genera la información del conductor y vehículo
   */
  private generateDriverVehicleInfo(
    doc: PDFKit.PDFDocument, 
    driver?: RouteSheetDriver, 
    vehicle?: RouteSheetVehicle
  ): void {
    if (driver) {
      doc.text(`CONDUCTOR: ${driver.name}`);
      doc.text(`Teléfono: ${driver.phone || 'N/A'}`);
      doc.moveDown();
    }

    if (vehicle) {
      doc.text(`VEHÍCULO: ${vehicle.license_plate}`);
      doc.text(`Modelo: ${vehicle.model || 'N/A'}`);
      doc.moveDown();
    }
  }

  /**
   * Genera el resumen general
   */
  private generateSummary(doc: PDFKit.PDFDocument, zones: RouteSheetZone[]): void {
    const totalCollections = zones.reduce((sum, zone) => sum + zone.summary.total_collections, 0);
    const totalAmount = zones.reduce((sum, zone) => sum + parseFloat(zone.summary.total_amount), 0);

    doc.fontSize(14).text('RESUMEN GENERAL:', { underline: true });
    doc.fontSize(10);
    doc.text(`Total zonas: ${zones.length}`);
    doc.text(`Total cobranzas: ${totalCollections}`);
    doc.text(`Monto total: $${totalAmount.toFixed(2)}`);
    doc.moveDown();
  }

  /**
   * Genera los detalles por zona
   */
  private generateZoneDetails(doc: PDFKit.PDFDocument, zones: RouteSheetZone[]): void {
    zones.forEach((zone, index) => {
      if (index > 0) {
        doc.addPage();
      }

      doc.fontSize(12).text(`${index + 1}. ZONA: ${zone.name}`, { underline: true });
      doc.fontSize(10);
      doc.text(`Cobranzas: ${zone.summary.total_collections}`);
      doc.text(`Monto: $${zone.summary.total_amount}`);
      doc.text(`Vencidas: ${zone.summary.overdue_collections}`);
      doc.moveDown();

      zone.collections.forEach((collection, collIndex) => {
        const priority = this.getPriorityText(collection.priority);
        
        doc.text(`${collIndex + 1}. ${collection.order_id} - ${collection.customer.name} ${priority}`);
        doc.text(`   Dirección: ${collection.customer.address}`);
        doc.text(`   Teléfono: ${collection.customer.phone || 'N/A'}`);
        doc.text(`   Monto: $${collection.amount}`);
        
        if (collection.days_overdue > 0) {
          doc.fillColor('red').text(`   ⚠️ VENCIDA: ${collection.days_overdue} días`).fillColor('black');
        }
        
        doc.moveDown(0.5);
      });
    });
  }

  /**
   * Obtiene el texto de prioridad
   */
  private getPriorityText(priority: number): string {
    switch (priority) {
      case 1: return '[ALTA]';
      case 2: return '[MEDIA]';
      default: return '[BAJA]';
    }
  }

  /**
   * Genera las notas adicionales
   */
  private generateNotes(doc: PDFKit.PDFDocument, notes: string): void {
    doc.addPage();
    doc.fontSize(12).text('NOTAS ADICIONALES:', { underline: true });
    doc.fontSize(10).text(notes);
  }
}