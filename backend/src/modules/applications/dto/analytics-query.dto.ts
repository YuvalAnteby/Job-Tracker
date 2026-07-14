import { Transform, Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { AnalysisClassification } from '../../jobs/enums/analysis-classification.enum';
import { Domain } from '../../jobs/enums/domain.enum';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class AnalyticsQueryDto {
  @Type(() => Date)
  @IsDate()
  @IsOptional()
  from?: Date;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  to?: Date;

  @IsEnum(Domain)
  @IsOptional()
  domain?: Domain;

  @IsEnum(AnalysisClassification)
  @IsOptional()
  classification?: AnalysisClassification;

  @Transform(trim)
  @IsString()
  @MaxLength(100)
  @IsOptional()
  source?: string;
}
