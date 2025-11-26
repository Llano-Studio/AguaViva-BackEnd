import { Controller, Get, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';
import {
  PdfGeneratorService,
  CollectionRouteSheetPdfData,
} from '../services/pdf-generator.service';
import { RouteSheetGeneratorService } from '../services/route-sheet-generator.service';
import { GenerateRouteSheetDto } from '../../orders/dto/generate-route-sheet.dto';
import * as fs from 'fs-extra';

/**
 * Controlador de desarrollo para visualizar cambios en PDFs en tiempo real
 * Solo para desarrollo - NO USAR EN PRODUCCIÓN
 */
@ApiTags('🧪 Dev PDF')
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
  @ApiOperation({
    summary: 'Preview hoja de ruta de cobranzas (DEV)',
    description: `Genera un PDF de hoja de ruta de cobranzas usando datos de ejemplo.

## Estructura esperada (CollectionRouteSheetPdfData)
{
  route_sheet_id: number,
  delivery_date: 'YYYY-MM-DD',
  driver: { name: string, email: string },
  vehicle: { code: string, name: string },
  route_notes?: string,
  zone_identifiers?: string[],
  collections: [
    {
      cycle_payment_id: number,
      customer: {
        customer_id: number,
        name: string,
        address: string,
        phone: string,
        zone?: { zone_id: number, code: string, name: string },
        locality?: { locality_id?: number, code?: string, name: string }
      },
      amount: number,
      payment_reference?: string,
      payment_notes?: string,
      payment_method?: string,
      subscription_notes?: string,
      payment_due_date: 'YYYY-MM-DD',
      cycle_period: string,
      subscription_plan: string,
      delivery_status: string,
      delivery_time?: string,
      comments?: string,
      subscription_id?: number,
      credits?: [{ product_description: string, planned_quantity: number, delivered_quantity: number, remaining_balance: number }]
    }
] 
}

## Reglas de cálculo y filas

- "Monto":
  - Si el cliente tiene un único abono activo y posee cuotas impagas, se muestra la suma total del saldo pendiente de ese abono.
  - Si el cliente tiene múltiples abonos, se muestran filas separadas por cada abono, cada una con su propio monto y vencimiento.
- "Venc.": si hay múltiples abonos con vencimiento hoy, se añade "(+N)" y en "Notas" se listan las fechas vencidas.
`,
  })
  @ApiResponse({
    status: 200,
    description: 'Devuelve un PDF en el cuerpo de la respuesta',
  })
  async previewCollectionRoute(@Res() res: Response) {
    // Usar la nueva estructura CollectionRouteSheetPdfData
    const testData: CollectionRouteSheetPdfData = {
      route_sheet_id: 23,
      delivery_date: '2025-11-14',
      driver: {
        name: 'chofer 1',
        email: 'chofer1@gmail.com',
      },
      vehicle: {
        code: 'aks-123',
        name: 'mobil 1',
      },
<<<<<<< HEAD
      route_notes: 'cargar combustible en YPF sarmiento',
      zone_identifiers: ['z-1-res', 'z-2-res', 'z-3-res'],
      collections: [
        {
          cycle_payment_id: 42,
          customer: {
            customer_id: 101,
            name: 'elsa moro',
            address: 'jose hernandez 270',
            phone: '3624950203',
            zone: {
              zone_id: 11,
              code: 'z-2-res',
              name: 'zona 2',
            },
            locality: {
              locality_id: 1,
              code: 'RES',
              name: 'Resistencia',
            },
          },
          amount: 4500,
          payment_due_date: '2025-11-15',
          cycle_period: 'MONTHLY',
          subscription_plan: 'Plan Premium',
          payment_status: 'PENDING',
          delivery_status: 'PENDING',
          delivery_time: '08:00-12:00',
          comments: 'timbre 6W - avisar antes de ir',
          subscription_id: 23,
          credits: [
            {
              product_description: 'dispenser agua frio calor',
              planned_quantity: 1,
              delivered_quantity: 0,
              remaining_balance: 1,
            },
            {
              product_description: 'bidon 20 LTS',
              planned_quantity: 6,
              delivered_quantity: 2,
              remaining_balance: 4,
            },
          ],
        },
        {
          cycle_payment_id: 43,
          customer: {
            customer_id: 102,
            name: 'daiana gonzalez',
            address: 'san martin 450',
            phone: '3624888999',
            zone: {
              zone_id: 11,
              code: 'z-2-res',
              name: 'zona 2',
            },
            locality: {
              locality_id: 1,
              code: 'RES',
              name: 'Resistencia',
            },
          },
          amount: 3200,
          payment_due_date: '2025-11-10',
          cycle_period: 'MONTHLY',
          subscription_plan: 'Plan Básico',
          payment_status: 'OVERDUE',
          delivery_status: 'PENDING',
          delivery_time: '14:00-18:00',
          comments: 'portón verde - casa con rejas',
          subscription_id: 24,
          credits: [
            {
              product_description: 'bidon 12 LTS',
              planned_quantity: 4,
              delivered_quantity: 1,
              remaining_balance: 3,
            },
          ],
        },
        {
          cycle_payment_id: 44,
          customer: {
            customer_id: 103,
            name: 'santiago valussi',
            address: 'moreno 789',
            phone: '3624777888',
            zone: {
              zone_id: 12,
              code: 'z-3-res',
              name: 'zona 3',
            },
            locality: {
              locality_id: 1,
              code: 'RES',
              name: 'Resistencia',
            },
          },
          amount: 580000,
          payment_due_date: '2025-11-12',
          cycle_period: 'MONTHLY',
          subscription_plan: 'Plan Familiar',
          payment_status: 'PAID',
          delivery_status: 'OVERDUE',
          delivery_time: '09:00-13:00',
          comments: 'departamento 2B - interfono roto',
          subscription_id: 25,
          credits: [
            {
              product_description: 'bidon 20 LTS',
              planned_quantity: 8,
              delivered_quantity: 3,
              remaining_balance: 5,
            },
            {
              product_description: 'dispenser agua frio calor',
              planned_quantity: 2,
              delivered_quantity: 0,
              remaining_balance: 2,
            },
          ],
        },
      ],
    };

    try {
      // Generar el PDF directamente usando PdfGeneratorService
      const result =
        await this.pdfGeneratorService.generateCollectionRouteSheetPdf(
          testData,
        );

      // Crear archivo temporal para preview
      const tempPath = `./temp/preview-collection-${Date.now()}.pdf`;
      await fs.ensureDir('./temp');

      const writeStream = fs.createWriteStream(tempPath);
      result.doc.pipe(writeStream);
      result.doc.end();

      // Esperar a que termine de escribirse
      await new Promise<void>((resolve, reject) => {
        writeStream.on('finish', () => resolve());
        writeStream.on('error', reject);
      });

      // Leer el archivo PDF generado
      const pdfBuffer = await fs.readFile(tempPath);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        'inline; filename="preview-collection-route.pdf"',
      );
      res.send(pdfBuffer);

      // Limpiar el archivo temporal después de 5 segundos
      setTimeout(async () => {
        try {
          await fs.remove(tempPath);
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
  @ApiOperation({
    summary: 'Preview hoja de ruta de pedidos (DEV)',
    description: `Genera un PDF de hoja de ruta de pedidos usando datos de ejemplo.

## Estructura esperada (RouteSheetPdfData)
{
  route_sheet_id: number,
  delivery_date: 'YYYY-MM-DD',
  driver: { id: number, name: string, email: string },
  vehicle: {
    vehicle_id: number,
    code: string,
    name: string,
    zones: [{
      zone_id: number,
      code: string,
      name: string,
      locality?: {
        locality_id: number,
        code: string,
        name: string,
        province: {
          province_id: number,
          code: string,
          name: string,
          country: { country_id: number, code: string, name: string }
        }
      }
    }]
  },
  route_notes?: string,
  zone_identifiers?: string[],
  details: [{
    route_sheet_detail_id: number,
    route_sheet_id: number,
    order: {
      order_id: number,
      order_date: string,
      total_amount: string,
      status: string,
      subscription_id?: number,
      all_due_dates?: string[],
      customer: {
        person_id: number,
        name: string,
        alias?: string,
        address: string,
        phone: string,
        locality?: { name: string }
      },
      items: [{
        order_item_id: number,
        quantity: number,
        delivered_quantity: number,
        returned_quantity: number,
        product: { product_id: number, description: string }
      }],
      notes?: string
    },
    delivery_status: string,
    delivery_time: string,
    is_current_delivery: boolean,
    comments?: string,
    credits?: [{ product_description: string, planned_quantity: number, delivered_quantity: number, remaining_balance: number }]
  }],
  zones_covered: [{ zone_id: number, code: string, name: string, locality?: { locality_id: number, code: string, name: string, province: { province_id: number, code: string, name: string, country: { country_id: number, code: string, name: string } } } }]
}`,
  })
  @ApiResponse({
    status: 200,
    description: 'Devuelve un PDF en el cuerpo de la respuesta',
  })
  async previewRoute(@Res() res: Response) {
    const testData = {
      "route_sheet_id": 12,
      "delivery_date": "2025-11-26",
      "driver": {
        "id": 3,
        "name": "chofer 1",
        "email": "chofer1@gmail.com"
      },
      "vehicle": {
        "vehicle_id": 1,
        "code": "mb-1",
        "name": "movil 1",
        "zones": [
          {
            "zone_id": 2,
            "code": "zn-1-res",
            "name": "zona 1",
            "locality": {
              "locality_id": 1,
              "code": "RES",
              "name": "Resistencia",
              "province": {
                "province_id": 1,
                "code": "CH",
                "name": "Chaco",
                "country": {
                  "country_id": 1,
                  "code": "AR",
                  "name": "Argentina"
                }
              }
            }
          },
          {
            "zone_id": 7,
            "code": "zn-5-res",
            "name": "zona 5",
            "locality": {
              "locality_id": 1,
              "code": "RES",
              "name": "Resistencia",
              "province": {
                "province_id": 1,
                "code": "CH",
                "name": "Chaco",
                "country": {
                  "country_id": 1,
                  "code": "AR",
                  "name": "Argentina"
                }
              }
            }
          }
        ]
      },
      "zone_identifiers": [
        "zona 1",
        "zona 5"
      ],
      "route_notes": "salir por alverdi",
      "details": [
        {
          "route_sheet_detail_id": 32,
          "route_sheet_id": 12,
          "order": {
            "order_id": 10,
            "order_date": "2025-11-26T00:00:00-03:00",
            "total_amount": "0",
            "status": "READY_FOR_DELIVERY",
            "subscription_id": 14,
            "subscription_due_date": "2025-11-12",
            "all_due_dates": [
              "2025-11-12",
              "2025-11-26"
            ],
            "customer": {
              "person_id": 10,
              "name": "claudia 2",
              "alias": "llano studio",
              "address": "goitia 1214",
              "phone": "3624938473",
              "locality": {
                "locality_id": 1,
                "code": "RES",
                "name": "Resistencia"
              },
              "special_instructions": "{\"delivery_preferences\":{\"special_instructions\":\"timbre 1\",\"preferred_days\":[\"MONDAY\",\"WEDNESDAY\"],\"preferred_time_range\":\"08:00-12:00\",\"avoid_times\":[\"15:00-18:00\"]}}"
            },
            "items": [
              {
                "order_item_id": 18,
                "quantity": 3,
                "delivered_quantity": 0,
                "returned_quantity": 0,
                "product": {
                  "product_id": 1,
                  "description": "bidon 20 lts"
                }
              }
            ],
            "notes": "avisar antes"
          },
          "delivery_status": "PENDING",
          "delivery_time": "08:00-12:00",
          "is_current_delivery": true,
          "credits": [
            {
              "product_description": "dispenser frio calor",
              "planned_quantity": 1,
              "delivered_quantity": 0,
              "remaining_balance": 1
            },
            {
              "product_description": "bidon 20 lts",
              "planned_quantity": 6,
              "delivered_quantity": 5,
              "remaining_balance": 1
            }
          ]
        },
        {
          "route_sheet_detail_id": 33,
          "route_sheet_id": 12,
          "order": {
            "order_id": 12,
            "order_date": "2025-11-26T00:00:00-03:00",
            "total_amount": "4008",
            "status": "READY_FOR_DELIVERY",
            "subscription_id": 14,
            "subscription_due_date": "2025-11-12",
            "all_due_dates": [
              "2025-11-12",
              "2025-11-26"
            ],
            "customer": {
              "person_id": 10,
              "name": "claudia 2",
              "alias": "llano studio",
              "address": "goitia 1214",
              "phone": "3624938473",
              "locality": {
                "locality_id": 1,
                "code": "RES",
                "name": "Resistencia"
              },
              "special_instructions": "{\"delivery_preferences\":{\"special_instructions\":\"timbre 1\",\"preferred_days\":[\"MONDAY\",\"WEDNESDAY\"],\"preferred_time_range\":\"08:00-12:00\",\"avoid_times\":[\"15:00-18:00\"]}}"
            },
            "items": [
              {
                "order_item_id": 20,
                "quantity": 2,
                "delivered_quantity": 0,
                "returned_quantity": 0,
                "product": {
                  "product_id": 1,
                  "description": "bidon 20 lts"
                }
              }
            ],
            "notes": "avisar antes de ir"
          },
          "delivery_status": "PENDING",
          "delivery_time": "08:00-12:00",
          "is_current_delivery": false,
          "credits": [
            {
              "product_description": "dispenser frio calor",
              "planned_quantity": 1,
              "delivered_quantity": 0,
              "remaining_balance": 1
            },
            {
              "product_description": "bidon 20 lts",
              "planned_quantity": 6,
              "delivered_quantity": 5,
              "remaining_balance": 1
            }
          ]
        },
        {
          "route_sheet_detail_id": 34,
          "route_sheet_id": 12,
          "order": {
            "order_id": 13,
            "order_date": "2025-11-26T00:00:00-03:00",
            "total_amount": "4008",
            "status": "READY_FOR_DELIVERY",
            "subscription_id": 3,
            "subscription_due_date": "2025-11-15",
            "all_due_dates": [
              "2025-11-15"
            ],
            "customer": {
              "person_id": 3,
              "name": "diego alvarez",
              "address": "vedia 1595",
              "phone": "3624837482",
              "locality": {
                "locality_id": 1,
                "code": "RES",
                "name": "Resistencia"
              },
              "special_instructions": "{\"delivery_preferences\":{\"special_instructions\":\"timbre 406\",\"preferred_days\":[\"MONDAY\",\"WEDNESDAY\",\"FRIDAY\"],\"preferred_time_range\":\"08:00-12:00\",\"avoid_times\":[\"15:00-18:00\"]}}"
            },
            "items": [
              {
                "order_item_id": 21,
                "quantity": 2,
                "delivered_quantity": 0,
                "returned_quantity": 0,
                "product": {
                  "product_id": 1,
                  "description": "bidon 20 lts"
                }
              }
            ],
            "notes": "avisar antes"
          },
          "delivery_status": "PENDING",
          "delivery_time": "08:00-12:00",
          "is_current_delivery": false,
          "credits": [
            {
              "product_description": "dispenser frio calor",
              "planned_quantity": 1,
              "delivered_quantity": 1,
              "remaining_balance": 0
            },
            {
              "product_description": "bidon 20 lts",
              "planned_quantity": 6,
              "delivered_quantity": 6,
              "remaining_balance": 0
            }
          ]
        }
      ],
      "zones_covered": [
        {
          "zone_id": 2,
          "code": "zn-1-res",
          "name": "zona 1",
          "locality": {
            "locality_id": 1,
            "code": "RES",
            "name": "Resistencia",
            "province": {
              "province_id": 1,
              "code": "CH",
              "name": "Chaco",
              "country": {
                "country_id": 1,
                "code": "AR",
                "name": "Argentina"
              }
            }
          }
        },
        {
          "zone_id": 7,
          "code": "zn-5-res",
          "name": "zona 5",
          "locality": {
            "locality_id": 1,
            "code": "RES",
            "name": "Resistencia",
            "province": {
              "province_id": 1,
              "code": "CH",
              "name": "Chaco",
              "country": {
                "country_id": 1,
                "code": "AR",
                "name": "Argentina"
              }
            }
          }
        }
      ]
    };

    try {
      // Generar el PDF usando RouteSheetGeneratorService con datos de prueba
      const filePath =
        await this.routeSheetGeneratorService.generatePreviewRouteSheetPdf(
          testData,
        );

      const pdfBuffer = await fs.readFile(filePath);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        'inline; filename="preview-route.pdf"',
      );
      res.send(pdfBuffer);

      setTimeout(async () => {
        try {
          await fs.remove(filePath);
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
