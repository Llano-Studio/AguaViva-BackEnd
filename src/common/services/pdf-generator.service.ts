import { Injectable } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';
import * as fs from 'fs-extra';
import { join } from 'path';

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
      includeMap = false,
      includeSignatureField = true,
      includeProductDetails = true,
      customColors = {},
    } = options;

    // 🎨 Configuración de colores de la aplicación
    const primaryColor = customColors.primary || '#403A92'; // --acent-color-1
    const secondaryColor = customColors.secondary || '#7167FF'; // --acent-color-2
    const bgPrimary = '#F5F6FA'; // --bg-color-1
    const bgSecondary = '#DDDDDD'; // --bg-color-2
    const bgWhite = '#FFFFFF'; // --bg-color-3
    const textPrimary = '#0C1421'; // --text-color-1
    const textWhite = '#FFFFFF'; // --text-color-2
    const textAccent = '#403A92'; // --text-color-3
    const borderColor = '#D4D7E3'; // Borders
    const successColor = '#93FFD1'; // Verde claro
    const errorColor = '#FF9999'; // Rojo claro
    const warningColor = '#FFF799'; // Amarillo claro

    // 📄 Header minimalista y profesional
    let currentY = 50;
    
    // Línea superior decorativa
    doc.rect(50, currentY, 520, 3).fill(primaryColor);
    currentY += 15;
    
    // Título principal
    doc.fontSize(28).font('Helvetica-Bold').fillColor(textPrimary);
    doc.text('HOJA DE RUTA', 50, currentY);
    
    // ID de la hoja de ruta
    doc.fontSize(16).font('Helvetica').fillColor(textAccent);
    doc.text(`Número: ${routeSheet.route_sheet_id}`, 50, currentY + 35);
    
    // Fecha de entrega
    doc.fontSize(14).font('Helvetica').fillColor(textPrimary);
    doc.text(`Fecha: ${routeSheet.delivery_date}`, 50, currentY + 55);
    
    currentY += 85;

    // 👤 Información del conductor - Diseño limpio
    doc.rect(50, currentY, 250, 60).fill(bgPrimary).stroke(borderColor);
    doc.rect(50, currentY, 4, 60).fill(primaryColor);
    
    doc.fontSize(14).font('Helvetica-Bold').fillColor(textPrimary);
    doc.text('CONDUCTOR', 70, currentY + 10);
    
    doc.fontSize(12).font('Helvetica').fillColor(textPrimary);
    doc.text(`Nombre: ${routeSheet.driver.name}`, 70, currentY + 30);
    doc.text(`Email: ${routeSheet.driver.email}`, 70, currentY + 45);

    // 🚛 Información del vehículo - Diseño limpio
    const vehicleX = 320;
    doc.rect(vehicleX, currentY, 250, 60).fill(bgPrimary).stroke(borderColor);
    doc.rect(vehicleX, currentY, 4, 60).fill(secondaryColor);
    
    doc.fontSize(14).font('Helvetica-Bold').fillColor(textPrimary);
    doc.text('VEHÍCULO', vehicleX + 20, currentY + 10);
    
    doc.fontSize(12).font('Helvetica').fillColor(textPrimary);
    doc.text(`Código: ${routeSheet.vehicle.code}`, vehicleX + 20, currentY + 30);
    doc.text(`Descripción: ${routeSheet.vehicle.name}`, vehicleX + 20, currentY + 45);

    currentY += 80;

    // 📝 Notas de ruta - Solo si existen
    if (routeSheet.route_notes) {
      doc.rect(50, currentY, 520, 50).fill(warningColor).stroke(borderColor);
      doc.rect(50, currentY, 4, 50).fill('#FEF3C7');
      
      doc.fontSize(14).font('Helvetica-Bold').fillColor(textPrimary);
      doc.text('INSTRUCCIONES ESPECIALES', 70, currentY + 10);
      
      doc.fontSize(12).font('Helvetica').fillColor(textPrimary);
      doc.text(routeSheet.route_notes, 70, currentY + 30, { width: 480 });
      currentY += 70;
    } else {
      // Instrucciones básicas por defecto
      doc.rect(50, currentY, 520, 40).fill(bgPrimary).stroke(borderColor);
      doc.rect(50, currentY, 4, 40).fill(primaryColor);
      
      doc.fontSize(14).font('Helvetica-Bold').fillColor(textPrimary);
      doc.text('RUTA SUGERIDA', 70, currentY + 10);
      
      doc.fontSize(12).font('Helvetica').fillColor(textPrimary);
      doc.text('Salir por Sarmiento - Ruta zona Centro', 70, currentY + 28);
      currentY += 60;
    }

    // 📦 Título de pedidos
    doc.rect(50, currentY, 520, 35).fill(primaryColor);
    doc.fontSize(18).font('Helvetica-Bold').fillColor(textWhite);
    doc.text('PEDIDOS A ENTREGAR', 50, currentY + 10, {
      align: 'center',
      width: 520,
    });
    currentY += 45;

    // 📊 Tabla de pedidos simplificada y clara
    const startX = 50;
    const tableWidth = 520;
    const colWidths = [50, 180, 200, 90]; // Anchos simplificados: #, Cliente, Dirección, Estado
    const headers = ['#', 'CLIENTE', 'DIRECCIÓN', 'ESTADO'];
    const rowHeight = 35;

    // Encabezado de tabla limpio
    doc.rect(startX, currentY, tableWidth, rowHeight).fill(primaryColor);
    doc.fillColor(textWhite).fontSize(12).font('Helvetica-Bold');
    
    let colX = startX + 10;
    headers.forEach((header, index) => {
      doc.text(header, colX, currentY + 12, { 
        width: colWidths[index] - 20,
        align: index === 0 ? 'center' : 'left'
      });
      colX += colWidths[index];
    });

    currentY += rowHeight;

    // 📋 Filas de pedidos - Diseño simple y claro
    for (let i = 0; i < routeSheet.details.length; i++) {
      const detail = routeSheet.details[i];

      // Verificar si necesitamos nueva página
      if (currentY > doc.page.height - 200) {
        doc.addPage();
        currentY = 50;
      }

      // Fondo alternado para mejor legibilidad
      const isEven = i % 2 === 0;
      const rowBgColor = isEven ? bgWhite : bgPrimary;
      doc.rect(startX, currentY, tableWidth, rowHeight).fill(rowBgColor);
      
      // Borde izquierdo para identificar cada pedido
      doc.rect(startX, currentY, 4, rowHeight).fill(isEven ? primaryColor : secondaryColor);

      // Datos del pedido
      doc.fontSize(11).font('Helvetica').fillColor(textPrimary);
      colX = startX + 10;
      
      // Número de orden (grande y centrado)
      doc.fontSize(14).font('Helvetica-Bold').fillColor(textAccent);
      doc.text(detail.order.order_id.toString(), colX, currentY + 10, {
        width: colWidths[0] - 20,
        align: 'center'
      });
      colX += colWidths[0];
      
      // Nombre del cliente (destacado)
      doc.fontSize(12).font('Helvetica-Bold').fillColor(textPrimary);
      doc.text(detail.order.customer.name, colX, currentY + 8, {
        width: colWidths[1] - 20,
      });
      
      // Teléfono del cliente (pequeño)
      doc.fontSize(10).font('Helvetica').fillColor(textPrimary);
      doc.text(`Tel: ${detail.order.customer.phone}`, colX, currentY + 22, {
        width: colWidths[1] - 20,
      });
      colX += colWidths[1];
      
      // Dirección (multilinea si es necesario)
      doc.fontSize(10).font('Helvetica').fillColor(textPrimary);
      doc.text(detail.order.customer.address, colX, currentY + 8, {
        width: colWidths[2] - 20,
        align: 'left'
      });
      colX += colWidths[2];

      // Estado con diseño claro
      const statusColor = this.getStatusColor(detail.delivery_status);
      const translatedStatus = this.translateStatus(detail.delivery_status);
      
      // Badge de estado más grande y claro
      doc.rect(colX + 5, currentY + 8, colWidths[3] - 15, 20).fill(statusColor);
      doc.fillColor(textWhite).fontSize(10).font('Helvetica-Bold');
      doc.text(translatedStatus, colX + 8, currentY + 14, {
        width: colWidths[3] - 21,
        align: 'center'
      });

      currentY += rowHeight;

      // 📦 Productos (si están habilitados) - Diseño compacto
      if (includeProductDetails && detail.order.items.length > 0) {
        // Fondo para productos
        doc.rect(startX + 15, currentY, tableWidth - 30, 25).fill('#F7FBFF').stroke(borderColor);
        
        doc.fontSize(10).fillColor(textAccent).font('Helvetica-Bold');
        doc.text('PRODUCTOS:', startX + 25, currentY + 8);
        
        // Lista de productos en una línea
        const productList = detail.order.items
          .map(item => `${item.quantity}x ${item.product.description}`)
          .join(' | ');
        
        doc.fontSize(9).fillColor(textPrimary).font('Helvetica');
        doc.text(productList, startX + 25, currentY + 18, { width: tableWidth - 50 });
        
        currentY += 35;
      }

      // Línea separadora sutil entre pedidos
      doc.rect(startX, currentY, tableWidth, 1).fill(borderColor);
      currentY += 5;
    }

    // ✍️ Sección de confirmación - Diseño simple y claro
    if (includeSignatureField) {
      if (currentY > doc.page.height - 200) {
        doc.addPage();
        currentY = 50;
      }

      // Título de confirmación
      doc.rect(50, currentY, 520, 30).fill(primaryColor);
      doc.fillColor(textWhite).fontSize(16).font('Helvetica-Bold');
      doc.text('CONFIRMACIÓN DE ENTREGAS', 50, currentY + 8, {
        align: 'center',
        width: 520,
      });
      currentY += 50;

      // Campos de firma simplificados
      const signatureHeight = 80;
      const signatureWidth = 250;

      // Firma del conductor
      doc.rect(50, currentY, signatureWidth, signatureHeight).fill(bgWhite).stroke(borderColor);
      doc.rect(50, currentY, 4, signatureHeight).fill(primaryColor);
      
      doc.fillColor(textPrimary).fontSize(12).font('Helvetica-Bold');
      doc.text('CONDUCTOR', 70, currentY + 10);
      
      doc.fontSize(10).font('Helvetica').fillColor(textPrimary);
      doc.text('Nombre: _________________________', 70, currentY + 30);
      doc.text('Fecha: _____ / _____ / _____', 70, currentY + 50);
      doc.text('Hora: _____ : _____', 70, currentY + 65);

      // Firma del supervisor
      const supervisorX = 320;
      doc.rect(supervisorX, currentY, signatureWidth, signatureHeight).fill(bgWhite).stroke(borderColor);
      doc.rect(supervisorX, currentY, 4, signatureHeight).fill(secondaryColor);
      
      doc.fillColor(textPrimary).fontSize(12).font('Helvetica-Bold');
      doc.text('SUPERVISOR', supervisorX + 20, currentY + 10);
      
      doc.fontSize(10).font('Helvetica').fillColor(textPrimary);
      doc.text('Nombre: _________________________', supervisorX + 20, currentY + 30);
      doc.text('Fecha: _____ / _____ / _____', supervisorX + 20, currentY + 50);
      doc.text('Hora: _____ : _____', supervisorX + 20, currentY + 65);
      
      currentY += signatureHeight + 20;
    }

    // 📄 Pie de página minimalista
    const footerY = doc.page.height - 40;
    
    // Línea superior
    doc.rect(50, footerY - 5, 520, 1).fill(borderColor);
    
    // Información básica
    doc.fillColor(textPrimary).fontSize(9).font('Helvetica');
    doc.text(`Documento generado: ${new Date().toLocaleString('es-ES')}`, 50, footerY);
    doc.text(`Total pedidos: ${routeSheet.details.length}`, 50, footerY + 12);
    
    // Empresa
    doc.text('Agua Viva Rica - Sistema de Gestión', doc.page.width - 200, footerY, { align: 'right', width: 150 });
  }

  /**
   * Traduce el estado de entrega al español - Textos simples y claros
   */
  private translateStatus(status: string): string {
    switch (status.toLowerCase()) {
      case 'pending':
      case 'pendiente':
        return 'PENDIENTE';
      case 'delivered':
      case 'entregado':
        return 'ENTREGADO';
      case 'cancelled':
      case 'cancelado':
        return 'CANCELADO';
      case 'in_route':
      case 'en_ruta':
        return 'EN RUTA';
      case 'overdue':
      case 'atrasado':
        return 'ATRASADO';
      default:
        return 'PENDIENTE'; // Por defecto siempre pendiente
    }
  }

  /**
   * Obtiene el color correspondiente al estado usando la paleta de la aplicación
   */
  private getStatusColor(status: string): string {
    switch (status.toLowerCase()) {
      case 'entregado':
      case 'delivered':
        return '#93FFD1'; // Success - Verde claro
      case 'pendiente':
      case 'pending':
        return '#FFF799'; // Warning - Amarillo claro
      case 'cancelado':
      case 'cancelled':
        return '#FF9999'; // Error - Rojo claro
      case 'en_ruta':
      case 'in_route':
        return '#93e6ff'; // Info - Azul claro
      case 'atrasado':
      case 'overdue':
        return '#B20000'; // Danger - Rojo oscuro
      default:
        return '#FFF799'; // Por defecto amarillo (pendiente)
    }
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
        // Use relative path instead of hardcoded localhost URL to avoid CORS issues
        const url = `/public/pdfs/${filename}`;
        resolve({ url, filename });
      });
      writeStream.on('error', reject);
    });
  }
}
