import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { PdfGeneratorService } from '../services/pdf-generator.service';
import { RouteSheetGeneratorService, CollectionRouteSheetPdfData } from '../services/route-sheet-generator.service';
import * as fs from 'fs-extra';

/**
 * Controlador de desarrollo para visualizar cambios en PDFs en tiempo real
 * Solo para desarrollo - NO USAR EN PRODUCCIÓN
 */
@Controller('dev/pdf')
export class PdfDevController {
  constructor(
    private readonly pdfGeneratorService: PdfGeneratorService,
    private readonly routeSheetGeneratorService: RouteSheetGeneratorService,
  ) {}

  /**
   * Endpoint para generar y visualizar un PDF de prueba de hoja de ruta de cobranzas
   * URL: http://localhost:3000/dev/pdf/preview-collection-route
   */
  @Get('preview-collection-route')
  async previewCollectionRoute(@Res() res: Response) {
    // Datos de prueba
    const testData: CollectionRouteSheetPdfData = {
      route_sheet_id: 1234,
      delivery_date: new Date().toISOString(),
      driver: {
        name: 'Juan Pérez',
        email: 'juan.perez@aguaviva.com',
      },
      vehicle: {
        code: 'VH-001',
        name: 'Camión Mercedes Benz 1518',
      },
      route_notes: 'Ruta prioritaria - Clientes con pagos vencidos',
      zone_identifiers: ['Centro', 'Norte'],
      collections: [
        {
          cycle_payment_id: 1,
          customer: {
            name: 'María González',
            address: 'Av. Sarmiento 1234',
            phone: '3624-123456',
          },
          amount: 5500.50,
          payment_due_date: new Date().toISOString(),
          cycle_period: 'Enero 2025',
          subscription_plan: 'Plan Familiar',
          delivery_status: 'pending',
          comments: 'Cliente preferencial',
        },
        {
          cycle_payment_id: 2,
          customer: {
            name: 'Carlos Rodríguez',
            address: 'Calle Francia 567',
            phone: '3624-654321',
          },
          amount: 3200.00,
          payment_due_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 días atrás
          cycle_period: 'Enero 2025',
          subscription_plan: 'Plan Básico',
          delivery_status: 'overdue',
          comments: 'Pago atrasado',
        },
        {
          cycle_payment_id: 3,
          customer: {
            name: 'Ana Martínez',
            address: 'Av. Alberdi 890',
            phone: '3624-789012',
          },
          amount: 4100.75,
          payment_due_date: new Date().toISOString(),
          cycle_period: 'Enero 2025',
          subscription_plan: 'Plan Estándar',
          delivery_status: 'pending',
        },
        {
          cycle_payment_id: 4,
          customer: {
            name: 'Roberto Silva',
            address: 'Calle Belgrano 234',
            phone: '3624-345678',
          },
          amount: 6800.00,
          payment_due_date: new Date().toISOString(),
          cycle_period: 'Enero 2025',
          subscription_plan: 'Plan Premium',
          delivery_status: 'delivered',
          delivery_time: '10:30',
          comments: 'Pagado en efectivo',
        },
        {
          cycle_payment_id: 5,
          customer: {
            name: 'Laura Fernández',
            address: 'Av. 9 de Julio 456',
            phone: '3624-901234',
          },
          amount: 4500.25,
          payment_due_date: new Date().toISOString(),
          cycle_period: 'Enero 2025',
          subscription_plan: 'Plan Familiar',
          delivery_status: 'pending',
        },
      ],
    };

    try {
      // Generar el PDF usando RouteSheetGeneratorService
      const { doc, pdfPath } = await this.routeSheetGeneratorService.generateCollectionRouteSheetPdf(
        testData,
      );

      // Crear el write stream
      const writeStream = fs.createWriteStream(pdfPath);
      doc.pipe(writeStream);
      doc.end();

      // Esperar a que termine de escribirse
      await new Promise<void>((resolve, reject) => {
        writeStream.on('finish', () => resolve());
        writeStream.on('error', reject);
      });

      // Leer el archivo y enviarlo
      const pdfBuffer = await fs.readFile(pdfPath);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline; filename="preview.pdf"');
      res.send(pdfBuffer);

      // Limpiar el archivo temporal después de 5 segundos
      setTimeout(async () => {
        try {
          await fs.remove(pdfPath);
        } catch (error) {
          console.error('Error al limpiar archivo temporal:', error);
        }
      }, 5000);

    } catch (error) {
      console.error('Error generando PDF de prueba:', error);
      res.status(500).json({
        error: 'Error generando PDF',
        message: error.message,
      });
    }
  }

