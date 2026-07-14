import { Transform, Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ApplicationStage } from '../enums/application-stage.enum';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class TransitionApplicationStageDto {
  @ApiProperty({ enum: ApplicationStage })
  @IsEnum(ApplicationStage)
  new_stage: ApplicationStage;

  @ApiProperty({ required: false, type: String, format: 'date-time' })
  @Type(() => Date)
  @IsDate()
  @IsOptional()
  occurred_at?: Date;

  @ApiProperty({ required: false, default: 'WEB' })
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  @IsOptional()
  source?: string;

  @ApiProperty({ required: false })
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  @IsOptional()
  notes?: string;

  @ApiProperty({ required: false })
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  @IsOptional()
  rejection_reason?: string;

  @ApiProperty({ required: false, type: String, format: 'date-time' })
  @Type(() => Date)
  @IsDate()
  @IsOptional()
  applied_at?: Date;
}
