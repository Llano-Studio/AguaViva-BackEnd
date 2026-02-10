import { Injectable } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';
import * as fs from 'fs-extra';
import { join, dirname } from 'path';
import { TempFileManagerService } from './temp-file-manager.service';
import { formatBAYMD, formatBAHMS } from '../utils/date.utils';
import {
  GeneratePdfCollectionsDto,
  PdfGenerationResponseDto,
} from '../../orders/dto/generate-pdf-collections.dto';
import { AutomatedCollectionListResponseDto } from '../../orders/dto/automated-collection-response.dto';

export interface PdfGenerationOptions {
  includeMap?: boolean;
  includeSignatureField?: boolean;
  includeProductDetails?: boolean;
  customColors?: {
    primary?: string;
    secondary?: string;
    accent?: string;
    lightGray?: string;
  };
}

export interface RouteSheetPdfData {
  route_sheet_id: number;
  delivery_date: string;
  driver: {
    id: number;
    name: string;
    email: string;
  };
  vehicle: {
    vehicle_id: number;
    code: string;
    name: string;
    zones: Array<{
      zone_id: number;
      code: string;
      name: string;
      locality?: {
        locality_id: number;
        code: string;
        name: string;
        province: {
          province_id: number;
          code: string;
          name: string;
          country: {
            country_id: number;
            code: string;
            name: string;
          };
        };
      };
    }>;
  };
  zone_identifiers: string[];
  route_notes: string;
  details: Array<{
    route_sheet_detail_id: number;
    route_sheet_id: number;
    order: {
      order_id: number;
      order_date: string;
      total_amount: string;
      debt_amount?: string;
      status: string;
      subscription_id: number;
      subscription_due_date: string;
      all_due_dates: string[];
      collection_days?: number[];
      customer: {
        person_id: number;
        name: string;
        alias?: string;
        address: string;
        phone: string;
        locality: {
          locality_id: number;
          code: string;
          name: string;
        };
        special_instructions: string;
      };
      items: Array<{
        order_item_id: number;
        quantity: number;
        delivered_quantity: number;
        returned_quantity: number;
        product: {
          product_id: number;
          description: string;
        };
      }>;
      notes: string;
    };
    delivery_status: string;
    delivery_time: string;
    is_current_delivery: boolean;
    credits: Array<{
      product_description: string;
      planned_quantity: number;
      delivered_quantity: number;
      remaining_balance: number;
    }>;
  }>;
  zones_covered: Array<{
    zone_id: number;
    code: string;
    name: string;
    locality?: {
      locality_id: number;
      code: string;
      name: string;
      province: {
        province_id: number;
        code: string;
        name: string;
        country: {
          country_id: number;
          code: string;
          name: string;
        };
      };
    };
  }>;
}

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
        locality_id?: number;
        code?: string;
        name?: string;
      };
    };
    amount: number;
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
export class PdfGeneratorService {
  // Configuración de colores para impresión en blanco y negro
  private readonly colors = {
    primary: '#000000', // Negro sólido para encabezados
    secondary: '#333333', // Gris oscuro
    bgPrimary: '#F5F5F5', // Gris muy claro para fondos alternados
    bgSecondary: '#E0E0E0', // Gris claro
    bgWhite: '#FFFFFF', // Blanco
    textPrimary: '#000000', // Negro para texto principal
    textWhite: '#FFFFFF', // Blanco para texto sobre fondos oscuros
    textAccent: '#000000', // Negro para acentos
    borderColor: '#CCCCCC', // Gris medio para bordes
    successColor: '#DDDDDD', // Gris claro (reemplaza verde)
    errorColor: '#999999', // Gris medio (reemplaza rojo)
    warningColor: '#BBBBBB', // Gris claro (reemplaza amarillo)
  };

  constructor(private readonly tempFileManager: TempFileManagerService) {}
  private readonly baTimeZone = 'America/Argentina/Buenos_Aires';
  private readonly baLocale = 'es-AR';
  // Nombres de fuente usados en el documento (se ajustan según disponibilidad)
  private fontRegularName = 'Helvetica';
  private fontBoldName = 'Helvetica-Bold';

  /**
   * Genera un PDF de reporte de cobranzas automáticas
   */
  async generateCollectionReportPdf(
    filters: GeneratePdfCollectionsDto,
    collectionsData: AutomatedCollectionListResponseDto,
  ): Promise<PdfGenerationResponseDto> {
    try {
      const fileName =
        this.tempFileManager.generateUniqueFileName('collections-report');
      const filePath = this.tempFileManager.getTempFilePath(fileName);

      const doc = new PDFDocument({ margin: 25 });
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      this.generateCollectionReportContent(doc, filters, collectionsData);
      doc.end();

      await new Promise<void>((resolve) => {
        stream.on('finish', () => resolve());
      });

      const fileInfo = this.tempFileManager.createTempFileInfo(fileName, 60);

      return {
        success: true,
        message: 'PDF generado exitosamente',
        downloadUrl: fileInfo.downloadUrl,
        fileName: fileInfo.fileName,
        fileSize: fileInfo.fileSize,
        expirationMinutes: fileInfo.expirationMinutes,
        reportStats: {
          total_records: collectionsData.data.length,
          total_amount: collectionsData.summary.total_amount,
          total_pending: collectionsData.summary.total_pending,
          overdue_count: collectionsData.summary.overdue_count,
          overdue_amount: collectionsData.summary.overdue_amount,
        },
      };
    } catch (error) {
      throw new Error(`Error generando PDF de reporte: ${error.message}`);
    }
  }

  /**
   * Genera el contenido del reporte de cobranzas
   */
  private generateCollectionReportContent(
    doc: PDFKit.PDFDocument,
    filters: GeneratePdfCollectionsDto,
    collectionsData: AutomatedCollectionListResponseDto,
  ): void {
    // Título del reporte
    doc
      .fontSize(20)
      .text('Reporte de Cobranzas Automáticas', { align: 'center' });
    doc.moveDown();

    // Información del reporte
    doc.fontSize(12);
    doc.text(`Fecha de generación: ${this.formatDateForDisplay(new Date())}`);
    doc.text(`Formato: ${filters.reportFormat || 'detailed'}`);
    if (filters.reportTitle) {
      doc.text(`Título: ${filters.reportTitle}`);
      doc.moveDown();
    }

    // Resumen
    doc.fontSize(14).text('Resumen del Reporte', { underline: true });
    doc.fontSize(10);
    doc.text(`Total de registros: ${collectionsData.data.length}`);
    doc.text(
      `Monto total: $${parseFloat(collectionsData.summary.total_amount).toFixed(2)}`,
    );
    doc.text(`Total pendientes: ${collectionsData.summary.total_pending}`);
    doc.text(`Total vencidas: ${collectionsData.summary.overdue_count}`);
    doc.text(
      `Monto vencido: $${parseFloat(collectionsData.summary.overdue_amount).toFixed(2)}`,
    );
    doc.moveDown();

    // Detalles de las cobranzas
    if (filters.reportFormat !== 'summary') {
      doc.fontSize(14).text('Detalle de Cobranzas', { underline: true });
      doc.fontSize(8);

      collectionsData.data.forEach((collection, index) => {
        if (index > 0 && index % 20 === 0) {
          doc.addPage();
        }

        doc.text(`${index + 1}. ${collection.customer.name}`);
        doc.text(
          `   ID: ${collection.order_id} | Monto: $${collection.total_amount}`,
        );
        doc.text(
          `   Estado: ${collection.status} | Pago: ${collection.payment_status}`,
        );
        doc.text(
          `   Fecha venc.: ${collection.due_date ? this.safeFormatDateYMDDisplay(collection.due_date) : 'N/A'}`,
        );
        doc.moveDown(0.5);
      });
    }
  }

