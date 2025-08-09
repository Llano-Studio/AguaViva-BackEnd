import { Injectable, NotFoundException, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';

interface CreateIncidentDto {
  route_sheet_detail_id: number;
  incident_type: string;
  description: string;
  created_by: number;
}

interface ResolveIncidentDto {
  incident_id: number;
  resolution: string;
  resolved_by: number;
}

interface IncidentResponseDto {
  incident_id: number;
  route_sheet_detail_id: number;
  incident_type: string;
  description: string;
  status: string;
  created_at: string;
  created_by: number;
  resolution?: string;
  resolved_at?: string;
  resolved_by?: number;
  creator_name?: string;
  resolver_name?: string;
  order_info?: {
    order_id: number;
    customer_name: string;
    customer_address: string;
  };
}

@Injectable()
export class IncidentService extends PrismaClient {
  
  /**
   * Registra una nueva incidencia durante una entrega
   */
  async reportIncident(createDto: CreateIncidentDto): Promise<IncidentResponseDto> {
    const { route_sheet_detail_id, incident_type, description, created_by } = createDto;
    
    try {
      // 1. Verificar que el detalle existe
      const detail = await this.route_sheet_detail.findUnique({
        where: { route_sheet_detail_id },
        include: {
          order_header: {
            include: {
              customer: true
            }
          }
        }
      });
      
      if (!detail) {
        throw new NotFoundException(`Detalle de hoja de ruta con ID ${route_sheet_detail_id} no encontrado`);
      }
      
      // 2. Verificar que el usuario existe
      const user = await this.user.findUnique({
        where: { id: created_by }
      });
      
      if (!user) {
        throw new NotFoundException(`Usuario con ID ${created_by} no encontrado`);
      }
      
      // 3. Crear la incidencia
      const incident = await this.delivery_incident.create({
        data: {
          route_sheet_detail_id,
          incident_type,
          description,
          created_by,
          status: 'PENDING'
        },
        include: {
          creator: true,
          route_sheet_detail: {
            include: {
              order_header: {
                include: {
                  customer: true
                }
              },
              one_off_purchase: {
                include: {
                  person: true
                }
              },
              one_off_purchase_header: {
                include: {
                  person: true
                }
              }
            }
          }
        }
      });
      
      // 4. Actualizar el estado del detalle si es necesario
      if (incident_type === 'CLIENT_ABSENT' || incident_type === 'ACCESS_ISSUE') {
        await this.route_sheet_detail.update({
          where: { route_sheet_detail_id },
          data: {
            delivery_status: 'FAILED',
            comments: description
          }
        });
      }
      
      // 5. Retornar la respuesta
      return {
        incident_id: incident.incident_id,
        route_sheet_detail_id: incident.route_sheet_detail_id,
        incident_type: incident.incident_type,
        description: incident.description,
        status: incident.status,
        created_at: incident.created_at.toISOString(),
        created_by: incident.created_by,
        creator_name: incident.creator.name,
        order_info: {
          order_id: incident.route_sheet_detail.order_header?.order_id || 
                   incident.route_sheet_detail.one_off_purchase?.purchase_id || 
                   incident.route_sheet_detail.one_off_purchase_header?.purchase_header_id || 
                   0,
          customer_name: incident.route_sheet_detail.order_header?.customer?.name || 
                        incident.route_sheet_detail.one_off_purchase?.person?.name || 
                        incident.route_sheet_detail.one_off_purchase_header?.person?.name || 
                        'Sin nombre',
          customer_address: incident.route_sheet_detail.order_header?.customer?.address || 
                           incident.route_sheet_detail.one_off_purchase?.person?.address || 
                           incident.route_sheet_detail.one_off_purchase_header?.person?.address || 
                           'Sin dirección'
        }
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      console.error('Error al reportar incidencia:', error);
      throw new InternalServerErrorException('Error al reportar incidencia');
    }
  }
  
  /**
   * Marca una incidencia como resuelta
   */
  async resolveIncident(resolveDto: ResolveIncidentDto): Promise<IncidentResponseDto> {
    const { incident_id, resolution, resolved_by } = resolveDto;
    
    try {
      // 1. Verificar que la incidencia existe
      const incident = await this.delivery_incident.findUnique({
        where: { incident_id },
        include: {
          route_sheet_detail: true
        }
      });
      
      if (!incident) {
        throw new NotFoundException(`Incidencia con ID ${incident_id} no encontrada`);
      }
      
      // 2. Verificar que no esté ya resuelta
      if (incident.status === 'RESOLVED') {
        throw new BadRequestException(`La incidencia con ID ${incident_id} ya está resuelta`);
      }
      
      // 3. Verificar que el usuario resolutor existe
      const user = await this.user.findUnique({
        where: { id: resolved_by }
      });
      
      if (!user) {
        throw new NotFoundException(`Usuario con ID ${resolved_by} no encontrado`);
      }
      
      // 4. Actualizar la incidencia
      const updatedIncident = await this.delivery_incident.update({
        where: { incident_id },
        data: {
          status: 'RESOLVED',
          resolution,
          resolved_by,
          resolved_at: new Date()
        },
        include: {
          creator: true,
          resolver: true,
          route_sheet_detail: {
            include: {
              order_header: {
                include: {
                  customer: true
                }
              },
              one_off_purchase: {
                include: {
                  person: true
                }
              },
              one_off_purchase_header: {
                include: {
                  person: true
                }
              }
            }
          }
        }
      });
      
      // 5. Extraer información del pedido
      const detail = updatedIncident.route_sheet_detail;
      let orderId: number;
      let customerName: string;
      let customerAddress: string;

      if (detail.order_header) {
        orderId = detail.order_header.order_id;
        customerName = detail.order_header.customer.name || 'Sin nombre';
        customerAddress = detail.order_header.customer.address || 'Sin dirección';
      } else if (detail.one_off_purchase) {
        orderId = detail.one_off_purchase.purchase_id;
        customerName = detail.one_off_purchase.person.name || 'Sin nombre';
        customerAddress = detail.one_off_purchase.delivery_address || detail.one_off_purchase.person.address || 'Sin dirección';
      } else if (detail.one_off_purchase_header) {
        orderId = detail.one_off_purchase_header.purchase_header_id;
        customerName = detail.one_off_purchase_header.person.name || 'Sin nombre';
        customerAddress = detail.one_off_purchase_header.delivery_address || detail.one_off_purchase_header.person.address || 'Sin dirección';
      } else {
        orderId = 0;
        customerName = 'Sin nombre';
        customerAddress = 'Sin dirección';
      }

      // 6. Retornar la respuesta
      return {
        incident_id: updatedIncident.incident_id,
        route_sheet_detail_id: updatedIncident.route_sheet_detail_id,
        incident_type: updatedIncident.incident_type,
        description: updatedIncident.description,
        status: updatedIncident.status,
        created_at: updatedIncident.created_at.toISOString(),
        created_by: updatedIncident.created_by,
        resolution: updatedIncident.resolution || undefined,
        resolved_at: updatedIncident.resolved_at?.toISOString(),
        resolved_by: updatedIncident.resolved_by || undefined,
        creator_name: updatedIncident.creator.name,
        resolver_name: updatedIncident.resolver?.name,
        order_info: {
          order_id: orderId,
          customer_name: customerName,
          customer_address: customerAddress
        }
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      console.error('Error al resolver incidencia:', error);
      throw new InternalServerErrorException('Error al resolver incidencia');
    }
  }
  
  /**
   * Obtiene todas las incidencias pendientes
   */
  async getPendingIncidents(): Promise<IncidentResponseDto[]> {
    try {
      const incidents: Array<{
        incident_id: number;
        route_sheet_detail_id: number;
        incident_type: string;
        description: string;
        status: string;
        created_at: Date;
        created_by: number;
        resolution: string | null;
        resolved_at: Date | null;
        resolved_by: number | null;
        creator: { name: string };
        resolver: { name: string } | null;
        route_sheet_detail: {
          order_header: {
            order_id: number;
            customer: { name: string | null; address: string | null };
          } | null;
          one_off_purchase: {
             purchase_id: number;
             person: { name: string | null; address: string | null };
             delivery_address: string | null;
           } | null;
           one_off_purchase_header: {
             purchase_header_id: number;
             person: { name: string | null; address: string | null };
             delivery_address: string | null;
           } | null;
        };
      }> = await this.delivery_incident.findMany({
        where: { status: 'PENDING' },
        include: {
          creator: true,
          resolver: true,
          route_sheet_detail: {
            include: {
              order_header: {
                include: {
                  customer: true
                }
              },
              one_off_purchase: {
                include: {
                  person: true
                }
              },
              one_off_purchase_header: {
                include: {
                  person: true
                }
              }
            }
          }
        },
        orderBy: { created_at: 'desc' }
      });
      
      return incidents.map(incident => {
        const detail = incident.route_sheet_detail;
        let orderId: number;
        let customerName: string;
        let customerAddress: string;

        if (detail.order_header) {
          orderId = detail.order_header.order_id;
          customerName = detail.order_header.customer.name || 'Sin nombre';
          customerAddress = detail.order_header.customer.address || 'Sin dirección';
        } else if (detail.one_off_purchase) {
          orderId = detail.one_off_purchase.purchase_id;
          customerName = detail.one_off_purchase.person.name || 'Sin nombre';
          customerAddress = detail.one_off_purchase.delivery_address || detail.one_off_purchase.person.address || 'Sin dirección';
        } else if (detail.one_off_purchase_header) {
          orderId = detail.one_off_purchase_header.purchase_header_id;
          customerName = detail.one_off_purchase_header.person.name || 'Sin nombre';
          customerAddress = detail.one_off_purchase_header.delivery_address || detail.one_off_purchase_header.person.address || 'Sin dirección';
        } else {
          orderId = 0;
          customerName = 'Sin nombre';
          customerAddress = 'Sin dirección';
        }

        return {
          incident_id: incident.incident_id,
          route_sheet_detail_id: incident.route_sheet_detail_id,
          incident_type: incident.incident_type,
          description: incident.description,
          status: incident.status,
          created_at: incident.created_at.toISOString(),
          created_by: incident.created_by,
          creator_name: incident.creator.name,
          resolver_name: incident.resolver?.name,
          order_info: {
            order_id: orderId,
            customer_name: customerName,
            customer_address: customerAddress
          }
        };
      });
    } catch (error) {
      console.error('Error al obtener incidencias pendientes:', error);
      throw new InternalServerErrorException('Error al obtener incidencias pendientes');
    }
  }
  
  /**
   * Obtiene el historial de incidencias de un cliente
   */
  async getClientIncidentHistory(clientId: number): Promise<IncidentResponseDto[]> {
    try {
      // Buscar incidencias donde el cliente coincida
      const incidents: Array<{
        incident_id: number;
        route_sheet_detail_id: number;
        incident_type: string;
        description: string;
        status: string;
        created_at: Date;
        created_by: number;
        resolution: string | null;
        resolved_at: Date | null;
        resolved_by: number | null;
        creator: { name: string };
        resolver: { name: string } | null;
        route_sheet_detail: {
          order_header: {
            order_id: number;
            customer: { name: string | null; address: string | null };
          } | null;
          one_off_purchase: {
            purchase_id: number;
            person: { name: string | null; address: string | null };
            delivery_address: string | null;
          } | null;
          one_off_purchase_header: {
            purchase_header_id: number;
            person: { name: string | null; address: string | null };
            delivery_address: string | null;
          } | null;
        };
      }> = await this.delivery_incident.findMany({
        where: {
          OR: [
            {
              route_sheet_detail: {
                order_header: {
                  customer_id: clientId
                }
              }
            },
            {
              route_sheet_detail: {
                one_off_purchase: {
                  person_id: clientId
                }
              }
            },
            {
              route_sheet_detail: {
                one_off_purchase_header: {
                  person_id: clientId
                }
              }
            }
          ]
        },
        include: {
          creator: true,
          resolver: true,
          route_sheet_detail: {
            include: {
              order_header: {
                include: {
                  customer: true
                }
              },
              one_off_purchase: {
                include: {
                  person: true
                }
              },
              one_off_purchase_header: {
                include: {
                  person: true
                }
              }
            }
          }
        },
        orderBy: { created_at: 'desc' }
      });
      
      return incidents.map(incident => {
        const detail = incident.route_sheet_detail;
        let orderId: number;
        let customerName: string;
        let customerAddress: string;

        if (detail.order_header) {
          orderId = detail.order_header.order_id;
          customerName = detail.order_header.customer.name || 'Sin nombre';
          customerAddress = detail.order_header.customer.address || 'Sin dirección';
        } else if (detail.one_off_purchase) {
          orderId = detail.one_off_purchase.purchase_id;
          customerName = detail.one_off_purchase.person.name || 'Sin nombre';
          customerAddress = detail.one_off_purchase.delivery_address || detail.one_off_purchase.person.address || 'Sin dirección';
        } else if (detail.one_off_purchase_header) {
          orderId = detail.one_off_purchase_header.purchase_header_id;
          customerName = detail.one_off_purchase_header.person.name || 'Sin nombre';
          customerAddress = detail.one_off_purchase_header.delivery_address || detail.one_off_purchase_header.person.address || 'Sin dirección';
        } else {
          orderId = 0;
          customerName = 'Sin nombre';
          customerAddress = 'Sin dirección';
        }

        return {
          incident_id: incident.incident_id,
          route_sheet_detail_id: incident.route_sheet_detail_id,
          incident_type: incident.incident_type,
          description: incident.description,
          status: incident.status,
          created_at: incident.created_at.toISOString(),
          created_by: incident.created_by,
          resolution: incident.resolution || undefined,
          resolved_at: incident.resolved_at?.toISOString(),
          resolved_by: incident.resolved_by || undefined,
          creator_name: incident.creator.name,
          resolver_name: incident.resolver?.name,
          order_info: {
            order_id: orderId,
            customer_name: customerName,
            customer_address: customerAddress
          }
        };
      });
    } catch (error) {
      console.error(`Error al obtener historial de incidencias del cliente ${clientId}:`, error);
      throw new InternalServerErrorException(`Error al obtener historial de incidencias del cliente ${clientId}`);
    }
  }
  
  /**
   * Obtiene las estadísticas de incidencias
   */
  async getIncidentStats(): Promise<any> {
    try {
      // Contar incidencias por tipo
      const incidentsByType = await this.delivery_incident.groupBy({
        by: ['incident_type'],
        _count: {
          incident_id: true
        }
      });
      
      // Contar incidencias por estado
      const incidentsByStatus = await this.delivery_incident.groupBy({
        by: ['status'],
        _count: {
          incident_id: true
        }
      });
      
      // Obtener tiempo promedio de resolución para incidencias resueltas
      const resolvedIncidents = await this.delivery_incident.findMany({
        where: {
          status: 'RESOLVED',
          resolved_at: { not: null }
        },
        select: {
          created_at: true,
          resolved_at: true
        }
      });
      
      let avgResolutionTimeHours = 0;
      
      if (resolvedIncidents.length > 0) {
        const totalHours = resolvedIncidents.reduce((sum, incident) => {
          if (incident.resolved_at) {
            const diffMs = incident.resolved_at.getTime() - incident.created_at.getTime();
            const diffHours = diffMs / (1000 * 60 * 60);
            return sum + diffHours;
          }
          return sum;
        }, 0);
        
        avgResolutionTimeHours = totalHours / resolvedIncidents.length;
      }
      
      // Retornar estadísticas
      return {
        total_incidents: await this.delivery_incident.count(),
        pending_incidents: await this.delivery_incident.count({ where: { status: 'PENDING' } }),
        resolved_incidents: await this.delivery_incident.count({ where: { status: 'RESOLVED' } }),
        by_type: incidentsByType.map(it => ({
          type: it.incident_type,
          count: it._count.incident_id
        })),
        by_status: incidentsByStatus.map(it => ({
          status: it.status,
          count: it._count.incident_id
        })),
        avg_resolution_time_hours: avgResolutionTimeHours.toFixed(2)
      };
    } catch (error) {
      console.error('Error al obtener estadísticas de incidencias:', error);
      throw new InternalServerErrorException('Error al obtener estadísticas de incidencias');
    }
  }
}