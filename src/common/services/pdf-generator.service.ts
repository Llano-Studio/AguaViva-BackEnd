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
    options: PdfGenerationOptions = {}
  ): Promise<{ doc: PDFKit.PDFDocument; filename: string; pdfPath: string }> {
    
    const filename = `route_sheet_${data.route_sheet_id}_${new Date().toISOString().split('T')[0]}.pdf`;
    const pdfDir = join(process.cwd(), 'public', 'pdfs');
    await fs.ensureDir(pdfDir);
    const pdfPath = join(pdfDir, filename);
    
    const doc = new PDFDocument({ 
      margin: 50, 
      size: 'A4',
      autoFirstPage: true
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
    options: PdfGenerationOptions
  ): Promise<void> {
    
    const {
      includeMap = false,
      includeSignatureField = true,
      includeProductDetails = true,
      customColors = {}
    } = options;

    // Configuración de colores
    const primaryColor = customColors.primary || '#2563eb';
    const secondaryColor = customColors.secondary || '#64748b';
    const accentColor = customColors.accent || '#f59e0b';
    const lightGray = customColors.lightGray || '#f1f5f9';
    
    // Encabezado principal con diseño moderno
    doc.rect(0, 0, doc.page.width, 80).fill(primaryColor);
    doc.fontSize(28).fillColor('white').text('HOJA DE RUTA', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(12).text(`#${routeSheet.route_sheet_id}`, { align: 'center' });
    
    // Información de fecha y estado
    doc.fillColor(secondaryColor).fontSize(10);
    doc.text(`Fecha: ${routeSheet.delivery_date}`, { align: 'right' });
    doc.moveDown(0.5);
    doc.text(`Estado: Pendiente`, { align: 'right' });
    
    // Sección de información del conductor y vehículo
    let currentY = 100;
    
    // Tarjeta del conductor
    doc.rect(50, currentY, 250, 80).fill(lightGray);
    doc.fillColor(primaryColor).fontSize(14).font('Helvetica-Bold');
    doc.text('👤 CONDUCTOR', 70, currentY + 10);
    doc.fillColor('black').fontSize(11).font('Helvetica');
    doc.text(`Nombre: ${routeSheet.driver.name}`, 70, currentY + 30);
    doc.text(`Email: ${routeSheet.driver.email}`, 70, currentY + 45);
    doc.text(`Teléfono: N/A`, 70, currentY + 60);
    
    // Tarjeta del vehículo
    doc.rect(320, currentY, 250, 80).fill(lightGray);
    doc.fillColor(primaryColor).fontSize(14).font('Helvetica-Bold');
    doc.text('🚚 VEHÍCULO', 340, currentY + 10);
    doc.fillColor('black').fontSize(11).font('Helvetica');
    doc.text(`Código: ${routeSheet.vehicle.code}`, 340, currentY + 30);
    doc.text(`Descripción: ${routeSheet.vehicle.name}`, 340, currentY + 45);
    doc.text(`Placa: N/A`, 340, currentY + 60);
    
    currentY += 100;
    
    // Notas de ruta (si existen)
    if (routeSheet.route_notes) {
      doc.rect(50, currentY, 520, 40).fill(accentColor);
      doc.fillColor('white').fontSize(12).font('Helvetica-Bold');
      doc.text('📝 NOTAS DE RUTA', 70, currentY + 10);
      doc.font('Helvetica').fontSize(10);
      doc.text(routeSheet.route_notes, 70, currentY + 25, { width: 480 });
      currentY += 60;
    }
    
    // Título de pedidos
    doc.fillColor(primaryColor).fontSize(16).font('Helvetica-Bold');
    doc.text('📦 PEDIDOS A ENTREGAR', { align: 'center' });
    doc.moveDown();
    currentY = doc.y;
    
    // Tabla de pedidos con diseño mejorado
    const startX = 50;
    const tableWidth = 520;
    const colWidths = [40, 150, 200, 80, 50]; // Anchos de columnas
    const headers = ['#', 'Cliente', 'Dirección', 'Teléfono', 'Estado'];
    
    // Encabezado de tabla
    doc.rect(startX, currentY, tableWidth, 25).fill(primaryColor);
    doc.fillColor('white').fontSize(10).font('Helvetica-Bold');
    let colX = startX + 5;
    headers.forEach((header, index) => {
      doc.text(header, colX, currentY + 8, { width: colWidths[index] - 10 });
      colX += colWidths[index];
    });
    
    currentY += 25;
    doc.fillColor('black');
    
    // Filas de datos
    for (let i = 0; i < routeSheet.details.length; i++) {
      const detail = routeSheet.details[i];
      
      // Verificar si necesitamos nueva página
      if (currentY > doc.page.height - 200) {
        doc.addPage();
        currentY = 50;
      }
      
      // Fondo alternado para filas
      const isEven = i % 2 === 0;
      if (isEven) {
        doc.rect(startX, currentY, tableWidth, 25).fill(lightGray);
      }
      
      // Datos de la fila
      doc.fontSize(9).font('Helvetica');
      colX = startX + 5;
      doc.text(detail.order.order_id.toString(), colX, currentY + 8, { width: colWidths[0] - 10 });
      colX += colWidths[0];
      doc.text(detail.order.customer.name, colX, currentY + 8, { width: colWidths[1] - 10 });
      colX += colWidths[1];
      doc.text(detail.order.customer.address, colX, currentY + 8, { width: colWidths[2] - 10 });
      colX += colWidths[2];
      doc.text(detail.order.customer.phone, colX, currentY + 8, { width: colWidths[3] - 10 });
      colX += colWidths[3];
      
      // Estado con color
      const statusColor = this.getStatusColor(detail.delivery_status);
      doc.fillColor(statusColor);
      doc.text(detail.delivery_status, colX, currentY + 8, { width: colWidths[4] - 10 });
      doc.fillColor('black');
      
      currentY += 25;
      
      // Detalles de productos (si se incluyen)
      if (includeProductDetails && detail.order.items.length > 0) {
        doc.fontSize(8).fillColor(secondaryColor);
        doc.text('Productos:', startX + 20, currentY + 5);
        currentY += 15;
        
        for (const item of detail.order.items) {
          doc.text(`• ${item.quantity}x ${item.product.description}`, startX + 30, currentY + 5);
          currentY += 12;
        }
        currentY += 5;
        doc.fillColor('black');
      }
      
      // Línea separadora
      doc.moveTo(startX, currentY).lineTo(startX + tableWidth, currentY).stroke();
      currentY += 5;
    }
    
    // Sección de firmas
    if (includeSignatureField) {
      if (currentY > doc.page.height - 200) {
        doc.addPage();
        currentY = 50;
      }
      
      doc.fillColor(primaryColor).fontSize(14).font('Helvetica-Bold');
      doc.text('✍️ CONFIRMACIÓN DE ENTREGAS', { align: 'center' });
      doc.moveDown();
      currentY = doc.y;
      
      // Campos de firma con diseño mejorado
      const signatureY = currentY;
      
      // Firma del conductor
      doc.rect(startX, signatureY, 240, 80).fill(lightGray);
      doc.fillColor(primaryColor).fontSize(12).font('Helvetica-Bold');
      doc.text('Firma del Conductor', startX + 10, signatureY + 10);
      doc.fillColor('black').fontSize(10);
      doc.text('Nombre:', startX + 10, signatureY + 30);
      doc.text('Fecha:', startX + 10, signatureY + 50);
      doc.text('Hora:', startX + 10, signatureY + 70);
      
      // Línea de firma
      doc.moveTo(startX + 10, signatureY + 40).lineTo(startX + 230, signatureY + 40).stroke();
      doc.moveTo(startX + 10, signatureY + 60).lineTo(startX + 230, signatureY + 60).stroke();
      doc.moveTo(startX + 10, signatureY + 80).lineTo(startX + 230, signatureY + 80).stroke();
      
      // Firma del supervisor
      doc.rect(startX + 280, signatureY, 240, 80).fill(lightGray);
      doc.fillColor(primaryColor).fontSize(12).font('Helvetica-Bold');
      doc.text('Firma del Supervisor', startX + 290, signatureY + 10);
      doc.fillColor('black').fontSize(10);
      doc.text('Nombre:', startX + 290, signatureY + 30);
      doc.text('Fecha:', startX + 290, signatureY + 50);
      doc.text('Hora:', startX + 290, signatureY + 70);
      
      // Línea de firma
      doc.moveTo(startX + 290, signatureY + 40).lineTo(startX + 510, signatureY + 40).stroke();
      doc.moveTo(startX + 290, signatureY + 60).lineTo(startX + 510, signatureY + 60).stroke();
      doc.moveTo(startX + 290, signatureY + 80).lineTo(startX + 510, signatureY + 80).stroke();
    }
    
    // Pie de página
    doc.fillColor(secondaryColor).fontSize(8);
    doc.text(`Documento generado el: ${new Date().toLocaleString('es-ES')}`, 50, doc.page.height - 30);
    doc.text(`Total de pedidos: ${routeSheet.details.length}`, { align: 'right' });
  }

  /**
   * Obtiene el color correspondiente al estado de entrega
   */
  private getStatusColor(status: string): string {
    switch (status.toLowerCase()) {
      case 'entregado':
      case 'delivered':
        return '#10b981'; // Verde
      case 'pendiente':
      case 'pending':
        return '#f59e0b'; // Naranja
      case 'cancelado':
      case 'cancelled':
        return '#ef4444'; // Rojo
      case 'en_ruta':
      case 'in_route':
        return '#3b82f6'; // Azul
      default:
        return '#64748b'; // Gris
    }
  }

  /**
   * Finaliza la generación del PDF y retorna la URL
   */
  async finalizePdf(
    doc: PDFKit.PDFDocument, 
    writeStream: fs.WriteStream, 
    filename: string
  ): Promise<{ url: string; filename: string }> {
    return new Promise((resolve, reject) => {
      doc.end();
      writeStream.on('finish', () => {
        const url = `http://localhost:3000/pdfs/${filename}`;
        resolve({ url, filename });
      });
      writeStream.on('error', reject);
    });
  }
} 