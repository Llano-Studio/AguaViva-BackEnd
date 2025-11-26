import { Controller, Get, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';
import { PdfGeneratorService, CollectionRouteSheetPdfData } from '../services/pdf-generator.service';
import { RouteSheetGeneratorService } from '../services/route-sheet-generator.service';
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

## Estructura Completa (CollectionRouteSheetPdfData)

\`\`\`json
{
  "route_sheet_id": 1,
  "delivery_date": "YYYY-MM-DD",
  "driver": {
    "name": "Nombre Conductor",
    "email": "email@conductor.com"
  },
  "vehicle": {
    "code": "COD-VEH",
    "name": "Nombre Vehículo"
  },
  "route_notes": "Notas generales de la ruta",
  "zone_identifiers": ["zona1", "zona2"],
  "collections": [
    {
      "cycle_payment_id": 1,
      "customer": {
        "customer_id": 1,
        "name": "Nombre Cliente",
        "address": "Dirección Cliente",
        "phone": "123456789",
        "zone": {
          "zone_id": 1,
          "code": "Z1",
          "name": "Zona 1"
        },
        "locality": {
          "locality_id": 1,
          "code": "LOC",
          "name": "Localidad"
        }
      },
      "amount": 1000.00,
      "payment_reference": "REF123",
      "payment_notes": "Notas de pago",
      "payment_method": "CASH",
      "subscription_notes": "Notas de suscripción",
      "payment_due_date": "YYYY-MM-DD",
      "all_due_dates": ["YYYY-MM-DD", "YYYY-MM-DD"],
      "cycle_period": "MONTHLY",
      "subscription_plan": "Plan Premium",
      "payment_status": "PENDING",
      "delivery_status": "PENDING",
      "delivery_time": "08:00-12:00",
      "comments": "Comentarios",
      "subscription_id": 1,
      "credits": [
        {
          "product_description": "Producto Crédito",
          "planned_quantity": 2,
          "delivered_quantity": 1,
          "remaining_balance": 1
        }
      ]
    }
  ]
}
\`\`\`

## Reglas de cálculo y visualización

- **Monto**:
  - Si el cliente tiene un único abono activo y posee cuotas impagas, se muestra la suma total del saldo pendiente.
  - Si tiene múltiples abonos, se muestran filas separadas.
- **Vencimientos**:
  - Se muestra la fecha de vencimiento principal.
  - Si hay múltiples vencimientos, se listan en \`all_due_dates\` y se pueden mostrar en notas.
- **Créditos**:
  - Se visualizan los créditos disponibles y entregados.
`,
  })
  @ApiResponse({ status: 200, description: 'Devuelve un PDF en el cuerpo de la respuesta' })
  async previewCollectionRoute(@Res() res: Response) {
    // Usar la nueva estructura CollectionRouteSheetPdfData
    const testData: CollectionRouteSheetPdfData = {
      route_sheet_id: 23,
      delivery_date: "2025-11-14",
      driver: {
        name: "chofer 1",
        email: "chofer1@gmail.com"
      },
      vehicle: {
        code: "aks-123",
        name: "mobil 1"
      },
      route_notes: "cargar combustible en YPF sarmiento",
      zone_identifiers: ["z-1-res", "z-2-res", "z-3-res"],
          collections: [
          {
            cycle_payment_id: 42,
            customer: {
              customer_id: 101,
              name: "elsa moro",
              address: "jose hernandez 270",
              phone: "3624950203",
            zone: {
              zone_id: 11,
              code: "z-2-res",
              name: "zona 2"
            },
            locality: {
              locality_id: 1,
              code: "RES",
              name: "Resistencia"
            }
          },
          amount: 4500,
          payment_due_date: "2025-11-15",
          cycle_period: "MONTHLY",
          subscription_plan: "Plan Premium",
          payment_status: "PENDING",
          delivery_status: "PENDING",
          delivery_time: "08:00-12:00",
          comments: "timbre 6W - avisar antes de ir",
          subscription_id: 23,
          credits: [
            {
              product_description: "dispenser agua frio calor",
              planned_quantity: 1,
              delivered_quantity: 0,
              remaining_balance: 1
            },
            {
              product_description: "bidon 20 LTS",
              planned_quantity: 6,
              delivered_quantity: 2,
              remaining_balance: 4
            }
          ]
        },
          {
            cycle_payment_id: 43,
            customer: {
              customer_id: 102,
              name: "daiana gonzalez",
              address: "san martin 450",
              phone: "3624888999",
            zone: {
              zone_id: 11,
              code: "z-2-res",
              name: "zona 2"
            },
            locality: {
              locality_id: 1,
              code: "RES",
              name: "Resistencia"
            }
          },
          amount: 3200,
          payment_due_date: "2025-11-10",
          cycle_period: "MONTHLY",
          subscription_plan: "Plan Básico",
          payment_status: "OVERDUE",
          delivery_status: "PENDING",
          delivery_time: "14:00-18:00",
          comments: "portón verde - casa con rejas",
          subscription_id: 24,
          credits: [
            {
              product_description: "bidon 12 LTS",
              planned_quantity: 4,
              delivered_quantity: 1,
              remaining_balance: 3
            }
          ]
        },
          {
            cycle_payment_id: 44,
            customer: {
              customer_id: 103,
              name: "santiago valussi",
              address: "moreno 789",
              phone: "3624777888",
            zone: {
              zone_id: 12,
              code: "z-3-res", 
              name: "zona 3"
            },
            locality: {
              locality_id: 1,
              code: "RES",
              name: "Resistencia"
            }
          },
          amount: 580000,
          payment_due_date: "2025-11-12",
          cycle_period: "MONTHLY", 
          subscription_plan: "Plan Familiar",
          payment_status: "PAID",
          delivery_status: "OVERDUE",
          delivery_time: "09:00-13:00",
          comments: "departamento 2B - interfono roto",
          subscription_id: 25,
          credits: [
            {
              product_description: "bidon 20 LTS",
              planned_quantity: 8,
              delivered_quantity: 3,
              remaining_balance: 5
            },
            {
              product_description: "dispenser agua frio calor",
              planned_quantity: 2,
              delivered_quantity: 0,
              remaining_balance: 2
            }
          ]
        }
      ]
    };

    try {
      // Generar el PDF directamente usando PdfGeneratorService
      const result = await this.pdfGeneratorService.generateCollectionRouteSheetPdf(testData);
      
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
      res.setHeader('Content-Disposition', 'inline; filename="preview-collection-route.pdf"');
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

## Estructura Completa (RouteSheetPdfData)

\`\`\`json
{
  "route_sheet_id": 1,
  "delivery_date": "YYYY-MM-DD",
  "driver": {
    "id": 1,
    "name": "Nombre Conductor",
    "email": "email@conductor.com"
  },
  "vehicle": {
    "vehicle_id": 1,
    "code": "COD-VEH",
    "name": "Nombre Vehículo",
    "zones": [
      {
        "zone_id": 1,
        "code": "Z1",
        "name": "Zona 1",
        "locality": {
          "locality_id": 1,
          "code": "LOC",
          "name": "Localidad",
          "province": {
            "province_id": 1,
            "code": "PROV",
            "name": "Provincia",
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
  "route_notes": "Notas de ruta",
  "zone_identifiers": ["Z1"],
  "details": [
    {
      "route_sheet_detail_id": 1,
      "route_sheet_id": 1,
      "order": {
        "order_id": 100,
        "order_date": "YYYY-MM-DD",
        "total_amount": "5000.00",
        "status": "CONFIRMED",
        "subscription_id": 1,
        "subscription_due_date": "YYYY-MM-DD",
        "customer": {
          "person_id": 1,
          "name": "Nombre Cliente",
          "alias": "Alias",
          "address": "Dirección Cliente",
          "phone": "123456789",
          "zone": {
            "zone_id": 1,
            "code": "Z1",
            "name": "Zona 1"
          },
          "locality": {
            "locality_id": 1,
            "code": "LOC",
            "name": "Localidad"
          },
          "special_instructions": "Instrucciones especiales"
        },
        "items": [
          {
            "order_item_id": 1,
            "quantity": 2,
            "delivered_quantity": 0,
            "returned_quantity": 0,
            "product": {
              "product_id": 1,
              "description": "Producto"
            }
          }
        ],
        "notes": "Notas del pedido"
      },
      "delivery_status": "PENDING",
      "delivery_time": "08:00-12:00",
      "is_current_delivery": true,
      "comments": "Comentarios detalle",
      "credits": [
        {
          "product_description": "Producto Crédito",
          "planned_quantity": 1,
          "delivered_quantity": 0,
          "remaining_balance": 1
        }
      ]
    }
  ],
  "zones_covered": [
    {
      "zone_id": 1,
      "code": "Z1",
      "name": "Zona 1",
      "locality": {
        "locality_id": 1,
        "code": "LOC",
        "name": "Localidad",
        "province": {
          "province_id": 1,
          "code": "PROV",
          "name": "Provincia",
          "country": {
            "country_id": 1,
            "code": "AR",
            "name": "Argentina"
          }
        }
      }
    }
  ]
}
\`\`\`
`,
  })
  @ApiResponse({ status: 200, description: 'Devuelve un PDF en el cuerpo de la respuesta' })
  async previewRoute(@Res() res: Response) {
    const testData = {
      route_sheet_id: 23,
      delivery_date: "2025-11-25",
      driver: {
        id: 9,
        name: "chofer 1",
        email: "chofer1@gmail.com"
      },
      vehicle: {
        vehicle_id: 1,
        code: "aks-123",
        name: "mobil 1",
        zones: [
          {
            zone_id: 10,
            code: "z-1-res",
            name: "zona 1",
            locality: {
              locality_id: 1,
              code: "RES",
              name: "Resistencia",
              province: {
                province_id: 1,
                code: "CH",
                name: "Chaco",
                country: {
                  country_id: 1,
                  code: "AR",
                  name: "Argentina"
                }
              }
            }
          },
          {
            zone_id: 11,
            code: "z-2-res",
            name: "zona 2",
            locality: {
              locality_id: 1,
              code: "RES",
              name: "Resistencia",
              province: {
                province_id: 1,
                code: "CH",
                name: "Chaco",
                country: {
                  country_id: 1,
                  code: "AR",
                  name: "Argentina"
                }
              }
            }
          },
          {
            zone_id: 12,
            code: "z-3-res",
            name: "zona 3",
            locality: {
              locality_id: 1,
              code: "RES",
              name: "Resistencia",
              province: {
                province_id: 1,
                code: "CH",
                name: "Chaco",
                country: {
                  country_id: 1,
                  code: "AR",
                  name: "Argentina"
                }
              }
            }
          }
        ]
      },
      route_notes: "cargar combustible en YPF sarmiento",
      details: [
        {
          route_sheet_detail_id: 42,
          route_sheet_id: 23,
          order: {
            order_id: 41,
            order_date: "2025-11-24T00:00:00.000Z",
            total_amount: "4500000",
            status: "READY_FOR_DELIVERY",
            subscription_id: 23,
            subscription_due_date: "2025-11-25",
            customer: {
              person_id: 29,
              name: "elsa moro",
              phone: "3624950203",
              alias: "Llano Studio",
              address: "jose hernandez 270",
              zone: {
                zone_id: 11,
                code: "z-2-res",
                name: "zona 2"
              },
              locality: {
                locality_id: 1,
                code: "RES",
                name: "Resistencia"
              },
              special_instructions: "{\"delivery_preferences\":{\"special_instructions\":\"timbre 6W\",\"preferred_days\":[\"MONDAY\",\"WEDNESDAY\",\"FRIDAY\"],\"preferred_time_range\":\"08:00-12:00\"}}"
            },
            items: [
              {
                order_item_id: 57,
                product: {
                  product_id: 10,
                  description: "bidon 20 LTS"
                },
                quantity: 2,
                delivered_quantity: 0,
                returned_quantity: 0
              },
              {
                order_item_id: 58,
                product: {
                  product_id: 9,
                  description: "bidon 12 LTS"
                },
                quantity: 3,
                delivered_quantity: 0,
                returned_quantity: 0
              }
            ],
            notes: "avisar antes de ir"
          },
          delivery_status: "PENDING",
          delivery_time: "08:00-12:00",
          is_current_delivery: true,
          credits: [
            {
              product_description: "dispenser agua frio calor",
              planned_quantity: 1,
              delivered_quantity: 0,
              remaining_balance: 1
            },
            {
              product_description: "bidon 20 LTS",
              planned_quantity: 6,
              delivered_quantity: 2,
              remaining_balance: 4
            }
          ]
        }
      ],
      zones_covered: [
        {
          zone_id: 10,
          code: "z-1-res",
          name: "zona 1",
          locality: {
            locality_id: 1,
            code: "RES",
            name: "Resistencia",
            province: {
              province_id: 1,
              code: "CH",
              name: "Chaco",
              country: {
                country_id: 1,
                code: "AR",
                name: "Argentina"
              }
            }
          }
        },
        {
          zone_id: 11,
          code: "z-2-res",
          name: "zona 2",
          locality: {
            locality_id: 1,
            code: "RES",
            name: "Resistencia",
            province: {
              province_id: 1,
              code: "CH",
              name: "Chaco",
              country: {
                country_id: 1,
                code: "AR",
                name: "Argentina"
              }
            }
          }
        },
        {
          zone_id: 12,
          code: "z-3-res",
          name: "zona 3",
          locality: {
            locality_id: 1,
            code: "RES",
            name: "Resistencia",
            province: {
              province_id: 1,
              code: "CH",
              name: "Chaco",
              country: {
                country_id: 1,
                code: "AR",
                name: "Argentina"
              }
            }
          }
        }
      ]
    };

    try {
      // Generar el PDF usando RouteSheetGeneratorService con datos de prueba
      const filePath = await this.routeSheetGeneratorService.generatePreviewRouteSheetPdf(testData);

      const pdfBuffer = await fs.readFile(filePath);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline; filename="preview-route.pdf"');
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
