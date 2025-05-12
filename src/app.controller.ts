import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('Health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Verificar si la API está en funcionamiento' })
  @ApiResponse({ status: 200, description: 'API operativa' })
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  @ApiOperation({ summary: 'Verificar el estado de salud de la API' })
  @ApiResponse({ 
    status: 200, 
    description: 'Estado de salud de la API', 
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        timestamp: { type: 'string', example: '2023-07-01T12:00:00Z' },
        database: { type: 'boolean', example: true },
        uptime: { type: 'number', example: 3600 }
      }
    }
  })
  async checkHealth() {
    return this.appService.checkHealth();
  }
} 