import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { Domain } from '../../jobs/enums/domain.enum';

export class GetSkillsQueryDto {
  @IsOptional()
  @IsEnum(Domain)
  domain?: Domain;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => value === 'true')
  @IsBoolean()
  include_research?: boolean;
}