  /**
   * Endpoint para generar y visualizar un PDF de prueba de hoja de ruta normal
   * URL: http://localhost:3000/dev/pdf/preview-route
   */
  @Get('preview-route')
  async previewRoute(@Res() res: Response) {
    const testData = {
      route_sheet_id: 15,
      delivery_date: '2025-11-07',
      driver: {
        id: 9,
        name: 'chofer 1',
        email: 'chofer1@gmail.com',
      },
      vehicle: {
        vehicle_id: 1,
        code: 'aks-123',
        name: 'mobil 1',
        zones: [
          {
            zone_id: 10,
            code: 'z-1-res',
            name: 'zona 1',
            locality: {
              locality_id: 1,
              code: 'RES',
              name: 'Resistencia',
              province: {
                province_id: 1,
                code: 'CH',
                name: 'Chaco',
                country: {
                  country_id: 1,
                  code: 'AR',
                  name: 'Argentina',
                },
              },
            },
          },
          {
            zone_id: 11,
            code: 'z-2-res',
            name: 'zona 2',
            locality: {
              locality_id: 1,
              code: 'RES',
              name: 'Resistencia',
              province: {
                province_id: 1,
                code: 'CH',
                name: 'Chaco',
                country: {
                  country_id: 1,
                  code: 'AR',
                  name: 'Argentina',
                },
              },
            },
          },
        ],
      },
      route_notes: 'salir por 3 de abril',
      details: [
        {
          route_sheet_detail_id: 20,
          route_sheet_id: 15,
          order: {
            order_id: 29,
            order_date: '2025-11-06T00:00:00.000Z',
            total_amount: '4000',
            status: 'READY_FOR_DELIVERY',
            customer: {
              person_id: 22,
              name: 'julian pinto',
              alias: 'komsa',
              address: 'sarmiento 300',
              phone: '3624857472',
            },
            items: [
              {
                order_item_id: 41,
                quantity: 2,
                delivered_quantity: 0,
                returned_quantity: 0,
                product: {
                  product_id: 10,
                  description: 'bidon 20 LTS',
                },
              },
            ],
          },
          delivery_status: 'PENDING',
          delivery_time: '08:00-12:00',
          is_current_delivery: true,
        },
        {
          route_sheet_detail_id: 21,
          route_sheet_id: 15,
          order: {
            order_id: 30,
            order_date: '2025-11-06T00:00:00.000Z',
            total_amount: '6000',
            status: 'READY_FOR_DELIVERY',
            customer: {
              person_id: 23,
              name: 'maria gonzalez',
              address: 'av. alberdi 1500',
              phone: '3624999888',
            },
            items: [
              {
                order_item_id: 42,
                quantity: 3,
                delivered_quantity: 0,
                returned_quantity: 0,
                product: {
                  product_id: 10,
                  description: 'bidon 20 LTS',
                },
              },
            ],
          },
          delivery_status: 'PENDING',
          delivery_time: '12:00-16:00',
          is_current_delivery: true,
        },
      ],
      zones_covered: [
        {
          zone_id: 10,
          code: 'z-1-res',
          name: 'zona 1',
          locality: {
            locality_id: 1,
            code: 'RES',
            name: 'Resistencia',
            province: {
              province_id: 1,
              code: 'CH',
              name: 'Chaco',
              country: {
                country_id: 1,
                code: 'AR',
                name: 'Argentina',
              },
            },
          },
        },
      ],
    };

    try {
      const { doc, pdfPath } = await this.pdfGeneratorService.generateRouteSheetPdf(testData, {
        includeSignatureField: true,
        includeProductDetails: true,
      });

      const writeStream = fs.createWriteStream(pdfPath);
      doc.pipe(writeStream);
      doc.end();

      await new Promise<void>((resolve, reject) => {
        writeStream.on('finish', () => resolve());
        writeStream.on('error', reject);
      });

      const pdfBuffer = await fs.readFile(pdfPath);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline; filename="preview-route.pdf"');
      res.send(pdfBuffer);

      setTimeout(async () => {
        try {
          await fs.remove(pdfPath);
        } catch (error) {
          console.error('Error al limpiar archivo temporal:', error);
        }
      }, 5000);

    } catch (error) {
      console.error('Error generando PDF de prueba:', error);
      res.status(500).json({
        error: 'Error generando PDF',
        message: error.message,
      });
    }
  }
}