  /**
   * Genera un PDF de hoja de ruta con diseño moderno
   */
  async generateRouteSheetPdf(
    data: RouteSheetPdfData,
    options: PdfGenerationOptions = {},
  ): Promise<{ doc: PDFKit.PDFDocument; filename: string; pdfPath: string }> {
    const datePart = data.delivery_date || formatBAYMD(new Date());
    const timeRaw = formatBAHMS(new Date());
    const timePart = `${timeRaw.slice(0, 2)}-${timeRaw.slice(2, 4)}-${timeRaw.slice(4, 6)}`;
    const vehicleSeg = data.vehicle?.name
      ? this.slugify(data.vehicle.name)
      : data.vehicle?.code
        ? this.slugify(data.vehicle.code)
        : 'NA';
    const zoneSegRaw =
      data.zone_identifiers && data.zone_identifiers.length > 0
        ? data.zone_identifiers.join('-')
        : data.zones_covered && data.zones_covered.length > 0
          ? data.zones_covered.map((z) => z.code).join('-')
          : 'all';
    const zoneSeg =
      zoneSegRaw.length > 80
        ? `multi-${data.zone_identifiers?.length || data.zones_covered?.length || 0}`
        : this.slugify(zoneSegRaw);
    const driverSeg = data.driver?.name ? this.slugify(data.driver.name) : 'NA';
    const filename = `hoja-de-ruta_${datePart}-${timePart}_${vehicleSeg}_${zoneSeg}_${driverSeg}.pdf`;
    const pdfDir = join(process.cwd(), 'public', 'pdfs');
    await fs.ensureDir(pdfDir);
    const pdfPath = join(pdfDir, filename);

    const doc = new PDFDocument({
      margin: 25,
      size: 'A4',
      autoFirstPage: true,
    });

    const writeStream = fs.createWriteStream(pdfPath);
    doc.pipe(writeStream);

    await this.generateRouteSheetContent(doc, data, options);

    return { doc, filename, pdfPath };
  }

  /**
   * Genera el contenido del PDF de hoja de ruta
   */
  private async generateRouteSheetContent(
    doc: PDFKit.PDFDocument,
    routeSheet: RouteSheetPdfData,
    options: PdfGenerationOptions,
  ): Promise<void> {
    const { includeSignatureField = true, includeProductDetails = true } =
      options;

    // Registrar fuentes Poppins si están disponibles, sino usar Helvetica
    const fontsPath = join(process.cwd(), 'public', 'fonts');
    const regularPath = join(fontsPath, 'Poppins-Regular.ttf');
    const boldPath = join(fontsPath, 'Poppins-Bold.ttf');
    try {
      if (fs.existsSync(regularPath)) {
        doc.registerFont('Poppins', regularPath);
        this.fontRegularName = 'Poppins';
      } else {
        this.fontRegularName = 'Helvetica';
      }

      if (fs.existsSync(boldPath)) {
        doc.registerFont('Poppins-Bold', boldPath);
        this.fontBoldName = 'Poppins-Bold';
      } else {
        this.fontBoldName = 'Helvetica-Bold';
      }
    } catch (e) {
      this.fontRegularName = 'Helvetica';
      this.fontBoldName = 'Helvetica-Bold';
    }

    let currentY = 25;

    // Header
    currentY = this.generateHeader(doc, routeSheet, currentY);

    // Información del conductor y vehículo
    currentY = this.generateDriverVehicleInfo(doc, routeSheet, currentY);

    // Notas de ruta
    currentY = this.generateRouteNotes(doc, routeSheet, currentY);

    // Tabla de pedidos (con paginación y footer integrado)
    currentY = this.generateOrdersTableWithFooters(
      doc,
      routeSheet,
      currentY,
      includeProductDetails,
    );

    // Sección de confirmación
    if (includeSignatureField) {
      this.generateSignatureSection(doc, currentY);
    }
  }

  /**
   * Convierte un string a slug seguro para usar en nombres de archivo
   */
  private slugify(input: string): string {
    return input
      .toString()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase();
  }

  /**
   * Asegura el registro de fuentes y configura nombres a usar (fallback a Helvetica)
   */
  private ensureFonts(doc: PDFKit.PDFDocument): void {
    const fontsPath = join(process.cwd(), 'public', 'fonts');
    const regularPath = join(fontsPath, 'Poppins-Regular.ttf');
    const boldPath = join(fontsPath, 'Poppins-Bold.ttf');
    try {
      if (fs.existsSync(regularPath)) {
        try { doc.registerFont('Poppins', regularPath); } catch (e) { /* ignore */ }
        this.fontRegularName = 'Poppins';
      } else {
        this.fontRegularName = 'Helvetica';
      }

      if (fs.existsSync(boldPath)) {
        try { doc.registerFont('Poppins-Bold', boldPath); } catch (e) { /* ignore */ }
        this.fontBoldName = 'Poppins-Bold';
      } else {
        this.fontBoldName = 'Helvetica-Bold';
      }
    } catch (e) {
      this.fontRegularName = 'Helvetica';
      this.fontBoldName = 'Helvetica-Bold';
    }
  }

  /**
   * Genera el header del PDF
   */
  private generateHeader(
    doc: PDFKit.PDFDocument,
    routeSheet: RouteSheetPdfData,
    currentY: number,
  ): number {
    // Línea superior decorativa
    doc.rect(25, currentY, 545, 3).fill(this.colors.primary);
    currentY += 15;

    // Título principal
    doc.fontSize(12).font(this.fontBoldName).fillColor(this.colors.textPrimary);
    doc.text(
      `HOJA DE RUTA PEDIDOS #${routeSheet.route_sheet_id}`,
      25,
      currentY,
    );

    // Fecha de entrega (más a la derecha, misma línea)
    doc.fontSize(12).font(this.fontRegularName).fillColor(this.colors.textPrimary);
    const displayDate = this.formatDateForDisplay(routeSheet.delivery_date);
    doc.text(`Fecha: ${displayDate}`, 440, currentY + 4);

    // Zonas cubiertas
    if (routeSheet.zones_covered && routeSheet.zones_covered.length > 0) {
      const zonesNames = routeSheet.zones_covered.map((z) => z.name).join(', ');
      doc.fontSize(12).font(this.fontRegularName).fillColor(this.colors.textPrimary);
      doc.text(`Zonas: ${zonesNames}`, 25, currentY + 15);
      return currentY + 35;
    }

    return currentY + 20;
  }

