import { Injectable } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';
import * as fs from 'fs-extra';
import { join } from 'path';
import { TempFileManagerService, TempFileInfo } from './temp-file-manager.service';
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
    name: string;
    email: string;
  };
  vehicle: {
    code: string;
    name: string;
  };
  route_notes?: string;
  details: Array<{
    order: {
      order_id: number;
      customer: {
        name: string;
        address: string;
        phone: string;
      };
      items: Array<{
        quantity: number;
        product: {
          description: string;
        };
      }>;
    };
    delivery_status: string;
  }>;
}

@Injectable()
export class PdfGeneratorService {
  // Configuración de colores de la aplicación
  private readonly colors = {
    primary: '#403A92',
    secondary: '#7167FF',
    bgPrimary: '#F5F6FA',
    bgSecondary: '#DDDDDD',
    bgWhite: '#FFFFFF',
    textPrimary: '#0C1421',
    textWhite: '#FFFFFF',
    textAccent: '#403A92',
    borderColor: '#D4D7E3',
    successColor: '#93FFD1',
    errorColor: '#FF9999',
    warningColor: '#FFF799',
  };

  constructor(private readonly tempFileManager: TempFileManagerService) {}

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

      const doc = new PDFDocument({ margin: 50 });
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
    doc.text(`Fecha de generación: ${new Date().toLocaleDateString('es-ES')}`);
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
        doc.text(`   Fecha venc.: ${collection.due_date || 'N/A'}`);
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
    const filename = `route_sheet_${data.route_sheet_id}_${new Date().toISOString().split('T')[0]}.pdf`;
    const pdfDir = join(process.cwd(), 'public', 'pdfs');
    await fs.ensureDir(pdfDir);
    const pdfPath = join(pdfDir, filename);

