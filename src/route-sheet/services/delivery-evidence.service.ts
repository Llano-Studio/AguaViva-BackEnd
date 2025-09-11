import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import {
  CreateDeliveryEvidenceDto,
  DeliveryEvidenceResponseDto,
  EvidenceType,
} from '../dto/delivery-evidence.dto';
import * as fs from 'fs-extra';
import * as path from 'path';

@Injectable()
export class DeliveryEvidenceService extends PrismaClient {
  private readonly uploadsPath = path.join(
    process.cwd(),
    'public',
    'uploads',
    'evidence',
  );

  constructor() {
    super();
    this.initUploadDirectory();
  }

  private async initUploadDirectory(): Promise<void> {
    await fs.ensureDir(this.uploadsPath);
  }

  /**
   * Guarda una evidencia de entrega (firma o foto)
   */
  async saveEvidence(
    createDto: CreateDeliveryEvidenceDto,
  ): Promise<DeliveryEvidenceResponseDto> {
    const { route_sheet_detail_id, evidence_type, evidence_data, created_by } =
      createDto;

    try {
      // 1. Verificar que el detalle de la hoja de ruta existe
      const routeDetail = await this.route_sheet_detail.findUnique({
        where: { route_sheet_detail_id },
        include: {
          route_sheet: true,
        },
      });

      if (!routeDetail) {
        throw new NotFoundException(
          `El detalle de hoja de ruta con ID ${route_sheet_detail_id} no existe`,
        );
      }

      // 2. Validar y procesar los datos de la evidencia
      if (!evidence_data) {
        throw new BadRequestException(
          'Los datos de evidencia son obligatorios',
        );
      }

      // 3. Guardar la imagen/firma en el sistema de archivos
      const fileName = await this.saveEvidenceFile(
        evidence_data,
        route_sheet_detail_id,
        evidence_type,
      );

      // 4. Guardar la referencia en la base de datos
      const evidence = await this.delivery_evidence.create({
        data: {
          route_sheet_detail_id,
          evidence_type,
          file_path: fileName,
          created_by: created_by || routeDetail.route_sheet.driver_id, // default al conductor asignado
        },
        include: {
          route_sheet_detail: true,
        },
      });

      // 5. Si es una firma, actualizar el campo en el detalle de la entrega
      if (evidence_type === EvidenceType.SIGNATURE) {
        await this.route_sheet_detail.update({
          where: { route_sheet_detail_id },
          data: {
            digital_signature_id: fileName,
          },
        });
      }

      // 6. Si el detalle no tenía hora de entrega, actualizarla
      if (!routeDetail.delivery_time) {
        await this.route_sheet_detail.update({
          where: { route_sheet_detail_id },
          data: {
            delivery_time: new Date().toTimeString().slice(0, 5), // Formato HH:MM
            delivery_status: 'DELIVERED',
            actual_arrival_time: new Date(),
          },
        });
      }

      return {
        evidence_id: evidence.evidence_id,
        route_sheet_detail_id: evidence.route_sheet_detail_id,
        evidence_type: evidence.evidence_type as EvidenceType,
        file_path: `/uploads/evidence/${fileName}`,
        created_at: evidence.created_at.toISOString(),
        created_by: evidence.created_by,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      console.error('Error al guardar evidencia:', error);
      throw new InternalServerErrorException('Error al guardar evidencia');
    }
  }

  /**
   * Obtiene todas las evidencias de un detalle de hoja de ruta
   */
  async getEvidencesByDetail(
    route_sheet_detail_id: number,
  ): Promise<DeliveryEvidenceResponseDto[]> {
    // Verificar que el detalle existe
    const routeDetail = await this.route_sheet_detail.findUnique({
      where: { route_sheet_detail_id },
    });

    if (!routeDetail) {
      throw new NotFoundException(
        `El detalle de hoja de ruta con ID ${route_sheet_detail_id} no existe`,
      );
    }

    // Obtener las evidencias
    const evidences = await this.delivery_evidence.findMany({
      where: { route_sheet_detail_id },
    });

    return evidences.map((evidence) => ({
      evidence_id: evidence.evidence_id,
      route_sheet_detail_id: evidence.route_sheet_detail_id,
      evidence_type: evidence.evidence_type as EvidenceType,
      file_path: `/uploads/evidence/${evidence.file_path}`,
      created_at: evidence.created_at.toISOString(),
      created_by: evidence.created_by,
    }));
  }

  /**
   * Guarda un archivo de evidencia (firma o foto) en el sistema de archivos
   */
  private async saveEvidenceFile(
    dataUri: string,
    detail_id: number,
    evidenceType: EvidenceType,
  ): Promise<string> {
    try {
      // Verificar el formato del data URI (debe ser base64)
      if (!dataUri.startsWith('data:')) {
        throw new BadRequestException('Formato de datos inválido');
      }

      // Extraer datos y tipo MIME
      const matches = dataUri.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);

      if (!matches || matches.length !== 3) {
        throw new BadRequestException('Formato de datos inválido');
      }

      const mimeType = matches[1];
      const base64Data = matches[2];
      const buffer = Buffer.from(base64Data, 'base64');

      // Generar nombre de archivo
      const extension = this.getFileExtension(mimeType);
      const timestamp = new Date().getTime();
      const fileName = `${evidenceType.toLowerCase()}_${detail_id}_${timestamp}.${extension}`;
      const filePath = path.join(this.uploadsPath, fileName);

      // Guardar archivo
      await fs.writeFile(filePath, buffer);

      return fileName;
    } catch (error) {
      console.error('Error al guardar archivo:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Error al guardar archivo de evidencia',
      );
    }
  }

  /**
   * Obtiene la extensión de archivo según el tipo MIME
   */
  private getFileExtension(mimeType: string): string {
    const mimeMap: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/svg+xml': 'svg',
      'application/pdf': 'pdf',
    };

    return mimeMap[mimeType] || 'dat';
  }
}
