import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Domain } from '../../jobs/enums/domain.enum';

export class TargetProfileDto {
  @IsArray()
  @ArrayMaxSize(20)
  @IsEnum(Domain, { each: true })
  target_domains: Domain[];

  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  target_roles: string[];

  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  must_have_skills: string[];

  @IsString()
  @MaxLength(100)
  @IsOptional()
  seniority?: string;

  @IsString()
  @MaxLength(200)
  @IsOptional()
  location?: string;
}

export class UpdateTargetProfileDto {
  @IsInt()
  @Min(0)
  expected_revision: number;

  @ValidateNested()
  @Type(() => TargetProfileDto)
  profile: TargetProfileDto;
}