  /**
   * Genera la información del conductor y vehículo
   */
  private generateDriverVehicleInfo(
    doc: PDFKit.PDFDocument,
    routeSheet: RouteSheetPdfData | CollectionRouteSheetPdfData,
    currentY: number,
  ): number {
    // Calcular ancho disponible respetando márgenes de 25px
    const availableWidth = 545; // 595 - 25 - 25
    const boxWidth = Math.floor((availableWidth - 25) / 2); // Espacio entre las dos cajas
    const startX = 25;
    const vehicleX = startX + boxWidth + 25; // 25px de separación entre las cajas

    // Información del conductor
    doc
      .rect(startX, currentY, boxWidth, 49)
      .fill(this.colors.bgPrimary)
      .stroke(this.colors.borderColor);
    doc.rect(startX, currentY, 4, 49).fill(this.colors.primary);

    doc.fontSize(10).font(this.fontBoldName).fillColor(this.colors.textPrimary);
    doc.text('CONDUCTOR', startX + 20, currentY + 3);

    doc.fontSize(10).font(this.fontRegularName).fillColor(this.colors.textPrimary);
    doc.text(`Nombre: ${routeSheet.driver.name}`, startX + 20, currentY + 17);

    // Información del vehículo
    doc
      .rect(vehicleX, currentY, boxWidth, 49)
      .fill(this.colors.bgPrimary)
      .stroke(this.colors.borderColor);
    doc.rect(vehicleX, currentY, 4, 49).fill(this.colors.secondary);

    doc.fontSize(10).font(this.fontBoldName).fillColor(this.colors.textPrimary);
    doc.text('VEHÍCULO', vehicleX + 20, currentY + 3);

    doc.fontSize(10).font(this.fontRegularName).fillColor(this.colors.textPrimary);
    doc.text(
      `Nombre: ${routeSheet.vehicle.name}`,
      vehicleX + 20,
      currentY + 17,
    );
    doc.text(
      `Código: ${routeSheet.vehicle.code}`,
      vehicleX + 20,
      currentY + 32,
    );

    return currentY + 55;
  }

  /**
   * Genera las notas de ruta
   */
  private generateRouteNotes(
    doc: PDFKit.PDFDocument,
    routeSheet: RouteSheetPdfData | CollectionRouteSheetPdfData,
    currentY: number,
  ): number {
    if (routeSheet.route_notes) {
      const startX = 25;
      const notesWidth = 545; // 595 - 25 - 25
      const textWidth = notesWidth - 40; // 20px padding en cada lado

      doc
        .rect(startX, currentY, notesWidth, 30)
        .fill(this.colors.warningColor)
        .stroke(this.colors.borderColor);

      doc.fontSize(10).font(this.fontBoldName).fillColor(this.colors.textPrimary);
      doc.text('INSTRUCCIONES ESPECIALES', startX + 20, currentY + 3);

      doc.fontSize(10).font(this.fontRegularName).fillColor(this.colors.textPrimary);
      doc.text(routeSheet.route_notes, startX + 20, currentY + 15, {
        width: textWidth,
      });
      return currentY + 33;
    }
    return currentY;
  }

  /**
   * Genera la tabla de pedidos con control de paginación y footers integrados
   */
  private generateOrdersTableWithFooters(
    doc: PDFKit.PDFDocument,
    routeSheet: RouteSheetPdfData,
    currentY: number,
    includeProductDetails: boolean,
  ): number {
    const startX = 25;
    const tableWidth = 545; // 595 - 25 - 25 = 545px disponibles
    const rowHeight = 17;

    // Headers de la tabla
    const headers = [
      'N°',
      'V',
      'Cliente',
      'Dirección',
      'Teléfono',
      'Horario',
      'Total',
    ];
    const baseColWidths = [30, 15, 105, 170, 70, 70, 80];
    let pageCount = 1;

    const headerColWidths = [...baseColWidths];
    const todayDisplay = this.formatDateForDisplay(new Date());
    const deliveryDisplay = this.formatDateForDisplay(routeSheet.delivery_date);
    const deliveryDay =
      todayDisplay === deliveryDisplay
        ? Number(deliveryDisplay.slice(0, 2))
        : null;

    // Función helper para agregar footer con información completa de la hoja de ruta
    const addFooter = (currentPageNum: number, isLastPage: boolean = false) => {
      const footerY = doc.page.height - 60; // Más espacio para la información adicional

      // Para la mayoría de casos, estimamos máximo 3 páginas
      // Si necesitamos más precisión, se puede implementar regeneración
      const totalPages = isLastPage
        ? currentPageNum
        : Math.max(currentPageNum, 2);

      // Línea decorativa superior del footer
      doc.rect(25, footerY - 10, 545, 1).fill(this.colors.borderColor);

      // Número de hoja de ruta y fecha en la misma línea
      doc.fontSize(9).font(this.fontRegularName).fillColor(this.colors.textAccent);
      doc.text(`#${routeSheet.route_sheet_id}`, 25, footerY);

      doc.fontSize(9).font(this.fontRegularName).fillColor(this.colors.textPrimary);
      const displayDate = this.formatDateForDisplay(routeSheet.delivery_date);
      doc.text(`Fecha: ${displayDate}`, 200, footerY + 2);

      // Vehículo en el centro
      doc.fontSize(9).font(this.fontRegularName).fillColor(this.colors.textPrimary);
      doc.text(
        `Vehículo: ${routeSheet.vehicle?.name || 'N/D'}`,
        350,
        footerY + 2,
      );

      // Paginación en el lado derecho de la misma línea
      doc.fontSize(9).font(this.fontRegularName).fillColor(this.colors.secondary);
      doc.text(`Página ${currentPageNum}/${totalPages}`, 470, footerY + 3, {
        width: 100,
        align: 'right',
      });

      // Zonas en la línea de abajo (si existen)
      if (routeSheet.zones_covered && routeSheet.zones_covered.length > 0) {
        const zonesNames = routeSheet.zones_covered
          .map((z) => z.name)
          .join(', ');
        doc.fontSize(10).font(this.fontRegularName).fillColor(this.colors.textPrimary);
        doc.text(`Zonas: ${zonesNames}`, 25, footerY + 15);
      }

      return footerY;
    };

    // Header inicial de la tabla
    doc.rect(startX, currentY, tableWidth, rowHeight).fill(this.colors.primary);
    doc.fillColor(this.colors.textWhite).fontSize(10).font(this.fontBoldName);

    let colX = startX + 10;
    headers.forEach((header, index) => {
      doc.text(header, colX, currentY + 3, {
        width: headerColWidths[index] - 20,
        align: index === 0 ? 'center' : 'left',
      });
      colX += headerColWidths[index];
    });

    currentY += rowHeight;

    // Calcular altura del footer para usar en paginación
    const footerHeight = 80; // Altura reservada para el footer
    const pageBottomLimit = doc.page.height - footerHeight;

    // Generar órdenes con altura dinámica real

    for (let i = 0; i < routeSheet.details.length; i++) {
      const detail = routeSheet.details[i];

      // Estimar altura aproximada que ocupará esta orden
      const estimatedRowHeight = 60; // Altura mínima estimada para fila + detalles

      // Verificar si necesitamos nueva página ANTES de procesar
      if (currentY + estimatedRowHeight > pageBottomLimit) {
        // Agregar footer a la página actual (solo si no es la primera página)
        if (pageCount > 1) {
          addFooter(pageCount);
        }

        // Nueva página
        doc.addPage();
        pageCount++;
        currentY = 25;

        // Recrear header de tabla en nueva página
        doc
          .rect(startX, currentY, tableWidth, rowHeight)
          .fill(this.colors.primary);
        doc.fillColor(this.colors.textWhite).fontSize(10).font(this.fontBoldName);

        const pageColWidths = [...baseColWidths];

        colX = startX + 10;
        headers.forEach((header, index) => {
          doc.text(header, colX, currentY + 3, {
            width: pageColWidths[index] - 20,
            align: index === 0 ? 'center' : 'left',
          });
          colX += pageColWidths[index];
        });

        currentY += rowHeight;
      }

      // Generar la orden (altura dinámica real de PDFKit)
      currentY = this.generateOrderRow(
        doc,
        detail,
        i,
        currentY,
        startX,
        baseColWidths,
        rowHeight,
        deliveryDay,
      );

      if (includeProductDetails && detail.order.items.length > 0) {
        currentY = this.generateProductDetails(
          doc,
          detail,
          currentY,
          startX,
          tableWidth,
        );
      }

      doc.rect(startX, currentY, tableWidth, 1).fill(this.colors.borderColor);
      currentY += 5;
    }

    // Agregar footer a la última página (marcándola como final) - solo si hay más de una página
    if (pageCount > 1) {
      addFooter(pageCount, true);
    }

    return currentY;
  }

