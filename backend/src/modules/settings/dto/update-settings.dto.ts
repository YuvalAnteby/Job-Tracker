import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Domain } from '../../jobs/enums/domain.enum';

export class UpdateSettingsDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  score_threshold?: number;

  @IsOptional()
  @IsArray()
  @IsEnum(Domain, { each: true })
  applicable_domains?: Domain[];

  @IsOptional()
  @IsObject()
  domain_keywords?: Partial<Record<Domain, string[]>>;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Matches(/^gemini-[a-zA-Z0-9._-]+$/)
  llm_model?: string;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  telegram_allowed_chat_ids?: number[];

  @IsOptional()
  @IsBoolean()
  reminders_enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  reminder_default_days?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  reminder_timezone?: string;
}
