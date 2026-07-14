import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { Domain } from '../../jobs/enums/domain.enum';

export class GapCohortDto {
  @IsEnum(Domain)
  @IsOptional()
  domain_filter?: Domain;

  @Transform(({ value }: { value: unknown }) =>
    value === true || value === 'true',
  )
  @IsBoolean()
  @IsOptional()
  include_research?: boolean;
}
