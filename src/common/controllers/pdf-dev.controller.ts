import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { PdfGeneratorService, CollectionRouteSheetPdfData } from '../services/pdf-generator.service';
import { RouteSheetGeneratorService } from '../services/route-sheet-generator.service';
import { GenerateRouteSheetDto } from '../../orders/dto/generate-route-sheet.dto';
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
          amount: 5800,
          payment_due_date: "2025-11-12",
          cycle_period: "MONTHLY", 
          subscription_plan: "Plan Familiar",
          delivery_status: "PENDING",
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
  async previewRoute(@Res() res: Response) {
    const testData = {
      route_sheet_id: 23,
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
      delivery_date: "2025-11-14",
      route_notes: "cargar combustible en YPF sarmiento",
      details: [
        {
          route_sheet_detail_id: 42,
          route_sheet_id: 23,
          order: {
            order_id: 41,
            order_date: "2025-11-13T00:00:00.000Z",
            total_amount: "4500",
            status: "READY_FOR_DELIVERY",
            subscription_id: 23,
            customer: {
              person_id: 29,
              name: "elsa moro",
              phone: "3624950203",
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
              special_instructions: "{\"delivery_preferences\":{\"special_instructions\":\"timbre 6W\",\"preferred_days\":[\"MONDAY\",\"WEDNESDAY\",\"FRIDAY\"],\"preferred_time_range\":\"08:00-12:00\",\"avoid_times\":[\"08:00-12:00\"]}}"
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
        },
        {
          route_sheet_detail_id: 42,
          route_sheet_id: 23,
          order: {
            order_id: 41,
            order_date: "2025-11-13T00:00:00.000Z",
            total_amount: "4500",
            status: "READY_FOR_DELIVERY",
            subscription_id: 23,
            customer: {
              person_id: 29,
              name: "elsa moro",
              phone: "3624950203",
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
              special_instructions: "{\"delivery_preferences\":{\"special_instructions\":\"timbre 6W\",\"preferred_days\":[\"MONDAY\",\"WEDNESDAY\",\"FRIDAY\"],\"preferred_time_range\":\"08:00-12:00\",\"avoid_times\":[\"08:00-12:00\"]}}"
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
        },
          {
          route_sheet_detail_id: 42,
          route_sheet_id: 23,
          order: {
            order_id: 41,
            order_date: "2025-11-13T00:00:00.000Z",
            total_amount: "4500",
            status: "READY_FOR_DELIVERY",
            subscription_id: 23,
            customer: {
              person_id: 29,
              name: "elsa moro",
              phone: "3624950203",
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
              special_instructions: "{\"delivery_preferences\":{\"special_instructions\":\"timbre 6W\",\"preferred_days\":[\"MONDAY\",\"WEDNESDAY\",\"FRIDAY\"],\"preferred_time_range\":\"08:00-12:00\",\"avoid_times\":[\"08:00-12:00\"]}}"
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
        },
        {
          route_sheet_detail_id: 42,
          route_sheet_id: 23,
          order: {
            order_id: 41,
            order_date: "2025-11-13T00:00:00.000Z",
            total_amount: "4500",
            status: "READY_FOR_DELIVERY",
            subscription_id: 23,
            customer: {
              person_id: 29,
              name: "elsa moro",
              phone: "3624950203",
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
              special_instructions: "{\"delivery_preferences\":{\"special_instructions\":\"timbre 6W\",\"preferred_days\":[\"MONDAY\",\"WEDNESDAY\",\"FRIDAY\"],\"preferred_time_range\":\"08:00-12:00\",\"avoid_times\":[\"08:00-12:00\"]}}"
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
        },
        {
          route_sheet_detail_id: 42,
          route_sheet_id: 23,
          order: {
            order_id: 41,
            order_date: "2025-11-13T00:00:00.000Z",
            total_amount: "4500",
            status: "READY_FOR_DELIVERY",
            subscription_id: 23,
            customer: {
              person_id: 29,
              name: "elsa moro",
              phone: "3624950203",
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
              special_instructions: "{\"delivery_preferences\":{\"special_instructions\":\"timbre 6W\",\"preferred_days\":[\"MONDAY\",\"WEDNESDAY\",\"FRIDAY\"],\"preferred_time_range\":\"08:00-12:00\",\"avoid_times\":[\"08:00-12:00\"]}}"
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
        },
        {
          route_sheet_detail_id: 42,
          route_sheet_id: 23,
          order: {
            order_id: 41,
            order_date: "2025-11-13T00:00:00.000Z",
            total_amount: "4500",
            status: "READY_FOR_DELIVERY",
            subscription_id: 23,
            customer: {
              person_id: 29,
              name: "elsa moro",
              phone: "3624950203",
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
              special_instructions: "{\"delivery_preferences\":{\"special_instructions\":\"timbre 6W\",\"preferred_days\":[\"MONDAY\",\"WEDNESDAY\",\"FRIDAY\"],\"preferred_time_range\":\"08:00-12:00\",\"avoid_times\":[\"08:00-12:00\"]}}"
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
        },
        {
          route_sheet_detail_id: 42,
          route_sheet_id: 23,
          order: {
            order_id: 41,
            order_date: "2025-11-13T00:00:00.000Z",
            total_amount: "4500",
            status: "READY_FOR_DELIVERY",
            subscription_id: 23,
            customer: {
              person_id: 29,
              name: "elsa moro",
              phone: "3624950203",
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
              special_instructions: "{\"delivery_preferences\":{\"special_instructions\":\"timbre 6W\",\"preferred_days\":[\"MONDAY\",\"WEDNESDAY\",\"FRIDAY\"],\"preferred_time_range\":\"08:00-12:00\",\"avoid_times\":[\"08:00-12:00\"]}}"
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
        },
        {
          route_sheet_detail_id: 43,
          route_sheet_id: 23,
          order: {
            order_id: 42,
            order_date: "2025-11-13T00:00:00.000Z",
            total_amount: "3200",
            status: "READY_FOR_DELIVERY",
            subscription_id: 24,
            customer: {
              person_id: 30,
              name: "daiana gonzalez",
              alias: "Llano Studio",
              phone: "3624958393",
              address: "san martin 450",
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
              special_instructions: "{\"delivery_preferences\":{\"special_instructions\":\"portón verde\",\"preferred_days\":[\"MONDAY\",\"WEDNESDAY\",\"FRIDAY\"],\"preferred_time_range\":\"14:00-18:00\",\"avoid_times\":[\"15:00-18:00\"]}}"
            },
            items: [
              {
                order_item_id: 59,
                product: {
                  product_id: 9,
                  description: "bidon 12 LTS"
                },
                quantity: 4,
                delivered_quantity: 0,
                returned_quantity: 0
              }
            ],
            notes: "casa con rejas"
          },
          delivery_status: "PENDING",
          delivery_time: "14:00-18:00",
          is_current_delivery: false,
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
          route_sheet_detail_id: 44,
          route_sheet_id: 23,
          order: {
            order_id: 43,
            order_date: "2025-11-13T00:00:00.000Z",
            total_amount: "5800",
            status: "READY_FOR_DELIVERY",
            subscription_id: 25,
            customer: {
              person_id: 31,
              name: "santiago valussi",
              phone: "3624777888",
              address: "moreno 789",
              zone: {
                zone_id: 12,
                code: "z-3-res",
                name: "zona 3"
              },
              locality: {
                locality_id: 1,
                code: "RES",
                name: "Resistencia"
              },
              special_instructions: "{\"delivery_preferences\":{\"special_instructions\":\"departamento 2B\",\"preferred_days\":[\"MONDAY\",\"WEDNESDAY\",\"FRIDAY\"],\"preferred_time_range\":\"09:00-13:00\",\"avoid_times\":[\"12:00-14:00\"]}}"
            },
            items: [
              {
                order_item_id: 60,
                product: {
                  product_id: 10,
                  description: "bidon 20 LTS"
                },
                quantity: 8,
                delivered_quantity: 0,
                returned_quantity: 0
              }
            ],
            notes: "interfono roto"
          },
          delivery_status: "PENDING",
          delivery_time: "09:00-13:00",
          is_current_delivery: false,
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