  /**
   * Genera una fila de pedido con altura dinámica según el contenido
   */
  private generateOrderRow(
    doc: PDFKit.PDFDocument,
    detail: any,
    index: number,
    currentY: number,
    startX: number,
    colWidths: number[],
    rowHeight: number,
    deliveryDay: number | null,
  ): number {
    const isEven = index % 2 === 0;
    const rowBgColor = isEven ? this.colors.bgWhite : this.colors.bgPrimary;

    // Preparar los datos de cada columna
    const addressText =
      detail.order.customer.address && detail.order.customer.locality?.name
        ? `${detail.order.customer.address} - ${detail.order.customer.locality?.name}`
        : detail.order.customer.address || 'Sin dirección';

    let dueDays: number[] = [];
    const collectionDays = Array.isArray(detail.order.collection_days)
      ? detail.order.collection_days
      : [];
    const normalizedDays = collectionDays
      .map((day) => (typeof day === 'number' ? day : Number(day)))
      .filter((day) => Number.isFinite(day) && day > 0);
    if (normalizedDays.length > 0) {
      dueDays = normalizedDays;
    }
    if (dueDays.length === 0) dueDays = [0];
    const vColBaseWidth = 15;
    const vColWidth = vColBaseWidth * dueDays.length;
    // Compensar el ancho extra de la columna V tomándolo de la columna Cliente
    const extraVWidth = vColWidth - colWidths[1];
    const clienteWidth = colWidths[2] - extraVWidth;

    // Actualizar colWidths para esta fila
    const localColWidths = [...colWidths];
    localColWidths[1] = vColWidth;
    localColWidths[2] = clienteWidth;

    const cellData: Array<{
      text: string;
      fontSize: number;
      font: string;
      align: 'center' | 'left' | 'right';
      customRender?: (
        x: number,
        y: number,
        width: number,
        height: number,
      ) => void;
    }> = [
      {
        text: detail.order.order_id.toString(),
        fontSize: 9,
        font: this.fontBoldName,
        align: 'left',
      },
      {
        text: '', // Se renderiza manualmente abajo
        fontSize: 9,
        font: this.fontBoldName,
        align: 'left',
        customRender: (x, y, width, height) => {
          // Renderizar cada día como una caja de 15px de ancho
          let boxX = x;
          dueDays.forEach((day) => {
            const isToday = deliveryDay !== null && day === deliveryDay;
            // Fondo
            if (isToday) {
              doc
                .rect(boxX, y, vColBaseWidth, height)
                .fill(this.colors.primary);
            }
            // Texto
            doc
              .fontSize(9)
              .font(this.fontBoldName)
              .fillColor(
                isToday ? this.colors.textWhite : this.colors.textAccent,
              )
              .text(day === 0 ? '-' : day.toString(), boxX + 2, y + 3, {
                width: vColBaseWidth - 4,
                align: 'center',
              });
            boxX += vColBaseWidth;
          });
        },
      },
      {
        text: detail.order.customer.name,
        fontSize: 9,
        font: this.fontBoldName,
        align: 'left',
        customRender: (x, y, width, height) => {
          // Agregar margen izquierdo de 3px
          doc
            .fontSize(9)
            .font(this.fontBoldName)
            .fillColor(this.colors.textAccent)
            .text(detail.order.customer.name, x + 3, y + 3, {
              width: width - 3 - 5, // padding derecho
              align: 'left',
              lineGap: 2,
            });
        },
      },
      { text: addressText, fontSize: 9, font: this.fontRegularName, align: 'left' },
      {
        text: detail.order.customer.phone,
        fontSize: 9,
        font: this.fontRegularName,
        align: 'left',
      },
      {
        text: detail.delivery_time || 'N/D',
        fontSize: 9,
        font: this.fontRegularName,
        align: 'left',
      },
      {
        text: `$${detail.order.debt_amount ?? 0}`,
        fontSize: 9,
        font: this.fontBoldName,
        align: 'left',
      },
    ];

    // Calcular la altura necesaria para cada celda
    const minRowHeight = 17;
    const padding = 5;
    let maxHeight = minRowHeight;

    cellData.forEach((cell, colIndex) => {
      if (cell.customRender) {
        // Estimar altura como 1 línea
        maxHeight = Math.max(maxHeight, 12 + padding);
      } else {
        doc.fontSize(cell.fontSize).font(cell.font);
        const textHeight = doc.heightOfString(cell.text, {
          width: localColWidths[colIndex] - padding,
          align: cell.align,
        });
        maxHeight = Math.max(maxHeight, textHeight + padding);
      }
    });

    // Dibujar el fondo de la fila con la altura calculada
    doc.rect(startX, currentY, 545, maxHeight).fill(rowBgColor);
    doc
      .rect(startX, currentY, 4, maxHeight)
      .fill(isEven ? this.colors.primary : this.colors.secondary);

    // Renderizar cada celda
    let colX = startX + 10;
    cellData.forEach((cell, colIndex) => {
      if (cell.customRender) {
        cell.customRender(colX, currentY, localColWidths[colIndex], maxHeight);
      } else {
        // Color de texto
        const textColor =
          colIndex === 0 || colIndex === 1 || colIndex === 6
            ? this.colors.textAccent
            : this.colors.textPrimary;
        doc.fontSize(cell.fontSize).font(cell.font).fillColor(textColor);
        doc.text(cell.text, colX, currentY + 3, {
          width: localColWidths[colIndex] - padding,
          align: cell.align,
          lineGap: 2,
        });
      }
      colX += localColWidths[colIndex];
    });

    return currentY + maxHeight;
  }

