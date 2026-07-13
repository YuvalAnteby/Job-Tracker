import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export const MASTER_CV_MAX_BYTES = 1024 * 1024;
export const CV_SOURCES = ['manual', 'file', 'legacy_url'] as const;

export type CvSource = (typeof CV_SOURCES)[number];

export class UpdateMasterCvDto {
  @IsString()
  content: string;

  @IsIn(CV_SOURCES)
  source: CvSource;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  filename?: string;

  @IsInt()
  @Min(0)
  expected_revision: number;
}

export class MasterCvRevisionDto {
  @IsInt()
  @Min(0)
  expected_revision: number;
}
