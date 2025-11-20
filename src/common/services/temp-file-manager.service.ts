import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { formatBAYMD, formatBAHMS } from '../utils/date.utils';

export interface TempFileInfo {
  fileName: string;
  filePath: string;
  downloadUrl: string;
  fileSize: number;
  expirationMinutes: number;
}

@Injectable()
export class TempFileManagerService {
  private readonly logger = new Logger(TempFileManagerService.name);
  private readonly tempDir: string;

  constructor() {
    this.tempDir = path.join(process.cwd(), 'temp');
    this.ensureTempDirectoryExists();
  }

  /**
   * Asegura que el directorio temporal existe
   */
  private ensureTempDirectoryExists(): void {
    try {
      if (!fs.existsSync(this.tempDir)) {
        fs.mkdirSync(this.tempDir, { recursive: true });
        this.logger.log(`Directorio temporal creado: ${this.tempDir}`);
      }
    } catch (error) {
      this.logger.error(`Error creando directorio temporal: ${error.message}`);
      throw new Error(`No se pudo crear el directorio temporal: ${error.message}`);
    }
  }

  /**
   * Genera un nombre de archivo único con timestamp
   */
  generateUniqueFileName(prefix: string, extension: string = 'pdf'): string {
    const d = new Date();
    const ymd = formatBAYMD(d);
    const hms = formatBAHMS(d);
    const timestamp = `${ymd}-${hms}`;
    
    return `${prefix}-${timestamp}.${extension}`;
  }

  /**
   * Obtiene la ruta completa para un archivo temporal
   */
  getTempFilePath(fileName: string): string {
    return path.join(this.tempDir, fileName);
  }

  /**
   * Genera una URL de descarga temporal
   */
  generateDownloadUrl(fileName: string): string {
    const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
    return `${baseUrl}/temp/${fileName}`;
  }

  /**
   * Crea información completa del archivo temporal
   */
  createTempFileInfo(
    fileName: string, 
    expirationMinutes: number = 60
  ): TempFileInfo {
    const filePath = this.getTempFilePath(fileName);
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`Archivo temporal no encontrado: ${fileName}`);
    }

    const fileSize = fs.statSync(filePath).size;
    const downloadUrl = this.generateDownloadUrl(fileName);

    return {
      fileName,
      filePath,
      downloadUrl,
      fileSize,
      expirationMinutes,
    };
  }

  /**
   * Elimina archivos temporales antiguos
   */
  async cleanupOldFiles(maxAgeHours: number = 24): Promise<void> {
    try {
      const files = fs.readdirSync(this.tempDir);
      const now = Date.now();
      const maxAge = maxAgeHours * 60 * 60 * 1000; // Convertir a milisegundos

      for (const file of files) {
        const filePath = path.join(this.tempDir, file);
        const stats = fs.statSync(filePath);
        
        if (now - stats.mtime.getTime() > maxAge) {
          fs.unlinkSync(filePath);
          this.logger.log(`Archivo temporal eliminado: ${file}`);
        }
      }
    } catch (error) {
      this.logger.error(`Error limpiando archivos temporales: ${error.message}`);
    }
  }

  /**
   * Elimina un archivo temporal específico
   */
  async deleteFile(fileName: string): Promise<boolean> {
    try {
      const filePath = this.getTempFilePath(fileName);
      
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        this.logger.log(`Archivo temporal eliminado: ${fileName}`);
        return true;
      }
      
      return false;
    } catch (error) {
      this.logger.error(`Error eliminando archivo temporal ${fileName}: ${error.message}`);
      return false;
    }
  }

  /**
   * Verifica si un archivo temporal existe
   */
  fileExists(fileName: string): boolean {
    const filePath = this.getTempFilePath(fileName);
    return fs.existsSync(filePath);
  }

  /**
   * Obtiene el tamaño de un archivo temporal
   */
  getFileSize(fileName: string): number {
    const filePath = this.getTempFilePath(fileName);
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`Archivo temporal no encontrado: ${fileName}`);
    }
    
    return fs.statSync(filePath).size;
  }

  /**
   * Lista todos los archivos temporales
   */
  listTempFiles(): string[] {
    try {
      return fs.readdirSync(this.tempDir);
    } catch (error) {
      this.logger.error(`Error listando archivos temporales: ${error.message}`);
      return [];
    }
  }

  /**
   * Obtiene estadísticas del directorio temporal
   */
  getTempDirectoryStats(): {
    totalFiles: number;
    totalSize: number;
    oldestFile?: string;
    newestFile?: string;
  } {
    try {
      const files = fs.readdirSync(this.tempDir);
      let totalSize = 0;
      let oldestTime = Infinity;
      let newestTime = 0;
      let oldestFile: string | undefined;
      let newestFile: string | undefined;

      for (const file of files) {
        const filePath = path.join(this.tempDir, file);
        const stats = fs.statSync(filePath);
        
        totalSize += stats.size;
        
        if (stats.mtime.getTime() < oldestTime) {
          oldestTime = stats.mtime.getTime();
          oldestFile = file;
        }
        
        if (stats.mtime.getTime() > newestTime) {
          newestTime = stats.mtime.getTime();
          newestFile = file;
        }
      }

      return {
        totalFiles: files.length,
        totalSize,
        oldestFile,
        newestFile,
      };
    } catch (error) {
      this.logger.error(`Error obteniendo estadísticas: ${error.message}`);
      return {
        totalFiles: 0,
        totalSize: 0,
      };
    }
  }
}