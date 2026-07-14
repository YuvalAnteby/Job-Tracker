import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsUUID,
} from 'class-validator';
import { JobStatus } from '../enums/job-status.enum';

export class BulkJobIdsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  ids: string[];
}

export class BulkUpdateJobStatusDto extends BulkJobIdsDto {
  @IsIn([JobStatus.APPLIED, JobStatus.INACTIVE])
  status: JobStatus.APPLIED | JobStatus.INACTIVE;
}