  /**
   * Genera los detalles de productos
   */
  private generateProductDetails(
    doc: PDFKit.PDFDocument,
    detail: any,
    currentY: number,
    startX: number,
    tableWidth: number,
  ): number {
    // Preparar textos
    const aliasText = detail.order.customer.alias
      ? `${detail.order.customer.alias}`
      : '';
    const productText = detail.order.items
      .map((item: any) => `${item.quantity}x ${item.product.description}`)
      .join(' | ');
    // Comentarios: usar notes del pedido (nuevo formato)
    const commentsText =
      detail.order && detail.order.notes ? `${detail.order.notes}` : '';

    // Créditos: mostrar como "remaining_balance x product_description" por cada crédito con balance > 0
    const creditsArray: any[] = Array.isArray(detail.credits)
      ? detail.credits
      : [];
    const creditsText =
      creditsArray.length > 0
        ? creditsArray
            .filter((c) => c.remaining_balance > 0)
            .map((c) => `${c.remaining_balance}x ${c.product_description}`)
            .join(' | ')
        : '';

    // Notas del cliente: extraer special_instructions del customer
    let specialInstructionsText = '';
    const rawSpecial =
      detail.order &&
      detail.order.customer &&
      detail.order.customer.special_instructions;
    if (rawSpecial) {
      if (typeof rawSpecial === 'string') {
        try {
          const parsed = JSON.parse(rawSpecial);
          const fromPrefs =
            parsed?.delivery_preferences &&
            typeof parsed.delivery_preferences.special_instructions === 'string'
              ? parsed.delivery_preferences.special_instructions
              : '';
          const fromClientNotes =
            typeof parsed?.client_notes === 'string' ? parsed.client_notes : '';
          const fromOriginalNotes =
            typeof parsed?.original_notes === 'string'
              ? parsed.original_notes
              : '';
          specialInstructionsText =
            fromPrefs || fromClientNotes || fromOriginalNotes || '';
        } catch (e) {
          specialInstructionsText = rawSpecial;
        }
      } else if (typeof rawSpecial === 'object') {
        const fromPrefs =
          rawSpecial?.delivery_preferences &&
          typeof rawSpecial.delivery_preferences.special_instructions ===
            'string'
            ? rawSpecial.delivery_preferences.special_instructions
            : '';
        const fromClientNotes =
          typeof rawSpecial?.client_notes === 'string'
            ? rawSpecial.client_notes
            : '';
        const fromOriginalNotes =
          typeof rawSpecial?.original_notes === 'string'
            ? rawSpecial.original_notes
            : '';
        specialInstructionsText =
          fromPrefs || fromClientNotes || fromOriginalNotes || '';
      } else {
        specialInstructionsText = String(rawSpecial);
      }
    }
    specialInstructionsText =
      typeof specialInstructionsText === 'string'
        ? specialInstructionsText.trim()
        : '';

    // Configuración básica
    const labelGap = 10;
    let textY = currentY + 2;
    startX = startX + 5;

    // Renderizar PEDIDOS y calcular altura dinámica
    doc.fontSize(9).fillColor(this.colors.textPrimary).font(this.fontBoldName);
    doc.text('PEDIDOS:', startX, textY);
    doc.fontSize(9).fillColor(this.colors.textPrimary).font(this.fontRegularName);
    const productTextHeight = doc.heightOfString(productText, {
      width: tableWidth - 62,
    });
    doc.text(productText, startX + 52, textY, { width: tableWidth - 62 });
    textY += Math.max(productTextHeight, labelGap);

    // Renderizar los tres elementos en una sola línea horizontal, con separación mínima
    if (aliasText || specialInstructionsText || commentsText) {
      const col1X = startX;
      const col2X = startX + 149;
      const col3X = startX + 352;
      const colWidth = 160;

      // Calcular altura real de cada elemento solo si existe
      let aliasHeight = 0,
        notesHeight = 0,
        commentsHeight = 0;
      if (aliasText) {
        doc.fontSize(9).font(this.fontRegularName);
        aliasHeight = doc.heightOfString(aliasText, { width: colWidth - 65 });
      }
      if (specialInstructionsText) {
        doc.fontSize(9).font(this.fontRegularName);
        notesHeight = doc.heightOfString(specialInstructionsText, {
          width: colWidth - 45,
        });
      }
      if (commentsText) {
        doc.fontSize(9).font(this.fontRegularName);
        commentsHeight = doc.heightOfString(commentsText, {
          width: colWidth - 47,
        });
      }
      // Altura máxima de los elementos presentes, o labelGap si todos son 0
      const maxRowHeight = Math.max(
        aliasText ? aliasHeight : 0,
        specialInstructionsText ? notesHeight : 0,
        commentsText ? commentsHeight : 0,
        labelGap,
      );

      // Renderizar los elementos en la misma línea
      if (aliasText) {
        doc.fontSize(9).fillColor(this.colors.textPrimary).font(this.fontBoldName);
        doc.text('EMPRESA:', col1X, textY);
        doc.fontSize(9).fillColor(this.colors.textPrimary).font(this.fontRegularName);
        doc.text(aliasText, col1X + 50, textY, { width: colWidth - 65 });
      }
      if (specialInstructionsText) {
        doc.fontSize(9).fillColor(this.colors.textPrimary).font(this.fontBoldName);
        doc.text('NOTAS CLIENTE:', col2X, textY);
        doc.fontSize(9).fillColor(this.colors.textPrimary).font(this.fontRegularName);
        doc.text(specialInstructionsText, col2X + 78, textY, {
          width: colWidth - 45,
        });
      }
      if (commentsText) {
        doc.fontSize(9).fillColor(this.colors.textPrimary).font(this.fontBoldName);
        doc.text('COMENTARIOS:', col3X, textY);
        doc.fontSize(9).fillColor(this.colors.textPrimary).font(this.fontRegularName);
        doc.text(commentsText, col3X + 73, textY, { width: colWidth - 47 });
      }

      // Avanzar solo el alto real de los elementos presentes (o labelGap si todos son vacíos)
      textY += maxRowHeight;
    }

    if (creditsText) {
      doc.fontSize(9).fillColor(this.colors.textPrimary).font(this.fontBoldName);
      doc.text('EXTRAS DISPONIBLES:', startX, textY);
      doc.fontSize(9).fillColor(this.colors.textPrimary).font(this.fontRegularName);
      const creditsTextHeight = doc.heightOfString(creditsText, {
        width: tableWidth - 117,
      });
      doc.text(creditsText, startX + 107, textY, { width: tableWidth - 117 });
      textY += Math.max(creditsTextHeight, labelGap);
    }

    return textY + 5;
  }

  /**
   * Genera la sección de firmas
   */
  private generateSignatureSection(
    doc: PDFKit.PDFDocument,
    currentY: number,
  ): void {
    if (currentY > doc.page.height - 200) {
      doc.addPage();
      currentY = 25;
    }

    // Título de confirmación
    doc.rect(25, currentY, 545, 25).fill(this.colors.primary);
    doc.fillColor(this.colors.textWhite).fontSize(12).font(this.fontBoldName);
    doc.text('CONFIRMACIÓN DE ENTREGAS', 25, currentY + 5, {
      align: 'center',
      width: 545,
    });
    currentY += 40;

    const signatureHeight = 80;
    const signatureWidth = 260;

    // Firma del conductor
    doc
      .rect(25, currentY, signatureWidth, signatureHeight)
      .fill(this.colors.bgWhite)
      .stroke(this.colors.borderColor);
    doc.rect(25, currentY, 4, signatureHeight).fill(this.colors.primary);

    doc.fillColor(this.colors.textPrimary).fontSize(12).font(this.fontBoldName);
    doc.text('CONDUCTOR', 45, currentY + 10);

    doc.fontSize(10).font(this.fontRegularName).fillColor(this.colors.textPrimary);
    doc.text('Nombre: _________________________', 45, currentY + 30);
    doc.text('Fecha: _____ / _____ / _____', 45, currentY + 50);
    doc.text('Hora: _____ : _____', 45, currentY + 65);

    // Firma del supervisor
    const supervisorX = 315;
    doc
      .rect(supervisorX, currentY, signatureWidth, signatureHeight)
      .fill(this.colors.bgWhite)
      .stroke(this.colors.borderColor);
    doc
      .rect(supervisorX, currentY, 4, signatureHeight)
      .fill(this.colors.secondary);

    doc.fillColor(this.colors.textPrimary).fontSize(12).font(this.fontBoldName);
    doc.text('SUPERVISOR', supervisorX + 20, currentY + 10);

    doc.fontSize(10).font(this.fontRegularName).fillColor(this.colors.textPrimary);
    doc.text('Nombre: _____________________', supervisorX + 20, currentY + 30);
    doc.text('Fecha: _____ / _____ / _____', supervisorX + 20, currentY + 50);
    doc.text('Hora: _____ : _____', supervisorX + 20, currentY + 65);
  }

  private translatePaymentStatus(status: string): string {
    const map = {
      none: '-',
      pending: 'PENDIENTE',
      partial: 'PARCIAL',
      paid: 'PAGADO',
      overdue: 'VENCIDO',
      credited: 'ACREDITADO',
    } as Record<string, string>;
    const key = String(status || '').toLowerCase();
    return map[key] || status || 'PENDIENTE';
  }

