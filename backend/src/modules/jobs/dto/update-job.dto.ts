import { PartialType } from '@nestjs/swagger';
import { CreateJobDto } from './create-job.dto';
import {
  IsEnum,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsString,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { JobStatus } from '../enums/job-status.enum';
import { Domain } from '../enums/domain.enum';
import { ListingState } from '../enums/listing-state.enum';
import { UserDecision } from '../enums/user-decision.enum';
import { AnalysisClassification } from '../enums/analysis-classification.enum';

export class UpdateJobDto extends PartialType(CreateJobDto) {
  @ApiProperty({ enum: JobStatus, required: false })
  @IsEnum(JobStatus)
  @IsOptional()
  status?: JobStatus;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  score_override?: number;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  is_applicable_override?: boolean;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  is_interesting_override?: boolean;

  @ApiProperty({ enum: Domain, required: false })
  @IsEnum(Domain)
  @IsOptional()
  domain_override?: Domain;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({ enum: ListingState, required: false })
  @IsEnum(ListingState)
  @IsOptional()
  listing_state?: ListingState;

  @ApiProperty({ enum: UserDecision, required: false })
  @IsEnum(UserDecision)
  @IsOptional()
  user_decision?: UserDecision;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  include_in_gap?: boolean;

  @ApiProperty({ enum: AnalysisClassification, required: false })
  @IsEnum(AnalysisClassification)
  @IsOptional()
  classification_override?: AnalysisClassification;
}
