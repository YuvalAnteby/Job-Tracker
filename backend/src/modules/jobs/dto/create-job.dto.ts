import { IsString, IsUrl, IsOptional, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateJobDto {
  @ApiProperty({ example: 'Google' })
  @IsString()
  @IsNotEmpty()
  company_name: string;

  @ApiProperty({ example: 'Software Engineer' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'https://careers.google.com/jobs/results/123' })
  @IsUrl()
  @IsNotEmpty()
  url: string;

  @ApiProperty({ example: 'We are looking for a software engineer...' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ example: '2026-05-10T00:00:00Z', required: false })
  @IsOptional()
  posted_at?: string;
}
