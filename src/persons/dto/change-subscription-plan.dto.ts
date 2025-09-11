import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsDateString, Min } from 'class-validator';

export class ChangeSubscriptionPlanDto {
  @ApiProperty({
    description: 'ID de la suscripción actual que se va a cambiar.',
    example: 1,
  })
  @IsInt()
  @Min(1)
  current_subscription_id: number;

  @ApiProperty({
    description: 'ID del nuevo plan de suscripción (subscription_plan_id).',
    example: 2,
  })
  @IsInt()
  @Min(1)
  new_plan_id: number;

  @ApiProperty({
    description:
      'Fecha opcional a partir de la cual el nuevo plan debe entrar en vigor. Si no se provee, se determinará según la lógica de negocio (ej. inicio del próximo ciclo).',
    example: '2024-07-01',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  effective_date?: string;
}
