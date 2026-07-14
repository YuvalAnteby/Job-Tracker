import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  RescheduleApplicationActionDto,
  ScheduleApplicationActionDto,
} from './dto/application-action.dto';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';
import { ApplicationsService } from './applications.service';
import { ApplicationAction } from './entities/application-action.entity';
import { ApplicationActionEvent } from './entities/application-action-event.entity';

@ApiTags('applications')
@Controller('applications')
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Get('attention')
  @ApiOperation({ summary: 'List application actions needing attention' })
  @ApiOkResponse({ description: 'Actions grouped by urgency.' })
  attention(): ReturnType<ApplicationsService['attention']> {
    return this.applicationsService.attention();
  }

  @Get('analytics')
  @ApiOperation({ summary: 'Calculate event-derived application analytics' })
  @ApiOkResponse({ description: 'Application analytics with sample sizes.' })
  analytics(
    @Query() filters: AnalyticsQueryDto,
  ): ReturnType<ApplicationsService['analytics']> {
    return this.applicationsService.analytics(filters);
  }

  @Get('analytics/export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header(
    'Content-Disposition',
    'attachment; filename="application-analytics.csv"',
  )
  @ApiOperation({ summary: 'Export non-sensitive application analytics CSV' })
  @ApiOkResponse({ description: 'CSV without CV text or notes.' })
  exportCsv(@Query() filters: AnalyticsQueryDto): Promise<string> {
    return this.applicationsService.exportCsv(filters);
  }

  @Put(':jobId/action')
  @ApiOperation({ summary: 'Schedule or replace the next application action' })
  @ApiOkResponse({ type: ApplicationAction })
  schedule(
    @Param('jobId') jobId: string,
    @Body() input: ScheduleApplicationActionDto,
  ): Promise<ApplicationAction> {
    return this.applicationsService.schedule(jobId, input);
  }

  @Post(':jobId/action/reschedule')
  @ApiOperation({ summary: 'Reschedule the current application action' })
  @ApiOkResponse({ type: ApplicationAction })
  reschedule(
    @Param('jobId') jobId: string,
    @Body() input: RescheduleApplicationActionDto,
  ): Promise<ApplicationAction> {
    return this.applicationsService.reschedule(jobId, input.due_at);
  }

  @Post(':jobId/action/complete')
  @ApiOperation({ summary: 'Complete the current application action' })
  @ApiOkResponse({ type: ApplicationAction })
  complete(@Param('jobId') jobId: string): Promise<ApplicationAction> {
    return this.applicationsService.complete(jobId);
  }

  @Post(':jobId/action/dismiss')
  @ApiOperation({ summary: 'Dismiss the current application action' })
  @ApiOkResponse({ type: ApplicationAction })
  dismiss(@Param('jobId') jobId: string): Promise<ApplicationAction> {
    return this.applicationsService.dismiss(jobId);
  }

  @Get(':jobId/action/history')
  @ApiOperation({ summary: 'List durable action history' })
  @ApiOkResponse({ type: ApplicationActionEvent, isArray: true })
  history(@Param('jobId') jobId: string): Promise<ApplicationActionEvent[]> {
    return this.applicationsService.history(jobId);
  }
}