    const doc = new PDFDocument({
      margin: 50,
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

    let currentY = 50;
    
    // Header
    currentY = this.generateHeader(doc, routeSheet, currentY);
    
    // Información del conductor y vehículo
    currentY = this.generateDriverVehicleInfo(doc, routeSheet, currentY);
    
    // Notas de ruta
    currentY = this.generateRouteNotes(doc, routeSheet, currentY);
    
    // Tabla de pedidos
    currentY = this.generateOrdersTable(doc, routeSheet, currentY, includeProductDetails);
    
    // Sección de confirmación
    if (includeSignatureField) {
      this.generateSignatureSection(doc, currentY);
    }

    // Pie de página
    this.generateFooter(doc, routeSheet);
  }

  /**
   * Genera el header del PDF
   */
  private generateHeader(doc: PDFKit.PDFDocument, routeSheet: RouteSheetPdfData, currentY: number): number {
    // Línea superior decorativa
    doc.rect(50, currentY, 520, 3).fill(this.colors.primary);
    currentY += 15;
    
    // Título principal
    doc.fontSize(28).font('Helvetica-Bold').fillColor(this.colors.textPrimary);
    doc.text('HOJA DE RUTA', 50, currentY);
    
    // ID de la hoja de ruta
    doc.fontSize(16).font('Helvetica').fillColor(this.colors.textAccent);
    doc.text(`Número: ${routeSheet.route_sheet_id}`, 50, currentY + 35);
    
    // Fecha de entrega
    doc.fontSize(14).font('Helvetica').fillColor(this.colors.textPrimary);
    doc.text(`Fecha: ${routeSheet.delivery_date}`, 50, currentY + 55);
    
    return currentY + 85;
  }

  /**
   * Genera la información del conductor y vehículo
   */
  private generateDriverVehicleInfo(doc: PDFKit.PDFDocument, routeSheet: RouteSheetPdfData, currentY: number): number {
    // Información del conductor
    doc.rect(50, currentY, 250, 60).fill(this.colors.bgPrimary).stroke(this.colors.borderColor);
    doc.rect(50, currentY, 4, 60).fill(this.colors.primary);
    
    doc.fontSize(14).font('Helvetica-Bold').fillColor(this.colors.textPrimary);
    doc.text('CONDUCTOR', 70, currentY + 10);
    
    doc.fontSize(12).font('Helvetica').fillColor(this.colors.textPrimary);
    doc.text(`Nombre: ${routeSheet.driver.name}`, 70, currentY + 30);
    doc.text(`Email: ${routeSheet.driver.email}`, 70, currentY + 45);

    // Información del vehículo
    const vehicleX = 320;
    doc.rect(vehicleX, currentY, 250, 60).fill(this.colors.bgPrimary).stroke(this.colors.borderColor);
    doc.rect(vehicleX, currentY, 4, 60).fill(this.colors.secondary);
    
    doc.fontSize(14).font('Helvetica-Bold').fillColor(this.colors.textPrimary);
    doc.text('VEHÍCULO', vehicleX + 20, currentY + 10);
    
    doc.fontSize(12).font('Helvetica').fillColor(this.colors.textPrimary);
    doc.text(`Código: ${routeSheet.vehicle.code}`, vehicleX + 20, currentY + 30);
    doc.text(`Descripción: ${routeSheet.vehicle.name}`, vehicleX + 20, currentY + 45);

    return currentY + 80;
  }

  /**
   * Genera las notas de ruta
   */
  private generateRouteNotes(doc: PDFKit.PDFDocument, routeSheet: RouteSheetPdfData, currentY: number): number {
    if (routeSheet.route_notes) {
      doc.rect(50, currentY, 520, 50).fill(this.colors.warningColor).stroke(this.colors.borderColor);
      doc.rect(50, currentY, 4, 50).fill('#FEF3C7');
      
      doc.fontSize(14).font('Helvetica-Bold').fillColor(this.colors.textPrimary);
      doc.text('INSTRUCCIONES ESPECIALES', 70, currentY + 10);
      
      doc.fontSize(12).font('Helvetica').fillColor(this.colors.textPrimary);
      doc.text(routeSheet.route_notes, 70, currentY + 30, { width: 480 });
      return currentY + 70;
    } else {
      doc.rect(50, currentY, 520, 40).fill(this.colors.bgPrimary).stroke(this.colors.borderColor);
      doc.rect(50, currentY, 4, 40).fill(this.colors.primary);
      
      doc.fontSize(14).font('Helvetica-Bold').fillColor(this.colors.textPrimary);
      doc.text('RUTA SUGERIDA', 70, currentY + 10);
      
      doc.fontSize(12).font('Helvetica').fillColor(this.colors.textPrimary);
      doc.text('Salir por Sarmiento - Ruta zona Centro', 70, currentY + 28);
      return currentY + 60;
    }
  }

  /**
   * Genera la tabla de pedidos
   */
  private generateOrdersTable(
    doc: PDFKit.PDFDocument, 
    routeSheet: RouteSheetPdfData, 
    currentY: number, 
    includeProductDetails: boolean
  ): number {
    // Título de pedidos
    doc.rect(50, currentY, 520, 35).fill(this.colors.primary);
    doc.fontSize(18).font('Helvetica-Bold').fillColor(this.colors.textWhite);
    doc.text('PEDIDOS A ENTREGAR', 50, currentY + 10, {
      align: 'center',
      width: 520,
    });
    currentY += 45;

    // Configuración de tabla
    const startX = 50;
    const tableWidth = 520;
    const colWidths = [50, 180, 200, 90];
    const headers = ['#', 'CLIENTE', 'DIRECCIÓN', 'ESTADO'];
    const rowHeight = 35;

    // Encabezado de tabla
    doc.rect(startX, currentY, tableWidth, rowHeight).fill(this.colors.primary);
    doc.fillColor(this.colors.textWhite).fontSize(12).font('Helvetica-Bold');
    
    let colX = startX + 10;
    headers.forEach((header, index) => {
      doc.text(header, colX, currentY + 12, { 
        width: colWidths[index] - 20,
        align: index === 0 ? 'center' : 'left'
      });
      colX += colWidths[index];
    });

    currentY += rowHeight;

    // Filas de pedidos
    for (let i = 0; i < routeSheet.details.length; i++) {
      const detail = routeSheet.details[i];

      if (currentY > doc.page.height - 200) {
        doc.addPage();
        currentY = 50;
      }

      currentY = this.generateOrderRow(doc, detail, i, currentY, startX, colWidths, rowHeight);

      if (includeProductDetails && detail.order.items.length > 0) {
        currentY = this.generateProductDetails(doc, detail, currentY, startX, tableWidth);
      }

      doc.rect(startX, currentY, tableWidth, 1).fill(this.colors.borderColor);
      currentY += 5;
    }

    return currentY;
  }

  /**
   * Genera una fila de pedido
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
    doc.rect(startX, currentY, 520, rowHeight).fill(rowBgColor);
    
    doc.rect(startX, currentY, 4, rowHeight).fill(isEven ? this.colors.primary : this.colors.secondary);

    let colX = startX + 10;
    
    // Número de orden
    doc.fontSize(14).font('Helvetica-Bold').fillColor(this.colors.textAccent);
    doc.text(detail.order.order_id.toString(), colX, currentY + 10, {
      width: colWidths[0] - 20,
      align: 'center'
    });
    colX += colWidths[0];
    
    // Nombre del cliente
    doc.fontSize(12).font('Helvetica-Bold').fillColor(this.colors.textPrimary);
    doc.text(detail.order.customer.name, colX, currentY + 8, {
      width: colWidths[1] - 20,
    });
    
    // Teléfono del cliente
    doc.fontSize(10).font('Helvetica').fillColor(this.colors.textPrimary);
    doc.text(`Tel: ${detail.order.customer.phone}`, colX, currentY + 22, {
      width: colWidths[1] - 20,
    });
    colX += colWidths[1];
    
    // Dirección
    doc.fontSize(10).font('Helvetica').fillColor(this.colors.textPrimary);
    doc.text(detail.order.customer.address, colX, currentY + 8, {
      width: colWidths[2] - 20,
      align: 'left'
    });
    colX += colWidths[2];

    // Estado
    const statusColor = this.getStatusColor(detail.delivery_status);
    const translatedStatus = this.translateStatus(detail.delivery_status);
    
    doc.rect(colX + 5, currentY + 8, colWidths[3] - 15, 20).fill(statusColor);
    doc.fillColor(this.colors.textWhite).fontSize(10).font('Helvetica-Bold');
    doc.text(translatedStatus, colX + 8, currentY + 14, {
      width: colWidths[3] - 21,
      align: 'center'
    });

    return currentY + rowHeight;
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
    doc.rect(startX + 15, currentY, tableWidth - 30, 25).fill('#F7FBFF').stroke(this.colors.borderColor);
    
    doc.fontSize(10).fillColor(this.colors.textAccent).font('Helvetica-Bold');
    doc.text('PRODUCTOS:', startX + 25, currentY + 8);
    
    const productList = detail.order.items
      .map(item => `${item.quantity}x ${item.product.description}`)
      .join(' | ');
    
    doc.fontSize(9).fillColor(this.colors.textPrimary).font('Helvetica');
    doc.text(productList, startX + 25, currentY + 18, { width: tableWidth - 50 });
    
    return currentY + 35;
  }

  /**
   * Genera la sección de firmas
   */
  private generateSignatureSection(doc: PDFKit.PDFDocument, currentY: number): void {
    if (currentY > doc.page.height - 200) {
      doc.addPage();
      currentY = 50;
    }

    // Título de confirmación
    doc.rect(50, currentY, 520, 30).fill(this.colors.primary);
    doc.fillColor(this.colors.textWhite).fontSize(16).font('Helvetica-Bold');
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
    
    doc.fillColor(this.colors.textPrimary).fontSize(12).font('Helvetica-Bold');
    doc.text('CONDUCTOR', 70, currentY + 10);
    
    doc.fontSize(10).font('Helvetica').fillColor(this.colors.textPrimary);
    doc.text('Nombre: _________________________', 70, currentY + 30);
    doc.text('Fecha: _____ / _____ / _____', 70, currentY + 50);
    doc.text('Hora: _____ : _____', 70, currentY + 65);

    // Firma del supervisor
    const supervisorX = 320;
    doc.rect(supervisorX, currentY, signatureWidth, signatureHeight).fill(this.colors.bgWhite).stroke(this.colors.borderColor);
    doc.rect(supervisorX, currentY, 4, signatureHeight).fill(this.colors.secondary);
    
    doc.fillColor(this.colors.textPrimary).fontSize(12).font('Helvetica-Bold');
    doc.text('SUPERVISOR', supervisorX + 20, currentY + 10);
    
    doc.fontSize(10).font('Helvetica').fillColor(this.colors.textPrimary);
    doc.text('Nombre: _________________________', supervisorX + 20, currentY + 30);
    doc.text('Fecha: _____ / _____ / _____', supervisorX + 20, currentY + 50);
    doc.text('Hora: _____ : _____', supervisorX + 20, currentY + 65);
  }

  /**
   * Genera el pie de página
   */
  private generateFooter(doc: PDFKit.PDFDocument, routeSheet: RouteSheetPdfData): void {
    const footerY = doc.page.height - 40;
    
    doc.rect(50, footerY - 5, 520, 1).fill(this.colors.borderColor);
    
    doc.fillColor(this.colors.textPrimary).fontSize(9).font('Helvetica');
    doc.text(`Documento generado: ${new Date().toLocaleString('es-ES')}`, 50, footerY);
    doc.text(`Total pedidos: ${routeSheet.details.length}`, 50, footerY + 12);
    
    doc.text('Agua Viva Rica - Sistema de Gestión', doc.page.width - 200, footerY, { align: 'right', width: 150 });
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
   * Obtiene el color correspondiente al estado
   */
  private getStatusColor(status: string): string {
    const colorMap = {
      'entregado': this.colors.successColor,
      'delivered': this.colors.successColor,
      'pendiente': this.colors.warningColor,
      'pending': this.colors.warningColor,
      'cancelado': this.colors.errorColor,
      'cancelled': this.colors.errorColor,
      'en_ruta': '#93e6ff',
      'in_route': '#93e6ff',
      'atrasado': '#B20000',
      'overdue': '#B20000',
    };
    
    return colorMap[status.toLowerCase()] || this.colors.warningColor;
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
