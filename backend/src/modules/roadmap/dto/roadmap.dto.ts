import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';
import { GapType } from '../../skills/skill-taxonomy';
import { RoadmapStatus } from '../enums/roadmap-status.enum';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreateRoadmapItemDto {
  @Transform(trim) @IsString() @Length(1, 180) title: string;
  @IsOptional() @IsUUID() skill_id?: string;
  @IsOptional() @IsEnum(GapType) gap_type?: GapType;
  @IsOptional() @IsDateString({ strict: true }) target_date?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(5) effort?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(5) relevance?: number;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  priority_override?: number;
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) job_ids?: string[];
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  requirement_ids?: string[];
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsBoolean() confirm_non_learnable?: boolean;
}

export class UpdateRoadmapItemDto {
  @IsOptional() @IsEnum(RoadmapStatus) status?: RoadmapStatus;
  @IsOptional() @IsDateString({ strict: true }) target_date?: string;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  priority_override?: number;
  @IsOptional() @IsString() notes?: string;
}

export class CreateProofArtifactDto {
  @Transform(trim) @IsString() @Length(1, 180) title: string;
  @IsOptional() @IsUrl({ require_tld: false }) url?: string;
  @IsOptional() @IsUrl({ require_tld: false }) repository_url?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() resources?: string;
}
