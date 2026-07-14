import { Transform, Type } from 'class-transformer';
import {
  IsDate,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class ScheduleApplicationActionDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  label: string;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  due_at?: Date;
}

export class RescheduleApplicationActionDto {
  @Type(() => Date)
  @IsDate()
  due_at: Date;
}
