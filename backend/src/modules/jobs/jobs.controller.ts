import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JobsService } from './jobs.service';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { FindJobsQueryDto } from './dto/find-jobs-query.dto';
import { BulkJobIdsDto, BulkUpdateJobStatusDto } from './dto/bulk-jobs.dto';
import { BulkJobsResult } from './jobs.service';
import { TransitionApplicationStageDto } from './dto/transition-application-stage.dto';
import { Job } from './entities/job.entity';
import { ReanalyzeJobsDto } from './dto/reanalyze-jobs.dto';
import type { ReanalysisComparison } from './jobs.service';

@ApiTags('jobs')
@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Post()
  @ApiOperation({ summary: 'Create (ingest) a new job' })
  @ApiResponse({
    status: 201,
    description: 'Job successfully ingested and analyzed.',
  })
  @ApiResponse({ status: 409, description: 'Job URL already exists.' })
  create(@Body() createJobDto: CreateJobDto): Promise<Job> {
    return this.jobsService.create(createJobDto);
  }

  @Get()
  @ApiOperation({ summary: 'List all jobs' })
  @ApiResponse({ status: 200, description: 'Return all jobs.' })
  findAll(@Query() query: FindJobsQueryDto): Promise<Job[]> {
    return this.jobsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single job' })
  @ApiResponse({ status: 200, description: 'Return job details.' })
  @ApiResponse({ status: 404, description: 'Job not found.' })
  findOne(@Param('id') id: string): Promise<Job> {
    return this.jobsService.findOne(id);
  }

  @Post(':id/analyze')
  @ApiOperation({ summary: 'Re-analyze an existing job description' })
  @ApiResponse({ status: 200, description: 'Job successfully re-analyzed.' })
  @ApiResponse({ status: 404, description: 'Job not found.' })
  reanalyze(@Param('id') id: string): Promise<Job> {
    return this.jobsService.reanalyze(id);
  }

  @Post('reanalyze')
  @ApiOperation({ summary: 'Re-analyze one or more jobs and compare results' })
  reanalyzeMany(@Body() input: ReanalyzeJobsDto): Promise<{
    succeeded: ReanalysisComparison[];
    failed: { id: string; error: string }[];
  }> {
    return this.jobsService.reanalyzeMany(input.ids);
  }

  @Get(':id/analysis-history')
  @ApiOperation({ summary: 'Inspect immutable job analysis revisions' })
  getAnalysisHistory(@Param('id') id: string) {
    return this.jobsService.getAnalysisHistory(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update job details or apply overrides' })
  @ApiResponse({ status: 200, description: 'Job successfully updated.' })
  update(
    @Param('id') id: string,
    @Body() updateJobDto: UpdateJobDto,
  ): Promise<Job> {
    return this.jobsService.update(id, updateJobDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete a job' })
  @ApiResponse({ status: 200, description: 'Job successfully deleted.' })
  remove(@Param('id') id: string): Promise<Job> {
    return this.jobsService.remove(id);
  }

  @Patch('bulk/status')
  @ApiOperation({ summary: 'Update the status of multiple jobs' })
  @ApiResponse({ status: 200, description: 'Per-job bulk update result.' })
  bulkUpdateStatus(
    @Body() body: BulkUpdateJobStatusDto,
  ): Promise<BulkJobsResult> {
    return this.jobsService.bulkUpdateStatus(body.ids, body.status);
  }

  @Delete()
  @ApiOperation({ summary: 'Soft delete multiple jobs' })
  @ApiResponse({ status: 200, description: 'Per-job bulk delete result.' })
  bulkRemove(@Body() body: BulkJobIdsDto): Promise<BulkJobsResult> {
    return this.jobsService.bulkRemove(body.ids);
  }

  @Post(':id/application-stage')
  @ApiOperation({ summary: 'Transition application stage and append history' })
  @ApiResponse({ status: 201, description: 'Application stage transitioned.' })
  transitionApplicationStage(
    @Param('id') id: string,
    @Body() dto: TransitionApplicationStageDto,
  ): Promise<Job> {
    return this.jobsService.transitionApplicationStage(id, dto);
  }
}