  /**
   * Genera un PDF específico para hojas de ruta de cobranzas automáticas
   */
  async generateCollectionRouteSheetPdf(
    data: CollectionRouteSheetPdfData,
    options: PdfGenerationOptions = {},
  ): Promise<{ doc: PDFKit.PDFDocument; filename: string; pdfPath: string }> {
    const filename = this.buildCollectionRouteSheetFilename(data);
    const pdfPath = join(process.cwd(), 'public', 'pdfs', filename);

    // Asegurar que el directorio existe
    await fs.ensureDir(dirname(pdfPath));

    const doc = new PDFDocument({ margin: 25 });
    await this.generateCollectionRouteSheetContent(doc, data, options);

    return { doc, filename, pdfPath };
  }

  /**
   * Construye el nombre de archivo para hoja de ruta de cobranzas automáticas.
   * Formato unificado: cobranza-automatica-hoja-de-ruta_YYYY-MM-DD_m<móvil-slug|mNA>_z<zonas-slugs|zall>_d<chofer-slug|dNA>.pdf
   */
  private buildCollectionRouteSheetFilename(
    data: CollectionRouteSheetPdfData,
  ): string {
    const base = 'cobranza-automatica-hoja-de-ruta';
    const ymd =
      typeof data.delivery_date === 'string'
        ? data.delivery_date
        : formatBAYMD(new Date(data.delivery_date));
    const timeRaw = formatBAHMS(new Date());
    const timePart = `${timeRaw.slice(0, 2)}-${timeRaw.slice(2, 4)}-${timeRaw.slice(4, 6)}`;

    // Movil/vehículo
    const rawVehicle = data.vehicle?.name || data.vehicle?.code || '';
    const vehiclePart = rawVehicle
      ? `m${this.slugifyForFilename(rawVehicle)}`
      : 'mNA';

    // Zonas
    const zones = Array.isArray(data.zone_identifiers)
      ? data.zone_identifiers
      : [];
    let zonesPart = 'zall';
    if (zones.length > 0) {
      const uniqueZones = Array.from(new Set(zones)).map((z) =>
        this.slugifyForFilename(z),
      );
      zonesPart = `z${uniqueZones.join('-')}`;
    }

    // Chofer
    const rawDriver = data.driver?.name || '';
    const driverPart = rawDriver
      ? `d${this.slugifyForFilename(rawDriver)}`
      : 'dNA';

    return `${base}_${ymd}-${timePart}_${vehiclePart}_${zonesPart}_${driverPart}.pdf`;
  }

