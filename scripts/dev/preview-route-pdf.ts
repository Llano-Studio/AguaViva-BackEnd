import { PdfGeneratorService, type RouteSheetPdfData, type PdfGenerationOptions } from '../../src/common/services/pdf-generator.service';
import * as fs from 'fs-extra';
import * as path from 'path';
import PDFDocument = require('pdfkit');

async function run() {
  const service = new PdfGeneratorService();
  const pdfDir = path.join(process.cwd(), 'public', 'pdfs');
  await fs.ensureDir(pdfDir);
  const pdfPath = path.join(pdfDir, 'route_sheet_preview.pdf');

  const data: RouteSheetPdfData = {
    route_sheet_id: 999,
    delivery_date: new Date().toISOString().split('T')[0],
    driver: { name: 'Juan Pérez', email: 'juan@example.com' },
    vehicle: { code: 'VH-01', name: 'Camión 1' },
    route_notes: 'Notas de prueba para visualizar estilos. Edita pdf-generator.service.ts y guarda para ver cambios.',
    details: [
      {
        order: {
          order_id: 101,
          customer: { name: 'Cliente A', address: 'Av. Siempreviva 123', phone: '3624-000000' },
          items: [
            { quantity: 2, product: { description: 'Bidón 30L' } },
            { quantity: 1, product: { description: 'Dispensador' } },
          ],
        },
        delivery_status: 'pending',
      },
      {
        order: {
          order_id: 102,
          customer: { name: 'Cliente B', address: 'Mitre 456', phone: '3624-111111' },
          items: [{ quantity: 3, product: { description: 'Bidón 12L' } }],
        },
        delivery_status: 'in_route',
      },
      {
        order: {
          order_id: 103,
          customer: { name: 'Cliente C', address: 'Sarmiento 789', phone: '3624-222222' },
          items: [{ quantity: 1, product: { description: 'Bidón 7L' } }],
        },
        delivery_status: 'delivered',
      },
    ],
  };

  const options: PdfGenerationOptions = {
    includeSignatureField: true,
    includeProductDetails: true,
    customColors: { primary: '#0F766E', accent: '#14B8A6', lightGray: '#F1F5F9' },
  };

  // Genera el PDF con un nombre fijo y deja el visor abierto para autorecarga
  const doc = new PDFDocument({ margin: 50, size: 'A4', autoFirstPage: true });
  const writeStream = fs.createWriteStream(pdfPath);
  doc.pipe(writeStream);

  // Usamos el método privado del servicio para ver el diseño real del PDF
  await (service as any).generateRouteSheetContent(doc, data, options);

  await new Promise<void>((resolve, reject) => {
    doc.end();
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
  });

  console.log(`PDF actualizado: ${pdfPath}`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
