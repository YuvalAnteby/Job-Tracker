import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiAcceptedResponse,
} from '@nestjs/swagger';
import { CohortPreview, GapService } from './gap.service';
import { Domain } from '../jobs/enums/domain.enum';
import { GapCohortDto } from './dto/gap-cohort.dto';

@ApiTags('gap')
@Controller('gap')
export class GapController {
  constructor(private readonly gapService: GapService) {}

  @Post('generate')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Enqueue background gap analysis' })
  @ApiAcceptedResponse({ description: 'Analysis enqueued' })
  async generate(
    @Body() dto: GapCohortDto,
  ): Promise<{ message: string; cohort: CohortPreview }> {
    const cohort = await this.gapService.generate(dto);
    return {
      message:
        cohort.included_job_ids.length > 0
          ? 'Gap analysis enqueued. You will be notified via Telegram when ready.'
          : 'No jobs match this cohort.',
      cohort,
    };
  }

  @Get('preview')
  @ApiOperation({ summary: 'Preview the exact jobs used for gap analysis' })
  @ApiOkResponse({ description: 'Cohort preview retrieved' })
  preview(@Query() query: GapCohortDto): Promise<CohortPreview> {
    return this.gapService.preview(query);
  }

  @Get('latest')
  @ApiOperation({ summary: 'Get latest gap summary' })
  @ApiOkResponse({ description: 'Latest summary retrieved' })
  async getLatest(@Query('domain') domain?: Domain) {
    return this.gapService.getLatest(domain);
  }

  @Get('history')
  @ApiOperation({ summary: 'Get gap summary history' })
  @ApiOkResponse({ description: 'History retrieved' })
  async getHistory(@Query('limit') limit: number = 10) {
    return this.gapService.getHistory(limit);
  }
}
