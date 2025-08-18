import { Injectable, NotFoundException, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import { CreateRouteOptimizationDto, RouteOptimizationResponseDto, WaypointDto } from '../dto/route-optimization.dto';

@Injectable()
export class RouteOptimizationService extends PrismaClient {
  
  /**
   * Optimiza una ruta calculando el orden óptimo de entrega
   */
  async optimizeRoute(createDto: CreateRouteOptimizationDto): Promise<RouteOptimizationResponseDto> {
    const { route_sheet_id, optimize_by_time, consider_traffic } = createDto;

    try {
      // 1. Verificar que la hoja de ruta existe
      const routeSheet = await this.route_sheet.findUnique({
        where: { route_sheet_id },
        include: {
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

      if (!routeSheet) {
        throw new NotFoundException(`Hoja de ruta con ID ${route_sheet_id} no encontrada`);
      }

      // 2. Obtener y preparar los puntos de entrega
      const waypoints: WaypointDto[] = [];
      
      // Agregar punto de inicio si se proporciona
      if (createDto.start_point) {
        waypoints.push(createDto.start_point);
      } else {
        // Agregar un punto de inicio predeterminado (ubicación de la empresa)
        waypoints.push({
          lat: -34.603722,  // Estos valores serían la ubicación de la empresa
          lng: -58.381592,
          address: 'Depósito Central'
        });
      }
      
      // Agregar los puntos de entrega
      for (const detail of routeSheet.route_sheet_detail) {
        // En un sistema real, aquí habría una llamada a un servicio de geocodificación
        // para obtener las coordenadas a partir de la dirección si no existen
        
        // Para este ejemplo, generamos coordenadas ficticias cercanas al punto de inicio
        const randomLat = -34.603722 + (Math.random() - 0.5) * 0.1;
        const randomLng = -58.381592 + (Math.random() - 0.5) * 0.1;
        
        let customerAddress = 'Dirección desconocida';
        if (detail.order_header) {
          customerAddress = detail.order_header.customer.address || 'Dirección desconocida';
        } else if (detail.one_off_purchase) {
          customerAddress = detail.one_off_purchase.delivery_address || detail.one_off_purchase.person.address || 'Dirección desconocida';
        } else if (detail.one_off_purchase_header) {
          customerAddress = detail.one_off_purchase_header.delivery_address || detail.one_off_purchase_header.person.address || 'Dirección desconocida';
        }
        
        waypoints.push({
          lat: detail.lat ? Number(detail.lat) : randomLat,
          lng: detail.lng ? Number(detail.lng) : randomLng,
          route_sheet_detail_id: detail.route_sheet_detail_id,
          address: customerAddress
        });
      }
      
      // Agregar punto final si se proporciona (o usar el mismo que el inicio)
      if (createDto.end_point) {
        waypoints.push(createDto.end_point);
      } else if (createDto.start_point) {
        waypoints.push(createDto.start_point);
      } else {
        // Reutilizar el punto de inicio predeterminado
        waypoints.push({
          lat: -34.603722,
          lng: -58.381592,
          address: 'Depósito Central'
        });
      }

      // 3. En un sistema real, aquí llamaríamos a un servicio externo de optimización de rutas
      // como Google Maps Directions API, GraphHopper, OSRM, etc.
      // Para esta implementación, simulamos una optimización
      
      // Ordenar los waypoints (simplemente por distancia al punto anterior, para simular)
      const optimizedWaypoints = this.simulateRouteOptimization(waypoints, optimize_by_time || true);
      
      // 4. Calcular distancia y duración estimada
      const estimatedDistance = this.calculateTotalDistance(optimizedWaypoints);
      const estimatedDuration = this.calculateEstimatedDuration(estimatedDistance, consider_traffic || true);
      
      // 5. Guardar la optimización en la base de datos
      const optimization = await this.route_optimization.create({
        data: {
          route_sheet_id,
          estimated_duration: estimatedDuration,
          estimated_distance: estimatedDistance,
          optimization_status: 'COMPLETED',
          waypoints: optimizedWaypoints as any,
        }
      });
      
      // 6. Actualizar los detalles de la hoja de ruta con el orden optimizado
      await this.updateRouteSheetDetailsWithOptimizedSequence(
        route_sheet_id,
        optimizedWaypoints.filter(wp => wp.route_sheet_detail_id)
      );
      
      return new RouteOptimizationResponseDto({
        optimization_id: optimization.optimization_id,
        route_sheet_id: optimization.route_sheet_id,
        estimated_duration: optimization.estimated_duration,
        estimated_distance: Number(optimization.estimated_distance),
        optimization_status: optimization.optimization_status,
        waypoints: optimizedWaypoints,
        created_at: optimization.created_at.toISOString()
      });
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error('Error al optimizar la ruta:', error);
      throw new InternalServerErrorException('Error al optimizar la ruta');
    }
  }
  
  /**
   * Obtiene la última optimización de una hoja de ruta
   */
  async getRouteOptimization(route_sheet_id: number): Promise<RouteOptimizationResponseDto> {
    const optimization = await this.route_optimization.findFirst({
      where: { route_sheet_id },
      orderBy: { created_at: 'desc' }
    });
    
    if (!optimization) {
      throw new NotFoundException(`No se encontró optimización para la hoja de ruta ${route_sheet_id}`);
    }
    
    return new RouteOptimizationResponseDto({
      optimization_id: optimization.optimization_id,
      route_sheet_id: optimization.route_sheet_id,
      estimated_duration: optimization.estimated_duration,
      estimated_distance: Number(optimization.estimated_distance),
      optimization_status: optimization.optimization_status,
      waypoints: optimization.waypoints as any,
      created_at: optimization.created_at.toISOString()
    });
  }
  
  /**
   * Actualiza los detalles de la hoja de ruta con los números de secuencia optimizados
   */
  private async updateRouteSheetDetailsWithOptimizedSequence(
    route_sheet_id: number,
    waypoints: WaypointDto[]
  ): Promise<void> {
    // Aquí tendríamos que actualizar cada uno de los route_sheet_detail con su número de secuencia
    // y posiblemente también el tiempo estimado de llegada
    for (let i = 0; i < waypoints.length; i++) {
      const wp = waypoints[i];
      if (wp.route_sheet_detail_id) {
        await this.route_sheet_detail.update({
          where: { route_sheet_detail_id: wp.route_sheet_detail_id },
          data: {
            sequence_number: i + 1,
            lat: wp.lat as any,
            lng: wp.lng as any,
            // Aquí calcularíamos el tiempo estimado de llegada basado en la hora de inicio
            // y la duración acumulada hasta este punto
          }
        });
      }
    }
  }
  
  /**
   * Simula una optimización de ruta (en un sistema real usaríamos un servicio externo)
   */
  private simulateRouteOptimization(waypoints: WaypointDto[], optimizeByTime: boolean): WaypointDto[] {
    // Conservar el primero y el último punto
    const start = waypoints[0];
    const end = waypoints[waypoints.length - 1];
    
    // Optimizar solo los puntos intermedios
    const pointsToOptimize = waypoints.slice(1, waypoints.length - 1);
    
    // Algoritmo del vecino más cercano
    const optimizedMiddlePoints: WaypointDto[] = [];
    let currentPoint = start;
    
    while (pointsToOptimize.length > 0) {
      let nextPointIndex = 0;
      let minDistance = Infinity;
      
      for (let i = 0; i < pointsToOptimize.length; i++) {
        const distance = this.calculateDistance(
          currentPoint.lat, currentPoint.lng,
          pointsToOptimize[i].lat, pointsToOptimize[i].lng
        );
        
        if (distance < minDistance) {
          minDistance = distance;
          nextPointIndex = i;
        }
      }
      
      currentPoint = pointsToOptimize[nextPointIndex];
      optimizedMiddlePoints.push(currentPoint);
      pointsToOptimize.splice(nextPointIndex, 1);
    }
    
    // Devolver la ruta completa optimizada
    return [start, ...optimizedMiddlePoints, end];
  }
  
  /**
   * Calcula la distancia entre dos puntos usando la fórmula de Haversine
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radio de la Tierra en km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distancia en km
    return distance;
  }
  
  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }
  
  /**
   * Calcula la distancia total de la ruta
   */
  private calculateTotalDistance(waypoints: WaypointDto[]): number {
    let totalDistance = 0;
    
    for (let i = 0; i < waypoints.length - 1; i++) {
      totalDistance += this.calculateDistance(
        waypoints[i].lat, waypoints[i].lng,
        waypoints[i + 1].lat, waypoints[i + 1].lng
      );
    }
    
    return parseFloat(totalDistance.toFixed(2));
  }
  
  /**
   * Calcula la duración estimada de la ruta en minutos
   */
  private calculateEstimatedDuration(distanceKm: number, considerTraffic: boolean): number {
    // Velocidad promedio estimada en km/h (menor si consideramos tráfico)
    const avgSpeed = considerTraffic ? 30 : 45;
    
    // Tiempo en horas
    const timeHours = distanceKm / avgSpeed;
    
    // Convertir a minutos y añadir tiempo para cada parada (promedio 5 minutos por entrega)
    const deliveryStops = 5; // En un caso real, calcularíamos el número exacto de entregas
    const stopTimeMinutes = deliveryStops * 5;
    
    const totalMinutes = Math.round(timeHours * 60) + stopTimeMinutes;
    
    return totalMinutes;
  }
}