  /**
   * Formatea fecha a dd/MM/yyyy para uso en nombre de archivo.
   * Usamos el símbolo de fracción U+2215 (∕) para evitar usar el separador de ruta
   * en sistemas de archivos, manteniendo la apariencia de barra.
   */
  private formatDateForFilename(dateInput: string | Date): string {
    const slash = '∕';
    if (typeof dateInput === 'string') {
      const m = dateInput.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (m) return `${m[3]}${slash}${m[2]}${slash}${m[1]}`;
    }
    const parts = new Intl.DateTimeFormat(this.baLocale, {
      timeZone: this.baTimeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(
      typeof dateInput === 'string' ? new Date(dateInput) : dateInput,
    );
    const get = (t: string) =>
      String(parts.find((p) => p.type === t)?.value || '').padStart(
        t === 'day' || t === 'month' ? 2 : 0,
        '0',
      );
    const dd = get('day');
    const mm = get('month');
    const yyyy = get('year');
    return `${dd}${slash}${mm}${slash}${yyyy}`;
  }

  /**
   * Formatea fecha a YYYY-MM-DD para uso en nombre de archivo unificado
   */
  private formatDateYMD(dateInput: string | Date): string {
    if (typeof dateInput === 'string') return dateInput;
    return formatBAYMD(dateInput);
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

  /**
   * Formatea fecha para mostrar en el PDF como dd/MM/yyyy (slash ASCII)
   */
  private formatDateForDisplay(dateInput: string | Date): string {
    if (typeof dateInput === 'string') {
      const m = dateInput.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (m) return `${m[3]}/${m[2]}/${m[1]}`;
    }
    const parts = new Intl.DateTimeFormat(this.baLocale, {
      timeZone: this.baTimeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(
      typeof dateInput === 'string' ? new Date(dateInput) : dateInput,
    );
    const get = (t: string) =>
      String(parts.find((p) => p.type === t)?.value || '').padStart(
        t === 'day' || t === 'month' ? 2 : 0,
        '0',
      );
    const dd = get('day');
    const mm = get('month');
    const yyyy = get('year');
    return `${dd}/${mm}/${yyyy}`;
  }

  private safeFormatDateYMDDisplay(dateInput: string | Date): string {
    if (!dateInput) return '-';
    if (typeof dateInput === 'string') {
      const m = dateInput.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (m) return `${m[3]}/${m[2]}/${m[1]}`;
    }
    return this.formatDateForDisplay(dateInput);
  }

  /**
   * Genera el contenido del PDF para hojas de ruta de cobranzas
   */
  private async generateCollectionRouteSheetContent(
    doc: PDFKit.PDFDocument,
    routeSheet: CollectionRouteSheetPdfData,
    options: PdfGenerationOptions,
  ): Promise<void> {
    // Asegurar fuentes (registro si existen, fallback a Helvetica)
    this.ensureFonts(doc);

    let currentY = 25;

    // Header
    currentY = this.generateCollectionHeader(doc, routeSheet, currentY);
    currentY += 20;

    // Driver and Vehicle Info
    currentY = this.generateDriverVehicleInfo(doc, routeSheet, currentY);

    // Collections Table
    currentY = this.generateCollectionsTable(doc, routeSheet, currentY);
    currentY += 30;

    // Signature Section
    if (options.includeSignatureField !== false) {
      this.generateSignatureSection(doc, currentY);
    }

    // Footer eliminado - no es necesario para impresión
  }

  /**
   * Genera el header específico para hojas de ruta de cobranzas
   */
  private generateCollectionHeader(
    doc: PDFKit.PDFDocument,
    routeSheet: CollectionRouteSheetPdfData,
    currentY: number,
  ): number {
    // Línea superior decorativa
    doc.rect(25, currentY, 545, 3).fill(this.colors.primary);
    currentY += 15;

    // Título principal
    doc
      .fontSize(12)
      .font(this.fontBoldName)
      .fillColor(this.colors.primary)
      .text('HOJA DE RUTA - COBRANZAS', 25, currentY, { align: 'left' });

    // Información básica - solo fecha
    doc.fontSize(12).font(this.fontRegularName).fillColor(this.colors.textPrimary);

    const displayDate = this.formatDateForDisplay(routeSheet.delivery_date);
    doc.text(`Fecha: ${displayDate}`, 440, currentY);

    currentY += 5;

    return currentY;
  }

  /**
   * Genera la tabla de cobranzas
   */
  private generateCollectionsTable(
    doc: PDFKit.PDFDocument,
    routeSheet: CollectionRouteSheetPdfData,
    currentY: number,
  ): number {
    const startX = 25;
    const tableWidth = 545; // 595 - 25 - 25 = 545px disponibles
    const rowHeight = 17;
    const headerHeight = 17;

    // Headers de la tabla
    const headers = [
      '#',
      'Cliente',
      'Dirección',
      'Teléfono',
      'Monto',
      'Venc.',
      'Estado',
    ];
    // Ajustado para que sumen exactamente 545px: 30+100+175+65+60+50+65 = 545
    const colWidths = [30, 95, 145, 80, 65, 60, 70];

    // Calcular límite inferior de página (842 es altura A4, dejamos 70px de margen para seguridad)
    const pageBottomLimit = 772; // 842 - 70 (balanceado)

    // Helper para dibujar header de tabla
    const drawTableHeader = (y: number): number => {
      let headerX = startX;
      doc.rect(startX, y, tableWidth, headerHeight).fill(this.colors.primary);

      doc.fontSize(9).font(this.fontBoldName).fillColor(this.colors.textWhite);

      headers.forEach((header, index) => {
        doc.text(header, headerX + 5, y + 4, {
          width: colWidths[index] - 10,
          align: 'center',
        });
        headerX += colWidths[index];
      });

      return y + headerHeight;
    };

    // Header de la tabla inicial
    currentY = drawTableHeader(currentY);

    // Filas de datos
    routeSheet.collections.forEach((collection, index) => {
      // Calcular altura real que ocupará esta fila (incluyendo notas)
      const calculatedRowHeight = this.calculateCollectionRowHeight(
        doc,
        collection,
        colWidths,
      );

      // Verificar si necesitamos nueva página ANTES de renderizar (con margen extra de seguridad)
      if (currentY + calculatedRowHeight + 30 > pageBottomLimit) {
        doc.addPage();
        currentY = 25; // Margen superior
        // Redibujar header en la nueva página
        currentY = drawTableHeader(currentY);
      }

      currentY = this.generateCollectionRow(
        doc,
        collection,
        index + 1,
        currentY,
        startX,
        colWidths,
        routeSheet.delivery_date,
      );
    });

    return currentY;
  }

  /**
   * Construye el texto de notas para una cobranza (usado tanto para calcular como para renderizar)
   */
  private buildCollectionNotesText(collection: any): string {
    const parts: string[] = [];
    const raw =
      collection.subscription_notes ||
      collection.payment_notes ||
      collection.comments ||
      '';
    if (raw) {
      if (typeof raw === 'string') {
        try {
          const parsed = JSON.parse(raw);
          const dp = parsed?.delivery_preferences || {};
          const si = dp?.special_instructions;
          const tr = dp?.preferred_time_range;
          const segs: string[] = [];
          if (si) segs.push(si.charAt(0).toUpperCase() + si.slice(1));
          if (tr)
            segs.push(
              `Horario: ${String(tr).replace(/\s*/g, '').replace('-', ' - ')}`,
            );
          if (segs.length > 0) parts.push(segs.join(' - '));
        } catch {
          const getMatch = (re: RegExp) => {
            const m = raw.match(re);
            return m && m[1] ? m[1] : undefined;
          };
          const si = getMatch(/"special_instructions"\s*:\s*"([^"]*)"/);
          const tr = getMatch(/"preferred_time_range"\s*:\s*"([^"]*)"/);
          const segs: string[] = [];
          if (si) segs.push(si.charAt(0).toUpperCase() + si.slice(1));
          if (tr)
            segs.push(
              `Horario: ${String(tr).replace(/\s*/g, '').replace('-', ' - ')}`,
            );
          if (segs.length > 0) {
            parts.push(segs.join(' - '));
          } else {
            const simplified = raw
              .replace(/[{}]/g, '')
              .replace(/"/g, '')
              .replace(/\s*,\s*/g, ' | ')
              .replace(/delivery_preferences\s*:\s*/i, '')
              .trim();
            if (simplified) parts.push(simplified);
          }
        }
      } else if (typeof raw === 'object') {
        try {
          const dp = raw?.delivery_preferences || {};
          const si = dp?.special_instructions;
          const tr = dp?.preferred_time_range;
          const segs: string[] = [];
          if (si) segs.push(si.charAt(0).toUpperCase() + si.slice(1));
          if (tr)
            segs.push(
              `Horario: ${String(tr).replace(/\s*/g, '').replace('-', ' - ')}`,
            );
          if (segs.length > 0) parts.push(segs.join(' - '));
        } catch {
          const simplified = String(raw);
          if (simplified) parts.push(simplified);
        }
      }
    }
    const firstCredit =
      Array.isArray(collection.credits) && collection.credits.length > 0
        ? collection.credits[0]
        : undefined;
    if (firstCredit) {
      const plan = Number(firstCredit.planned_quantity ?? 0);
      const delivered = Number(firstCredit.delivered_quantity ?? 0);
      const remaining = Number(
        firstCredit.remaining_balance ?? Math.max(plan - delivered, 0),
      );
      parts.push(
        `Abono: ${firstCredit.product_description} - Plan: ${plan} - Entregado: ${delivered} - Saldo: ${remaining}`,
      );
    }
    if (collection.subscription_plan) {
      parts.unshift(`Abono: ${collection.subscription_plan}`);
    }
    return parts.join(' | ').trim();
  }

  /**
   * Calcula la altura total que ocupará una fila de cobranza (incluyendo notas)
   */
  private calculateCollectionRowHeight(
    doc: PDFKit.PDFDocument,
    collection: any,
    colWidths: number[],
  ): number {
    // Calcular altura de las celdas
    const minRowHeight = 17;
    const padding = 7;
    let maxHeight = minRowHeight;

    const addressText =
      [collection.customer.address, collection.customer.locality?.name]
        .map((v) => (v || '').trim())
        .filter(Boolean)
        .join(' - ') || '-';

    // Extraer día de vencimiento
    const extractDay = (dateStr: string): string | null => {
      const match = dateStr.match(/\d{4}-\d{2}-(\d{2})/);
      return match ? match[1] : null;
    };
    const dueDay = collection.payment_due_date
      ? extractDay(collection.payment_due_date) || '-'
      : '-';

    const cellData: Array<{ text: string; width: number }> = [
      { text: collection.customer.customer_id.toString(), width: colWidths[0] },
      { text: collection.customer.name, width: colWidths[1] },
      { text: addressText, width: colWidths[2] },
      { text: collection.customer.phone || '-', width: colWidths[3] },
      { text: `$${collection.amount.toFixed(2)}`, width: colWidths[4] },
      { text: dueDay, width: colWidths[5] },
      {
        text: this.translatePaymentStatus(collection.payment_status),
        width: colWidths[6],
      },
    ];

    doc.fontSize(9).font(this.fontRegularName);
    cellData.forEach((cell) => {
      const textHeight = doc.heightOfString(cell.text, {
        width: cell.width - padding,
      });
      maxHeight = Math.max(maxHeight, textHeight + padding);
    });

    // Calcular altura de las notas si existen (usando la misma lógica que el renderizado)
    let notesHeight = 0;
    const finalNotes = this.buildCollectionNotesText(collection);

    if (finalNotes) {
      doc.fontSize(9).font(this.fontRegularName);
      const notesTextHeight = doc.heightOfString(finalNotes, {
        width: colWidths.reduce((a, b) => a + b, 0) - 60,
      });
      notesHeight = notesTextHeight + 10; // +2 margen superior + 5 padding inferior + 3 extra
    }

    return maxHeight + notesHeight + 5; // +5 para separación entre filas
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
    deliveryYmd: string,
  ): number {
    const fillColor =
      index % 2 === 0 ? this.colors.bgWhite : this.colors.bgPrimary;

    // Preparar los datos de dirección con localidad
    const addressText =
      [collection.customer.address, collection.customer.locality?.name]
        .map((v) => (v || '').trim())
        .filter(Boolean)
        .join(' - ') || '-';

    // Extraer día de vencimiento
    const extractDay = (dateStr: string): string | null => {
      const match = dateStr.match(/\d{4}-\d{2}-(\d{2})/);
      return match ? match[1] : null;
    };

    // Obtener el día de la fecha de vencimiento
    const dueDay = collection.payment_due_date
      ? extractDay(collection.payment_due_date) || '-'
      : '-';

    // Obtener el día actual de la fecha de entrega
    const currentDay = extractDay(deliveryYmd) || '';

    // Verificar si el vencimiento es hoy
    const isDueToday = dueDay === currentDay;

    const cellData: Array<{
      text: string;
      align: 'center' | 'left' | 'right';
      isVencColumn?: boolean;
    }> = [
      { text: collection.customer.customer_id.toString(), align: 'center' },
      { text: collection.customer.name, align: 'left' },
      { text: addressText, align: 'left' },
      { text: collection.customer.phone || '-', align: 'center' },
      { text: `$${collection.amount.toFixed(2)}`, align: 'center' },
      { text: dueDay, align: 'center', isVencColumn: true },
      {
        text: this.translatePaymentStatus(collection.payment_status),
        align: 'center',
      },
    ];

    // Calcular altura necesaria para cada celda
    const minRowHeight = 17;
    const padding = 7;
    let maxHeight = minRowHeight;

    doc.fontSize(9).font(this.fontRegularName);
    cellData.forEach((cell, colIndex) => {
      const textHeight = doc.heightOfString(cell.text, {
        width: colWidths[colIndex] - padding,
        align: cell.align,
      });
      maxHeight = Math.max(maxHeight, textHeight + padding);
    });

    const tableWidth = colWidths.reduce((a, b) => a + b, 0);

    // Dibujar fondo de la fila con altura calculada
    doc.rect(startX, currentY, tableWidth, maxHeight).fill(fillColor);

    // Si el vencimiento es hoy, dibujar fondo negro en la columna Venc. (índice 5)
    if (isDueToday) {
      const vColX = startX + colWidths.slice(0, 5).reduce((a, b) => a + b, 0);
      doc
        .rect(vColX, currentY, colWidths[5], maxHeight)
        .fill(this.colors.primary);
    }

    // Renderizar cada celda con texto multilínea
    let cellX = startX;

    cellData.forEach((cell, colIndex) => {
      // Usar texto blanco para la columna de Vencimiento (índice 5) si es hoy
      const textColor =
        isDueToday && cell.isVencColumn
          ? this.colors.textWhite
          : this.colors.textPrimary;

      doc.fontSize(9).font(this.fontRegularName).fillColor(textColor);
      doc.text(cell.text, cellX + 5, currentY + 5, {
        width: colWidths[colIndex] - padding,
        align: cell.align,
        lineGap: 2,
      });
      cellX += colWidths[colIndex];
    });

    let notesHeight = 0;
    const buildNotesText = (): string => {
      const parts: string[] = [];
      const raw =
        collection.subscription_notes ||
        collection.payment_notes ||
        collection.comments ||
        '';
      if (raw) {
        if (typeof raw === 'string') {
          try {
            const parsed = JSON.parse(raw);
            const dp = parsed?.delivery_preferences || {};
            const si = dp?.special_instructions;
            const tr = dp?.preferred_time_range;
            const segs: string[] = [];
            if (si) segs.push(si.charAt(0).toUpperCase() + si.slice(1));
            if (tr)
              segs.push(
                `Horario: ${String(tr).replace(/\s*/g, '').replace('-', ' - ')}`,
              );
            if (segs.length > 0) parts.push(segs.join(' - '));
          } catch {
            const getMatch = (re: RegExp) => {
              const m = raw.match(re);
              return m && m[1] ? m[1] : undefined;
            };
            const si = getMatch(/"special_instructions"\s*:\s*"([^"]*)"/);
            const tr = getMatch(/"preferred_time_range"\s*:\s*"([^"]*)"/);
            const segs: string[] = [];
            if (si) segs.push(si.charAt(0).toUpperCase() + si.slice(1));
            if (tr)
              segs.push(
                `Horario: ${String(tr).replace(/\s*/g, '').replace('-', ' - ')}`,
              );
            if (segs.length > 0) {
              parts.push(segs.join(' - '));
            } else {
              const simplified = raw
                .replace(/[{}]/g, '')
                .replace(/"/g, '')
                .replace(/\s*,\s*/g, ' | ')
                .replace(/delivery_preferences\s*:\s*/i, '')
                .trim();
              if (simplified) parts.push(simplified);
            }
          }
        } else if (typeof raw === 'object') {
          try {
            const dp = raw?.delivery_preferences || {};
            const si = dp?.special_instructions;
            const tr = dp?.preferred_time_range;
            const segs: string[] = [];
            if (si) segs.push(si.charAt(0).toUpperCase() + si.slice(1));
            if (tr)
              segs.push(
                `Horario: ${String(tr).replace(/\s*/g, '').replace('-', ' - ')}`,
              );
            if (segs.length > 0) parts.push(segs.join(' - '));
          } catch {
            const simplified = String(raw);
            if (simplified) parts.push(simplified);
          }
        }
      }
      const firstCredit =
        Array.isArray(collection.credits) && collection.credits.length > 0
          ? collection.credits[0]
          : undefined;
      if (firstCredit) {
        const plan = Number(firstCredit.planned_quantity ?? 0);
        const delivered = Number(firstCredit.delivered_quantity ?? 0);
        const remaining = Number(
          firstCredit.remaining_balance ?? Math.max(plan - delivered, 0),
        );
        parts.push(
          `Abono: ${firstCredit.product_description} - Plan: ${plan} - Entregado: ${delivered} - Saldo: ${remaining}`,
        );
      }
      if (collection.subscription_plan) {
        parts.unshift(`Abono: ${collection.subscription_plan}`);
      }
      // Información de cuotas vencidas y múltiples vencimientos por día se elimina para cobranzas
      return parts.join(' | ').trim();
    };
    const finalNotes = buildNotesText();
    if (finalNotes) {
      const notesY = currentY + maxHeight + 2;
      const notesTextHeight = doc.heightOfString(finalNotes, {
        width: colWidths.reduce((a, b) => a + b, 0) - 60,
      });
      notesHeight = notesTextHeight + 5;
      doc
        .rect(
          startX,
          currentY + maxHeight,
          colWidths.reduce((a, b) => a + b, 0),
          notesHeight,
        )
        .fill(this.colors.warningColor)
        .stroke(this.colors.borderColor);
      doc.fontSize(9).font(this.fontRegularName).fillColor(this.colors.textPrimary);
      doc.text('Notas: ', startX + 5, notesY);
      doc.fontSize(9).font(this.fontRegularName).fillColor(this.colors.textPrimary);
      doc.text(finalNotes, startX + 50, notesY, {
        width: colWidths.reduce((a, b) => a + b, 0) - 60,
        align: 'left',
        lineGap: 1,
      });
    }

    // Bordes verticales - dibujados al final para no cortar las notas
    doc.strokeColor(this.colors.borderColor).lineWidth(0.5);

    let borderX = startX;
    colWidths.forEach((width) => {
      doc
        .moveTo(borderX, currentY)
        .lineTo(borderX, currentY + maxHeight)
        .stroke();
      borderX += width;
    });

    // Borde inferior
    doc
      .moveTo(startX, currentY + maxHeight + notesHeight)
      .lineTo(startX + tableWidth, currentY + maxHeight + notesHeight)
      .stroke();

    return currentY + maxHeight + notesHeight;
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
      doc.end();
      writeStream.on('finish', () => {
        const url = `/public/pdfs/${filename}`;
        resolve({ url, filename });
      });
      writeStream.on('error', reject);
    });
  }
}
