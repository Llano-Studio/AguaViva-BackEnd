import { Injectable } from '@nestjs/common';
import { BUSINESS_CONFIG } from '../config/business.config';

export interface TimeSlot {
  start: string;
  end: string;
  label: string;
}

export interface DeliveryScheduleValidation {
  isValid: boolean;
  message?: string;
  suggestedDate?: Date;
  suggestedTimeSlot?: string;
}

@Injectable()
export class ScheduleService {
  /**
   * Convierte un horario en formato "HH:MM" a minutos desde medianoche
   */
  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Convierte minutos desde medianoche a formato "HH:MM"
   */
  private minutesToTime(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  /**
   * Parsea un horario en formato "HH:MM-HH:MM" o "HH:MM"
   */
  parseTimeSlot(timeString: string): TimeSlot | null {
    if (!timeString) return null;

    // Formato de rango: "14:00-16:00"
    if (timeString.includes('-')) {
      const [start, end] = timeString.split('-');
      if (this.isValidTime(start) && this.isValidTime(end)) {
        return {
          start: start.trim(),
          end: end.trim(),
          label: timeString,
        };
      }
    }

    // Formato simple: "14:00"
    if (this.isValidTime(timeString)) {
      return {
        start: timeString.trim(),
        end: this.addHours(timeString.trim(), 2), // Asume 2 horas de ventana
        label: timeString,
      };
    }

    return null;
  }

  /**
   * Valida si una cadena está en formato HH:MM válido
   */
  private isValidTime(time: string): boolean {
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(time.trim());
  }

  /**
   * Añade horas a un tiempo en formato HH:MM
   */
  private addHours(time: string, hours: number): string {
    const [h, m] = time.split(':').map(Number);
    const date = new Date();
    date.setHours(h, m, 0, 0);
    date.setHours(date.getHours() + hours);

    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  }

  /**
   * Obtiene todos los horarios disponibles para entrega
   */
  getAvailableTimeSlots(): TimeSlot[] {
    return BUSINESS_CONFIG.DELIVERY_SCHEDULE.AVAILABLE_TIME_SLOTS.map(
      (slot) => {
        const parsed = this.parseTimeSlot(slot);
        return parsed || { start: '08:00', end: '10:00', label: slot };
      },
    );
  }

  /**
   * Valida si un horario está dentro de los slots disponibles
   * MODIFICADO: Ahora permite cualquier horario dentro de la franja completa de trabajo
   */
  isTimeSlotAvailable(timeString: string): boolean {
    const requestedSlot = this.parseTimeSlot(timeString);
    if (!requestedSlot) return false;

    const availableSlots = this.getAvailableTimeSlots();

    // Convertir horarios a minutos para facilitar comparaciones
    const requestedStartMinutes = this.timeToMinutes(requestedSlot.start);
    const requestedEndMinutes = this.timeToMinutes(requestedSlot.end);

    // Verificar si el horario solicitado está completamente dentro de la franja disponible
    return availableSlots.some((slot) => {
      const slotStartMinutes = this.timeToMinutes(slot.start);
      const slotEndMinutes = this.timeToMinutes(slot.end);

      // El horario solicitado debe estar completamente dentro de la franja disponible
      return (
        requestedStartMinutes >= slotStartMinutes &&
        requestedEndMinutes <= slotEndMinutes
      );
    });
  }

  /**
   * Valida si una fecha es un día hábil
   */
  isWorkingDay(date: Date): boolean {
    const dayOfWeek = date.getDay();
    return BUSINESS_CONFIG.DELIVERY_SCHEDULE.WORKING_DAYS.includes(
      dayOfWeek as any,
    );
  }

  /**
   * Valida si una fecha de entrega cumple con los requisitos mínimos y máximos
   * @param orderDate Fecha del pedido
   * @param deliveryDate Fecha de entrega propuesta
   * @param allowPastDates Si es true, permite fechas pasadas (solo para SUPERADMIN)
   */
  validateDeliveryDate(
    orderDate: Date,
    deliveryDate: Date,
    allowPastDates: boolean = false,
  ): DeliveryScheduleValidation {
    const now = new Date();
    const minDate = new Date(
      now.getTime() +
        BUSINESS_CONFIG.DELIVERY_SCHEDULE.MINIMUM_ADVANCE_HOURS *
          60 *
          60 *
          1000,
    );
    const maxDate = new Date(
      now.getTime() +
        BUSINESS_CONFIG.DELIVERY_SCHEDULE.MAXIMUM_ADVANCE_DAYS *
          24 *
          60 *
          60 *
          1000,
    );

    // Validar que la fecha de entrega sea igual o posterior a la fecha del pedido
    if (deliveryDate < orderDate) {
      return {
        isValid: false,
        message:
          'La fecha de entrega debe ser igual o posterior a la fecha del pedido',
      };
    }

    // Validar tiempo mínimo de anticipación
    // Si MINIMUM_ADVANCE_HOURS es 0, permitir entregas el mismo día
    if (BUSINESS_CONFIG.DELIVERY_SCHEDULE.MINIMUM_ADVANCE_HOURS === 0) {
      // Para pedidos inmediatos, solo validar que sea el mismo día o posterior
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const deliveryDateOnly = new Date(deliveryDate);
      deliveryDateOnly.setHours(0, 0, 0, 0);

      if (deliveryDateOnly < today && !allowPastDates) {
        return {
          isValid: false,
          message: 'No se pueden programar entregas en fechas pasadas',
          suggestedDate: this.getNextWorkingDay(new Date()),
        };
      }
    } else {
      // Para otros casos, aplicar la validación normal de horas mínimas
      if (deliveryDate < minDate && !allowPastDates) {
        const suggestedDate = this.getNextWorkingDay(minDate);
        const hoursText = `${BUSINESS_CONFIG.DELIVERY_SCHEDULE.MINIMUM_ADVANCE_HOURS} horas de anticipación`;

        return {
          isValid: false,
          message: `Se requiere al menos ${hoursText}`,
          suggestedDate,
        };
      }
    }

    // Validar tiempo máximo de anticipación
    if (deliveryDate > maxDate) {
      return {
        isValid: false,
        message: `No se pueden programar entregas con más de ${BUSINESS_CONFIG.DELIVERY_SCHEDULE.MAXIMUM_ADVANCE_DAYS} días de anticipación`,
        suggestedDate: maxDate,
      };
    }

    // Validar que sea día hábil
    if (!this.isWorkingDay(deliveryDate)) {
      const suggestedDate = this.getNextWorkingDay(deliveryDate);
      return {
        isValid: false,
        message: 'Solo se realizan entregas en días hábiles',
        suggestedDate,
      };
    }

    return { isValid: true };
  }

  /**
   * Obtiene el próximo día hábil desde una fecha dada
   */
  getNextWorkingDay(fromDate: Date): Date {
    const date = new Date(fromDate);

    while (!this.isWorkingDay(date)) {
      date.setDate(date.getDate() + 1);
    }

    return date;
  }

  /**
   * Valida un pedido completo (fecha + horario)
   * @param orderDate Fecha del pedido
   * @param scheduledDeliveryDate Fecha de entrega programada
   * @param deliveryTime Horario de entrega
   * @param allowPastDates Si es true, permite fechas pasadas (solo para SUPERADMIN)
   */
  validateOrderSchedule(
    orderDate: Date,
    scheduledDeliveryDate?: Date,
    deliveryTime?: string,
    allowPastDates: boolean = false,
  ): DeliveryScheduleValidation {
    // Si no hay fecha de entrega programada, no validar
    if (!scheduledDeliveryDate) {
      return { isValid: true };
    }

    // Validar fecha de entrega
    const dateValidation = this.validateDeliveryDate(
      orderDate,
      scheduledDeliveryDate,
      allowPastDates,
    );
    if (!dateValidation.isValid) {
      return dateValidation;
    }

    // Validar horario si se proporciona
    if (deliveryTime && !this.isTimeSlotAvailable(deliveryTime)) {
      const availableSlots = this.getAvailableTimeSlots();
      return {
        isValid: false,
        message: `Horario no disponible. Horarios disponibles: ${availableSlots.map((s) => s.label).join(', ')}`,
        suggestedTimeSlot: availableSlots[0]?.label,
      };
    }

    return { isValid: true };
  }

  /**
   * Obtiene el horario predeterminado para un contrato en un día específico
   */
  getContractScheduleForDay(
    contractSchedules: any[],
    dayOfWeek: number,
  ): string | null {
    const schedule = contractSchedules.find((s) => s.day_of_week === dayOfWeek);
    if (!schedule) return null;

    // Convertir el time de la BD a string
    if (schedule.scheduled_time instanceof Date) {
      return schedule.scheduled_time.toTimeString().slice(0, 5); // "HH:MM"
    }

    return schedule.scheduled_time;
  }

  /**
   * Genera horarios automáticos para clientes con contrato
   */
  generateContractDeliverySchedule(
    contractSchedules: any[],
    startDate: Date,
    endDate: Date,
  ): Array<{ date: Date; time: string }> {
    const deliveries: Array<{ date: Date; time: string }> = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.getDay();
      const timeForDay = this.getContractScheduleForDay(
        contractSchedules,
        dayOfWeek,
      );

      if (timeForDay && this.isWorkingDay(currentDate)) {
        deliveries.push({
          date: new Date(currentDate),
          time: timeForDay,
        });
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return deliveries;
  }
}
