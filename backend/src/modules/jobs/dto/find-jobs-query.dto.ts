import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { Domain } from '../enums/domain.enum';
import { JobStatus } from '../enums/job-status.enum';
import { AnalysisClassification } from '../enums/analysis-classification.enum';

export enum JobFit {
  ALL = 'all',
  APPLICABLE = 'applicable',
  INTERESTING = 'interesting',
}

const split = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string'
    ? value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    : value;

export class FindJobsQueryDto {
  @Transform(split)
  @IsEnum(Domain, { each: true })
  @IsOptional()
  domains?: Domain[];

  @Transform(split)
  @IsEnum(JobStatus, { each: true })
  @IsOptional()
  statuses?: JobStatus[];

  @Transform(split)
  @IsEnum(AnalysisClassification, { each: true })
  @IsOptional()
  classifications?: AnalysisClassification[];

  @IsEnum(JobFit)
  @IsOptional()
  fit?: JobFit;

  @IsString()
  @IsOptional()
  search?: string;
}
