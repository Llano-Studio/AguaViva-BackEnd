import { Injectable } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';
import * as fs from 'fs-extra';
import { join, dirname } from 'path';
import { TempFileManagerService } from './temp-file-manager.service';
import { formatBAYMD, formatBATimestampISO } from '../utils/date.utils';
import { GeneratePdfCollectionsDto, PdfGenerationResponseDto } from '../../orders/dto/generate-pdf-collections.dto';
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
  route_notes?: string;
  // Identificadores de zona para usar en nombre de archivo (nombres legibles)
  zone_identifiers?: string[];
  details: Array<{
    route_sheet_detail_id: number;
    route_sheet_id: number;
    order: {
      order_id: number;
      order_date: string;
      total_amount: string;
      status: string;
      customer: {
        person_id: number;
        name: string;
        alias?: string;
        address: string;
        phone: string;
        locality?: {
          name: string;
        };
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
    };
    delivery_status: string;
    delivery_time: string;
    is_current_delivery: boolean;
    comments?: string;
    credits?: Array<{
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
  // Identificadores de zona para usar en nombre de archivo (e.g., ["zona1", "zona2"])
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

  constructor(private readonly tempFileManager: TempFileManagerService) {}
  private readonly baTimeZone = 'America/Argentina/Buenos_Aires';
  private readonly baLocale = 'es-AR';

  /**
   * Genera un PDF de reporte de cobranzas automáticas
   */
  async generateCollectionReportPdf(
    filters: GeneratePdfCollectionsDto,
    collectionsData: AutomatedCollectionListResponseDto
  ): Promise<PdfGenerationResponseDto> {
    try {
      const fileName = this.tempFileManager.generateUniqueFileName('collections-report');
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
    collectionsData: AutomatedCollectionListResponseDto
  ): void {
    // Título del reporte
    doc.fontSize(20).text('Reporte de Cobranzas Automáticas', { align: 'center' });
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
    doc.text(`Monto total: $${parseFloat(collectionsData.summary.total_amount).toFixed(2)}`);
    doc.text(`Total pendientes: ${collectionsData.summary.total_pending}`);
    doc.text(`Total vencidas: ${collectionsData.summary.overdue_count}`);
    doc.text(`Monto vencido: $${parseFloat(collectionsData.summary.overdue_amount).toFixed(2)}`);
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
        doc.text(`   ID: ${collection.order_id} | Monto: $${collection.total_amount}`);
        doc.text(`   Estado: ${collection.status} | Pago: ${collection.payment_status}`);
        doc.text(`   Fecha venc.: ${collection.due_date ? this.safeFormatDateYMDDisplay(collection.due_date) : 'N/A'}`);
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
    const vehicleSeg = data.vehicle?.name
      ? this.slugify(data.vehicle.name)
      : (data.vehicle?.code ? this.slugify(data.vehicle.code) : 'NA');
    const zoneSegRaw = (data.zone_identifiers && data.zone_identifiers.length > 0)
      ? data.zone_identifiers.join('-')
      : 'all';
    const zoneSeg = zoneSegRaw.length > 80 ? `multi-${data.zone_identifiers?.length || 0}` : this.slugify(zoneSegRaw);
    const driverSeg = data.driver?.name ? this.slugify(data.driver.name) : 'NA';
    const filename = `hoja-de-ruta_${datePart}_${vehicleSeg}_${zoneSeg}_${driverSeg}.pdf`;
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
    const {
      includeSignatureField = true,
      includeProductDetails = true,
    } = options;

    // Registrar fuentes Poppins
    const fontsPath = join(process.cwd(), 'public', 'fonts');
    doc.registerFont('Poppins', join(fontsPath, 'Poppins-Regular.ttf'));
    doc.registerFont('Poppins-Bold', join(fontsPath, 'Poppins-Bold.ttf'));

    let currentY = 25;
    
    // Header
    currentY = this.generateHeader(doc, routeSheet, currentY);
    
    // Información del conductor y vehículo
    currentY = this.generateDriverVehicleInfo(doc, routeSheet, currentY);
    
    // Notas de ruta
    currentY = this.generateRouteNotes(doc, routeSheet, currentY);
    
    // Tabla de pedidos (con paginación y footer integrado)
    currentY = this.generateOrdersTableWithFooters(doc, routeSheet, currentY, includeProductDetails);
    
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
   * Genera el header del PDF
   */
  private generateHeader(doc: PDFKit.PDFDocument, routeSheet: RouteSheetPdfData, currentY: number): number {
    // Línea superior decorativa
    doc.rect(25, currentY, 545, 3).fill(this.colors.primary);
    currentY += 15;
    
    // Título principal
    doc.fontSize(15).font('Poppins-Bold').fillColor(this.colors.textPrimary);
    doc.text(`HOJA DE RUTA PEDIDOS #${routeSheet.route_sheet_id}`, 25, currentY);
    
    // Fecha de entrega (más a la derecha, misma línea)
    doc.fontSize(12).font('Poppins').fillColor(this.colors.textPrimary);
    const displayDate = this.formatDateForDisplay(routeSheet.delivery_date);
    doc.text(`Fecha: ${displayDate}`, 440, currentY + 4);
    
    // Zonas cubiertas
    if (routeSheet.zones_covered && routeSheet.zones_covered.length > 0) {
      const zonesNames = routeSheet.zones_covered.map(z => z.name).join(', ');
      doc.fontSize(12).font('Poppins').fillColor(this.colors.textPrimary);
      doc.text(`Zonas: ${zonesNames}`, 25, currentY + 25);
      return currentY + 60;
    }
    
    return currentY + 40;
  }



  /**
   * Genera la información del conductor y vehículo
   */
  private generateDriverVehicleInfo(doc: PDFKit.PDFDocument, routeSheet: RouteSheetPdfData | CollectionRouteSheetPdfData, currentY: number): number {
    // Calcular ancho disponible respetando márgenes de 25px
    const availableWidth = 545; // 595 - 25 - 25
    const boxWidth = Math.floor((availableWidth - 25) / 2); // Espacio entre las dos cajas
    const startX = 25;
    const vehicleX = startX + boxWidth + 25; // 25px de separación entre las cajas
    
    // Información del conductor
    doc.rect(startX, currentY, boxWidth, 56).fill(this.colors.bgPrimary).stroke(this.colors.borderColor);
    doc.rect(startX, currentY, 4, 56).fill(this.colors.primary);
    
    doc.fontSize(12).font('Poppins-Bold').fillColor(this.colors.textPrimary);
    doc.text('CONDUCTOR', startX + 20, currentY + 5);
    
    doc.fontSize(11).font('Poppins').fillColor(this.colors.textPrimary);
    doc.text(`Nombre: ${routeSheet.driver.name}`, startX + 20, currentY + 20);

    // Información del vehículo
    doc.rect(vehicleX, currentY, boxWidth, 56).fill(this.colors.bgPrimary).stroke(this.colors.borderColor);
    doc.rect(vehicleX, currentY, 4, 56).fill(this.colors.secondary);
    
    doc.fontSize(12).font('Poppins-Bold').fillColor(this.colors.textPrimary);
    doc.text('VEHÍCULO', vehicleX + 20, currentY + 5);
    
    doc.fontSize(11).font('Poppins').fillColor(this.colors.textPrimary);
    doc.text(`Nombre: ${routeSheet.vehicle.name}`, vehicleX + 20, currentY + 20);
    doc.text(`Código: ${routeSheet.vehicle.code}`, vehicleX + 20, currentY + 35);

    return currentY + 70;
  }

  /**
   * Genera las notas de ruta
   */
  private generateRouteNotes(doc: PDFKit.PDFDocument, routeSheet: RouteSheetPdfData | CollectionRouteSheetPdfData, currentY: number): number {
    if (routeSheet.route_notes) {
      const startX = 25;
      const notesWidth = 545; // 595 - 25 - 25
      const textWidth = notesWidth - 40; // 20px padding en cada lado
      
      doc.rect(startX, currentY, notesWidth, 46).fill(this.colors.warningColor).stroke(this.colors.borderColor);
      
      doc.fontSize(12).font('Poppins-Bold').fillColor(this.colors.textPrimary);
      doc.text('INSTRUCCIONES ESPECIALES', startX + 20, currentY + 8);
      
      doc.fontSize(11).font('Poppins').fillColor(this.colors.textPrimary);
      doc.text(routeSheet.route_notes, startX + 20, currentY + 25, { width: textWidth });
      return currentY + 63;
    }
  }





  /** 
   * Genera la tabla de pedidos con control de paginación y footers integrados
   */
  private generateOrdersTableWithFooters(
    doc: PDFKit.PDFDocument, 
    routeSheet: RouteSheetPdfData, 
    currentY: number, 
    includeProductDetails: boolean
  ): number {
    console.log(`DEBUG: Iniciando generación con paginación dinámica (altura real)`);
    
    const startX = 25;
    const tableWidth = 545; // 595 - 25 - 25 = 545px disponibles
    const rowHeight = 27;
    
    // Headers de la tabla
    const headers = ['N°', 'Cliente', 'Dirección', 'Teléfono', 'Horario', 'Total'];
    const colWidths = [40, 120, 135, 100, 80, 70];    let pageCount = 1;
    
    // Función helper para agregar footer con información completa de la hoja de ruta
    const addFooter = (currentPageNum: number, isLastPage: boolean = false) => {
      const footerY = doc.page.height - 85; // Más espacio para la información adicional
      
      // Para la mayoría de casos, estimamos máximo 3 páginas
      // Si necesitamos más precisión, se puede implementar regeneración
      const totalPages = isLastPage ? currentPageNum : Math.max(currentPageNum, 2);
      
            // Línea decorativa superior del footer
      doc.rect(25, footerY - 10, 545, 1).fill(this.colors.borderColor);
      
      // Número de hoja de ruta y fecha en la misma línea
      doc.fontSize(10).font('Poppins').fillColor(this.colors.textAccent);
      doc.text(`#${routeSheet.route_sheet_id}`, 25, footerY);
      
      doc.fontSize(10).font('Poppins').fillColor(this.colors.textPrimary);
      const displayDate = this.formatDateForDisplay(routeSheet.delivery_date);
      doc.text(`Fecha: ${displayDate}`, 200, footerY + 2);
      
      // Vehículo en el centro
      doc.fontSize(10).font('Poppins').fillColor(this.colors.textPrimary);
      doc.text(`Vehículo: ${routeSheet.vehicle?.name || 'N/D'}`, 350, footerY + 2);
      
      // Paginación en el lado derecho de la misma línea
      doc.fontSize(10).font('Poppins').fillColor(this.colors.secondary);
      doc.text(`Página ${currentPageNum}/${totalPages}`, 470, footerY + 3, { width: 100, align: 'right' });
      
      // Zonas en la línea de abajo (si existen)
      if (routeSheet.zones_covered && routeSheet.zones_covered.length > 0) {
        const zonesNames = routeSheet.zones_covered.map(z => z.name).join(', ');
        doc.fontSize(10).font('Poppins').fillColor(this.colors.textPrimary);
        doc.text(`Zonas: ${zonesNames}`, 25, footerY + 15);
      }
      
      return footerY;
    };

    // Header inicial de la tabla
    doc.rect(startX, currentY, tableWidth, rowHeight).fill(this.colors.primary);
    doc.fillColor(this.colors.textWhite).fontSize(12).font('Poppins-Bold');
    
    let colX = startX + 10;
    headers.forEach((header, index) => {
      doc.text(header, colX, currentY + 6, { 
        width: colWidths[index] - 20,
        align: index === 0 ? 'center' : 'left'
      });
      colX += colWidths[index];
    });
    
    currentY += rowHeight;

    // Generar órdenes con altura dinámica real
    for (let i = 0; i < routeSheet.details.length; i++) {
      const detail = routeSheet.details[i];

      console.log(`DEBUG: Orden ${i + 1} - currentY antes: ${currentY}, límite: ${doc.page.height - 250}`);
      
      // Verificar si necesitamos nueva página ANTES de procesar
      if (currentY > doc.page.height - 250) {
        console.log(`DEBUG: Creando nueva página. pageCount antes: ${pageCount}`);
        
        // Agregar footer a la página actual (solo si no es la primera página)
        if (pageCount > 1) {
          addFooter(pageCount);
        }
        
        // Nueva página
        doc.addPage();
        pageCount++;
        console.log(`DEBUG: Nueva página creada. pageCount después: ${pageCount}`);
        currentY = 25;
        
        // Recrear header de tabla en nueva página
        doc.rect(startX, currentY, tableWidth, rowHeight).fill(this.colors.primary);
        doc.fillColor(this.colors.textWhite).fontSize(12).font('Poppins-Bold');
        
        colX = startX + 10;
        headers.forEach((header, index) => {
          doc.text(header, colX, currentY + 6, { 
            width: colWidths[index] - 20,
            align: index === 0 ? 'center' : 'left'
          });
          colX += colWidths[index];
        });
        
        currentY += rowHeight;
      }

      // Generar la orden (altura dinámica real de PDFKit)
      currentY = this.generateOrderRow(doc, detail, i, currentY, startX, colWidths, rowHeight);
      console.log(`DEBUG: Orden ${i + 1} - después de generateOrderRow: ${currentY}`);

      if (includeProductDetails && detail.order.items.length > 0) {
        currentY = this.generateProductDetails(doc, detail, currentY, startX, tableWidth);
        console.log(`DEBUG: Orden ${i + 1} - después de generateProductDetails: ${currentY}`);
      }

      doc.rect(startX, currentY, tableWidth, 1).fill(this.colors.borderColor);
      currentY += 5;
      console.log(`DEBUG: Orden ${i + 1} - currentY final: ${currentY}`);
    }

    // Agregar footer a la última página (marcándola como final) - solo si hay más de una página
    if (pageCount > 1) {
      addFooter(pageCount, true);
    }
    
    console.log(`DEBUG: Generación completada con alturas dinámicas reales. Total páginas: ${pageCount}`);
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
    rowHeight: number
  ): number {
    const isEven = index % 2 === 0;
    const rowBgColor = isEven ? this.colors.bgWhite : this.colors.bgPrimary;
    
    // Preparar los datos de cada columna
    const addressText = detail.order.customer.address && detail.order.customer.locality?.name 
      ? `${detail.order.customer.address} - ${detail.order.customer.locality?.name}`
      : detail.order.customer.address || 'Sin dirección';

    const cellData: Array<{ text: string; fontSize: number; font: string; align: 'center' | 'left' | 'right' }> = [
      { text: detail.order.order_id.toString(), fontSize: 10, font: 'Poppins-Bold', align: 'center' },
      { text: detail.order.customer.name, fontSize: 11, font: 'Poppins-Bold', align: 'left' },
      { text: addressText, fontSize: 10, font: 'Poppins', align: 'left' },
      { text: detail.order.customer.phone, fontSize: 10, font: 'Poppins', align: 'left' },
      { text: detail.delivery_time || 'N/D', fontSize: 10, font: 'Poppins', align: 'center' },
      { text: `$${detail.order.total_amount}`, fontSize: 10, font: 'Poppins-Bold', align: 'right' },
    ];

    // Calcular la altura necesaria para cada celda
    const minRowHeight = 27;
    const padding = 20;
    let maxHeight = minRowHeight;

    cellData.forEach((cell, colIndex) => {
      doc.fontSize(cell.fontSize).font(cell.font);
      const textHeight = doc.heightOfString(cell.text, {
        width: colWidths[colIndex] - padding,
        align: cell.align
      });
      maxHeight = Math.max(maxHeight, textHeight + padding);
    });

    // Dibujar el fondo de la fila con la altura calculada
    doc.rect(startX, currentY, 545, maxHeight).fill(rowBgColor);
    doc.rect(startX, currentY, 4, maxHeight).fill(isEven ? this.colors.primary : this.colors.secondary);

    // Renderizar cada celda con texto multilínea
    let colX = startX + 10;
    
    cellData.forEach((cell, colIndex) => {
      doc.fontSize(cell.fontSize).font(cell.font).fillColor(
        colIndex === 0 || colIndex === 5 ? this.colors.textAccent : this.colors.textPrimary
      );
      
      doc.text(cell.text, colX, currentY + 10, {
        width: colWidths[colIndex] - padding,
        align: cell.align,
        lineGap: 2
      });
      
      colX += colWidths[colIndex];
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
    tableWidth: number
  ): number {
    // Preparar textos
    const aliasText = detail.order.customer.alias ? `${detail.order.customer.alias}` : '';
    const productText = detail.order.items
      .map((item: any) => `${item.quantity}x ${item.product.description}`)
      .join(' | ');
    // Comentarios: usar notes del pedido (nuevo formato)
    const commentsText = detail.order && detail.order.notes ? `${detail.order.notes}` : '';
    
    // Créditos: mostrar como "remaining_balance x product_description" por cada crédito con balance > 0
    const creditsArray: any[] = Array.isArray(detail.credits) ? detail.credits : [];
    const creditsText = creditsArray.length > 0
      ? creditsArray
          .filter((c) => c.remaining_balance > 0)
          .map((c) => `${c.remaining_balance}x ${c.product_description}`)
          .join(' | ')
      : '';

    // Notas del cliente: extraer special_instructions del customer
    let specialInstructionsText = '';
    const rawSpecial = detail.order && detail.order.customer && detail.order.customer.special_instructions;
    if (rawSpecial) {
      if (typeof rawSpecial === 'string') {
        try {
          const parsed = JSON.parse(rawSpecial);
          // Extraer instrucciones específicas si existen
          specialInstructionsText = parsed?.delivery_preferences?.special_instructions || rawSpecial;
        } catch (e) {
          specialInstructionsText = rawSpecial;
        }
      } else if (typeof rawSpecial === 'object') {
        specialInstructionsText = rawSpecial?.delivery_preferences?.special_instructions || JSON.stringify(rawSpecial);
      } else {
        specialInstructionsText = String(rawSpecial);
      }
    }

    // Configuración básica
    const labelGap = 17;
    let textY = currentY + 5;

    // Renderizar directamente el contenido sin rectángulo
    doc.fontSize(12).fillColor(this.colors.textPrimary).font('Poppins-Bold');
    doc.text('PEDIDOS:', startX + 25, textY);
    doc.fontSize(12).fillColor(this.colors.textPrimary).font('Poppins');
    doc.text(productText, startX + 93, textY, { width: tableWidth - 180 });
    textY += labelGap;

    if (aliasText) {
      doc.fontSize(10).fillColor(this.colors.textPrimary).font('Poppins-Bold');
      doc.text('EMPRESA:', startX + 25, textY);
      doc.fontSize(11).fillColor(this.colors.textPrimary).font('Poppins');
      doc.text(aliasText, startX + 85, textY - 1, { width: tableWidth - 120 });
      textY += labelGap;
    }

    if (specialInstructionsText) {
      doc.fontSize(10).fillColor(this.colors.textPrimary).font('Poppins-Bold');
      doc.text('NOTAS CLIENTE:', startX + 25, textY);
      doc.fontSize(11).fillColor(this.colors.textPrimary).font('Poppins');
      doc.text(specialInstructionsText, startX + 115, textY - 1, { width: tableWidth - 150 });
      textY += labelGap;
    }

    if (commentsText) {
      doc.fontSize(10).fillColor(this.colors.textPrimary).font('Poppins-Bold');
      doc.text('COMENTARIOS:', startX + 25, textY);
      doc.fontSize(11).fillColor(this.colors.textPrimary).font('Poppins');
      doc.text(commentsText, startX + 112, textY - 1, { width: tableWidth - 145 });
      textY += labelGap;
    }

    if (creditsText) {
      doc.fontSize(10).fillColor(this.colors.textPrimary).font('Poppins-Bold');
      doc.text('EXTRAS DISPONIBLES:', startX + 25, textY);
      doc.fontSize(11).fillColor(this.colors.textPrimary).font('Poppins');
      doc.text(creditsText, startX + 145, textY - 1, { width: tableWidth - 180 });
      textY += labelGap;
    }

    return textY + 5;
  }

  /**
   * Genera la sección de firmas
   */
  private generateSignatureSection(doc: PDFKit.PDFDocument, currentY: number): void {
    if (currentY > doc.page.height - 200) {
      doc.addPage();
      currentY = 25;
    }

    // Título de confirmación
    doc.rect(25, currentY, 545, 25).fill(this.colors.primary);
    doc.fillColor(this.colors.textWhite).fontSize(12).font('Poppins-Bold');
    doc.text('CONFIRMACIÓN DE ENTREGAS', 25, currentY + 5, {
      align: 'center',
      width: 545,
    });
    currentY += 40;

    const signatureHeight = 80;
    const signatureWidth = 260;

    // Firma del conductor
    doc.rect(25, currentY, signatureWidth, signatureHeight).fill(this.colors.bgWhite).stroke(this.colors.borderColor);
    doc.rect(25, currentY, 4, signatureHeight).fill(this.colors.primary);
    
    doc.fillColor(this.colors.textPrimary).fontSize(12).font('Poppins-Bold');
    doc.text('CONDUCTOR', 45, currentY + 10);
    
    doc.fontSize(10).font('Poppins').fillColor(this.colors.textPrimary);
    doc.text('Nombre: _________________________', 45, currentY + 30);
    doc.text('Fecha: _____ / _____ / _____', 45, currentY + 50);
    doc.text('Hora: _____ : _____', 45, currentY + 65);

    // Firma del supervisor
    const supervisorX = 315;
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
   * Traduce el estado de entrega al español
   */
  private translateStatus(status: string): string {
    const statusMap = {
      'pending': 'PENDIENTE',
      'pendiente': 'PENDIENTE',
      'delivered': 'ENTREGADO',
      'entregado': 'ENTREGADO',
      'retirado': 'RETIRADO',
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
  private buildCollectionRouteSheetFilename(data: CollectionRouteSheetPdfData): string {
    const base = 'cobranza-automatica-hoja-de-ruta';
    const ymd = typeof data.delivery_date === 'string' ? data.delivery_date : formatBAYMD(new Date(data.delivery_date));

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
    }).formatToParts(typeof dateInput === 'string' ? new Date(dateInput) : (dateInput as Date));
    const get = (t: string) => String(parts.find(p => p.type === t)?.value || '').padStart(t === 'day' || t === 'month' ? 2 : 0, '0');
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
    return formatBAYMD(dateInput as Date);
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
    }).formatToParts(typeof dateInput === 'string' ? new Date(dateInput) : (dateInput as Date));
    const get = (t: string) => String(parts.find(p => p.type === t)?.value || '').padStart(t === 'day' || t === 'month' ? 2 : 0, '0');
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

  private safeFormatDateYMDDisplayShort(dateInput: string | Date): string {
    if (!dateInput) return '';
    if (typeof dateInput === 'string') {
      const m = dateInput.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (m) return `${m[3]}/${m[2]}/${m[1].slice(-2)}`;
    }
    const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(-2);
    return `${dd}/${mm}/${yy}`;
  }

  /**
   * Genera el contenido del PDF para hojas de ruta de cobranzas
   */
  private async generateCollectionRouteSheetContent(
    doc: PDFKit.PDFDocument,
    routeSheet: CollectionRouteSheetPdfData,
    options: PdfGenerationOptions,
  ): Promise<void> {
    // Registrar fuentes Poppins
    const fontsPath = join(process.cwd(), 'public', 'fonts');
    doc.registerFont('Poppins', join(fontsPath, 'Poppins-Regular.ttf'));
    doc.registerFont('Poppins-Bold', join(fontsPath, 'Poppins-Bold.ttf'));

    let currentY = 25;

    // Header
    currentY = this.generateCollectionHeader(doc, routeSheet, currentY);
    currentY += 20;

    // Driver and Vehicle Info
    currentY = this.generateDriverVehicleInfo(doc, routeSheet, currentY);

    // Route Notes
    if (routeSheet.route_notes) {
      currentY = this.generateRouteNotes(doc, routeSheet, currentY);
      currentY += 10;
    }

    console.log('PDF_COLLECTION_ROUTE_SHEET_DATA', {
      delivery_date: routeSheet.delivery_date,
      driver: routeSheet.driver,
      vehicle: routeSheet.vehicle,
      route_notes: routeSheet.route_notes,
      collections: routeSheet.collections,
    });
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
  private generateCollectionHeader(doc: PDFKit.PDFDocument, routeSheet: CollectionRouteSheetPdfData, currentY: number): number {
    // Línea superior decorativa
    doc.rect(25, currentY, 545, 3).fill(this.colors.primary);
    currentY += 15;

    // Título principal
    doc.fontSize(15)
       .font('Poppins-Bold')
       .fillColor(this.colors.primary)
       .text('HOJA DE RUTA - COBRANZAS', 25, currentY, { align: 'left' });

    // Información básica - solo fecha
    doc.fontSize(12)
       .font('Poppins')
       .fillColor(this.colors.textPrimary);
    
    const displayDate = this.formatDateForDisplay(routeSheet.delivery_date);
    doc.text(`Fecha: ${displayDate}`, 440, currentY);
    
    currentY += 15;
    
    return currentY;
  }

  /**
   * Genera la tabla de cobranzas
   */
  private generateCollectionsTable(
    doc: PDFKit.PDFDocument, 
    routeSheet: CollectionRouteSheetPdfData, 
    currentY: number
  ): number {
    const startX = 25;
    const tableWidth = 545; // 595 - 25 - 25 = 545px disponibles
    const rowHeight = 25;
    const headerHeight = 25;
    
    // Headers de la tabla
    const headers = ['#', 'Cliente', 'Dirección', 'Teléfono', 'Monto', 'Venc.', 'Estado'];
    // Ajustado para que sumen exactamente 545px: 30+105+130+85+60+70+65 = 545
    const colWidths = [30, 105, 130, 85, 60, 70, 65];
    
    // Header de la tabla
    let headerX = startX;
    doc.rect(startX, currentY, tableWidth, headerHeight)
       .fill(this.colors.primary);
    
    doc.fontSize(12)
       .font('Poppins-Bold')
       .fillColor(this.colors.textWhite);
    
    headers.forEach((header, index) => {
      doc.text(header, headerX + 5, currentY + 4, { 
        width: colWidths[index] - 10, 
        align: 'center' 
      });
      headerX += colWidths[index];
    });
    
    currentY += headerHeight;
    
    // Filas de datos
    routeSheet.collections.forEach((collection, index) => {
      // Verificar si necesitamos nueva página respetando margen inferior de 25px
      if (currentY > 817) { // 842 (altura A4) - 25 (margen inferior) = 817
        doc.addPage();
        currentY = 25; // Margen superior
      }
      
      currentY = this.generateCollectionRow(
        doc, 
        collection, 
        index + 1, 
        currentY, 
        startX, 
        colWidths, 
        rowHeight
      );
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
    
    // Preparar los datos de dirección con localidad
    const addressText = [collection.customer.address, collection.customer.locality?.name]
      .map(v => (v || '').trim())
      .filter(Boolean)
      .join(' - ') || '-';
    
    // Preparar datos de cada columna
    const cellData: Array<{ text: string; align: 'center' | 'left' | 'right' }> = [
      { text: collection.customer.customer_id.toString(), align: 'center' },
      { text: collection.customer.name, align: 'left' },
      { text: addressText, align: 'left' },
      { text: collection.customer.phone || '-', align: 'center' },
      { text: `$${collection.amount.toFixed(2)}`, align: 'center' },
      { text: this.safeFormatDateYMDDisplay(collection.payment_due_date), align: 'center' },
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
      maxHeight = Math.max(maxHeight, textHeight + padding + 6);
    });

    const tableWidth = colWidths.reduce((a, b) => a + b, 0);

    // Dibujar fondo de la fila con altura calculada
    doc.rect(startX, currentY, tableWidth, maxHeight).fill(fillColor);
    
    // Renderizar cada celda con texto multilínea
    let cellX = startX;
    doc.fontSize(10).font('Poppins').fillColor(this.colors.textPrimary);
    
    cellData.forEach((cell, colIndex) => {
      doc.text(cell.text, cellX + 5, currentY + 8, {
        width: colWidths[colIndex] - padding,
        align: cell.align,
        lineGap: 2
      });
      cellX += colWidths[colIndex];
    });
    
    let notesHeight = 0;
    const buildNotesText = (): string => {
      const parts: string[] = [];
      const raw = collection.subscription_notes || collection.payment_notes || collection.comments || '';
      if (raw) {
        if (typeof raw === 'string') {
          try {
            const parsed = JSON.parse(raw);
            const dp = parsed?.delivery_preferences || {};
            const si = dp?.special_instructions;
            const tr = dp?.preferred_time_range;
            const segs: string[] = [];
            if (si) segs.push(si.charAt(0).toUpperCase() + si.slice(1));
            if (tr) segs.push(`Horario: ${String(tr).replace(/\s*/g,'').replace('-', ' - ')}`);
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
            if (tr) segs.push(`Horario: ${String(tr).replace(/\s*/g,'').replace('-', ' - ')}`);
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
            const dp = (raw as any)?.delivery_preferences || {};
            const si = dp?.special_instructions;
            const tr = dp?.preferred_time_range;
            const segs: string[] = [];
            if (si) segs.push(si.charAt(0).toUpperCase() + si.slice(1));
            if (tr) segs.push(`Horario: ${String(tr).replace(/\s*/g,'').replace('-', ' - ')}`);
            if (segs.length > 0) parts.push(segs.join(' - '));
          } catch {
            const simplified = String(raw);
            if (simplified) parts.push(simplified);
          }
        }
      }
      const firstCredit = Array.isArray(collection.credits) && collection.credits.length > 0 ? collection.credits[0] : undefined;
      if (firstCredit) {
        const plan = Number(firstCredit.planned_quantity ?? 0);
        const delivered = Number(firstCredit.delivered_quantity ?? 0);
        const remaining = Number(firstCredit.remaining_balance ?? Math.max(plan - delivered, 0));
        parts.push(`Abono: ${firstCredit.product_description} - Plan: ${plan} - Entregado: ${delivered} - Saldo: ${remaining}`);
      }
      if (collection.subscription_plan) {
        parts.unshift(`Abono: ${collection.subscription_plan}`);
      }
      return parts.join(' | ').trim();
    };
    const finalNotes = buildNotesText();
    console.log('PDF_COLLECTION_ROW', {
      index,
      customer: {
        id: collection.customer.customer_id,
        name: collection.customer.name,
        address: collection.customer.address,
        locality: collection.customer.locality?.name,
        phone: collection.customer.phone,
      },
      amount: collection.amount,
      payment_due_date_raw: collection.payment_due_date,
      payment_due_date_display: this.safeFormatDateYMDDisplay(collection.payment_due_date),
      status: collection.delivery_status,
      notes: finalNotes,
    });
    if (finalNotes) {
      const notesY = currentY + maxHeight + 5;
      const notesTextHeight = doc.heightOfString(finalNotes, {
        width: colWidths.reduce((a, b) => a + b, 0) - 60,
      });
      notesHeight = notesTextHeight + 10;
      doc.rect(startX, currentY + maxHeight, colWidths.reduce((a, b) => a + b, 0), notesHeight)
         .fill(this.colors.warningColor)
         .stroke(this.colors.borderColor);
      doc.fontSize(9).font('Poppins-Bold').fillColor(this.colors.textPrimary);
      doc.text('Notas: ', startX + 5, notesY);
      doc.fontSize(9).font('Poppins').fillColor(this.colors.textPrimary);
      doc.text(finalNotes, startX + 50, notesY, {
        width: colWidths.reduce((a, b) => a + b, 0) - 60,
        align: 'left',
        lineGap: 1
      });
    }
    
    // Bordes verticales - dibujados al final para no cortar las notas
    doc.strokeColor(this.colors.borderColor).lineWidth(0.5);
    
    let borderX = startX;
    colWidths.forEach(width => {
      doc.moveTo(borderX, currentY)
         .lineTo(borderX, currentY + maxHeight)
         .stroke();
      borderX += width;
    });
    
    // Borde inferior
    doc.moveTo(startX, currentY + maxHeight + notesHeight)
       .lineTo(startX + tableWidth, currentY + maxHeight + notesHeight)
       .stroke();
    
    return currentY + maxHeight + notesHeight;
  }

  /**
   * Genera el footer específico para hojas de ruta de cobranzas
   */
  private generateCollectionFooter(doc: PDFKit.PDFDocument, routeSheet: CollectionRouteSheetPdfData): void {
    const pageHeight = doc.page.height;
    const footerY = pageHeight - 80;
    
    // Línea separadora
    doc.strokeColor(this.colors.borderColor)
       .lineWidth(1)
       .moveTo(25, footerY)
       .lineTo(570, footerY)
       .stroke();
    
    // Información del footer
    doc.fontSize(8)
       .fillColor(this.colors.textPrimary)
       .text(`Hoja de Ruta de Cobranzas #${routeSheet.route_sheet_id}`, 25, footerY + 10)
       .text(`Generado el: ${formatBATimestampISO(new Date())}`, 25, footerY + 25)
       .text(`Total de cobranzas: ${routeSheet.collections.length}`, 350, footerY + 10)
       .text(`Conductor: ${routeSheet.driver.name}`, 350, footerY + 25);
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
