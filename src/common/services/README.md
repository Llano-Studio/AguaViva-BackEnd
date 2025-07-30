# PdfGeneratorService

Este servicio proporciona funcionalidades para generar PDFs con diseños modernos y reutilizables en toda la aplicación.

## Características

- ✅ Diseño moderno y atractivo
- ✅ Colores personalizables
- ✅ Opciones configurables
- ✅ Reutilizable en múltiples módulos
- ✅ Separación de responsabilidades

## Uso Básico

```typescript
import { PdfGeneratorService, RouteSheetPdfData } from '../common/services/pdf-generator.service';

@Injectable()
export class MiServicio {
  constructor(private readonly pdfGeneratorService: PdfGeneratorService) {}

  async generarPdf() {
    const pdfData: RouteSheetPdfData = {
      route_sheet_id: 1,
      delivery_date: '2024-01-15',
      driver: {
        name: 'Juan Pérez',
        email: 'juan@example.com'
      },
      vehicle: {
        code: 'TRK-001',
        name: 'Camión Mercedes'
      },
      route_notes: 'Ruta por zona norte',
      details: [
        {
          order: {
            order_id: 123,
            customer: {
              name: 'Cliente A',
              address: 'Av. Rivadavia 1234',
              phone: '+541155556666'
            },
            items: [
              {
                quantity: 2,
                product: {
                  description: 'Botellón de agua 20L'
                }
              }
            ]
          },
          delivery_status: 'PENDING'
        }
      ]
    };

    const options = {
      includeSignatureField: true,
      includeProductDetails: true,
      customColors: {
        primary: '#2563eb',
        secondary: '#64748b',
        accent: '#f59e0b',
        lightGray: '#f1f5f9'
      }
    };

    const { doc, filename, pdfPath } = await this.pdfGeneratorService.generateRouteSheetPdf(pdfData, options);
    const writeStream = fs.createWriteStream(pdfPath);
    doc.pipe(writeStream);
    
    const result = await this.pdfGeneratorService.finalizePdf(doc, writeStream, filename);
    return result;
  }
}
```

## Opciones Disponibles

### PdfGenerationOptions

```typescript
interface PdfGenerationOptions {
  includeMap?: boolean;                    // Incluir mapa (futuro)
  includeSignatureField?: boolean;         // Incluir campos de firma
  includeProductDetails?: boolean;         // Incluir detalles de productos
  customColors?: {                         // Colores personalizados
    primary?: string;                      // Color principal
    secondary?: string;                    // Color secundario
    accent?: string;                       // Color de acento
    lightGray?: string;                    // Color gris claro
  };
}
```

## Estados de Entrega

El servicio incluye colores automáticos para los estados:

- 🟢 **Entregado/Delivered**: Verde (#10b981)
- 🟠 **Pendiente/Pending**: Naranja (#f59e0b)
- 🔴 **Cancelado/Cancelled**: Rojo (#ef4444)
- 🔵 **En Ruta/In Route**: Azul (#3b82f6)
- ⚪ **Otros**: Gris (#64748b)

## Estructura del PDF

1. **Encabezado**: Título principal con fondo azul
2. **Información de Fecha**: Esquina superior derecha
3. **Tarjetas de Información**: Conductor y vehículo
4. **Notas de Ruta**: Sección destacada (si existen)
5. **Tabla de Pedidos**: Con estados coloreados
6. **Detalles de Productos**: Lista expandible
7. **Campos de Firma**: Para conductor y supervisor
8. **Pie de Página**: Información de generación

## Beneficios de la Separación

- **Reutilización**: Otros módulos pueden usar el mismo servicio
- **Mantenibilidad**: Cambios de diseño centralizados
- **Testabilidad**: Fácil de probar de forma aislada
- **Escalabilidad**: Fácil agregar nuevos tipos de PDF
- **Consistencia**: Diseño uniforme en toda la aplicación 